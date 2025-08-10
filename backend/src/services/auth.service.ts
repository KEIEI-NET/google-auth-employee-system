import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { redisClient } from '../lib/redis';
import { AppError } from '../utils/AppError';
import logger from '../utils/logger';
import { JWTPayload, TokenPair, GoogleUserInfo } from '../types/auth.types';
import { createAuditLog } from './auditLog.service';

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export class AuthService {
  private static readonly ACCESS_TOKEN_EXPIRY = '15m';
  private static readonly REFRESH_TOKEN_EXPIRY = '7d';
  private static readonly STATE_EXPIRY = 600; // 10 minutes in seconds

  static generatePKCE(): { verifier: string; challenge: string } {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');
    return { verifier, challenge };
  }

  static generateState(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  static async storeState(
    state: string,
    codeVerifier: string,
    ipAddress: string
  ): Promise<void> {
    const key = `oauth_state:${state}`;
    const data = JSON.stringify({ codeVerifier, ipAddress, timestamp: Date.now() });
    await redisClient.setEx(key, this.STATE_EXPIRY, data);
  }

  static async validateState(
    state: string,
    ipAddress: string
  ): Promise<string> {
    const key = `oauth_state:${state}`;
    
    // Use Redis transaction for atomic operations
    const multi = redisClient.multi();
    multi.get(key);
    multi.del(key);
    const results = await multi.exec();
    
    if (!results || !results[0] || results[0][1] === null) {
      throw new AppError('Invalid or expired state', 400, 'INVALID_STATE');
    }
    
    const data = JSON.parse(results[0][1] as string);
    
    // Verify IP address matches
    if (data.ipAddress !== ipAddress) {
      logger.warn(`State IP mismatch. Expected: ${data.ipAddress}, Got: ${ipAddress}`);
      throw new AppError('State validation failed', 400, 'STATE_VALIDATION_FAILED');
    }
    
    // Check timestamp (additional security)
    const elapsed = Date.now() - data.timestamp;
    if (elapsed > this.STATE_EXPIRY * 1000) {
      throw new AppError('State expired', 400, 'STATE_EXPIRED');
    }
    
    return data.codeVerifier;
  }

  static getAuthUrl(codeChallenge: string, state: string): string {
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'consent',
    });
  }

  static async exchangeCodeForTokens(
    code: string,
    codeVerifier: string
  ): Promise<GoogleUserInfo> {
    try {
      const { tokens } = await oauth2Client.getToken({
        code,
        codeVerifier,
      });

      if (!tokens.id_token) {
        throw new AppError('No ID token received', 400, 'NO_ID_TOKEN');
      }

      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID!,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new AppError('Invalid token payload', 400, 'INVALID_PAYLOAD');
      }

      return {
        id: payload.sub,
        email: payload.email!,
        name: payload.name || '',
        picture: payload.picture || '',
        email_verified: payload.email_verified || false,
      };
    } catch (error) {
      logger.error('Token exchange failed:', error);
      throw new AppError(
        'Failed to exchange authorization code',
        400,
        'TOKEN_EXCHANGE_FAILED'
      );
    }
  }

  static async findOrCreateEmployee(googleUser: GoogleUserInfo) {
    // Check if employee exists
    let employee = await prisma.employee.findUnique({
      where: { email: googleUser.email },
      include: {
        employeeRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!employee) {
      // Create new employee with default role
      const defaultRole = await prisma.role.findFirst({
        where: { name: 'VIEWER' },
      });

      if (!defaultRole) {
        throw new AppError('Default role not found', 500, 'ROLE_NOT_FOUND');
      }

      employee = await prisma.employee.create({
        data: {
          googleId: googleUser.id,
          email: googleUser.email,
          name: googleUser.name,
          profilePicture: googleUser.picture,
          employeeRoles: {
            create: {
              roleId: defaultRole.id,
            },
          },
        },
        include: {
          employeeRoles: {
            include: {
              role: true,
            },
          },
        },
      });

      logger.info(`New employee created: ${employee.email}`);
    } else {
      // Update Google profile info
      await prisma.employee.update({
        where: { id: employee.id },
        data: {
          googleId: googleUser.id,
          name: googleUser.name,
          profilePicture: googleUser.picture,
          lastLoginAt: new Date(),
        },
      });
    }

    return employee;
  }

  static generateTokens(userId: string, email: string): TokenPair {
    const payload: JWTPayload = {
      userId,
      email,
      type: 'access',
    };

    const accessToken = jwt.sign(
      payload,
      process.env.JWT_SECRET!,
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
      { ...payload, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: this.REFRESH_TOKEN_EXPIRY }
    );

    return { accessToken, refreshToken };
  }

  static async storeRefreshToken(
    userId: string,
    refreshToken: string
  ): Promise<void> {
    const key = `refresh_token:${userId}`;
    const expiry = 7 * 24 * 60 * 60; // 7 days in seconds
    await redisClient.setEx(key, expiry, refreshToken);
  }

  static async validateRefreshToken(
    refreshToken: string
  ): Promise<{ userId: string; email: string }> {
    try {
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET!
      ) as JWTPayload;

      if (decoded.type !== 'refresh') {
        throw new AppError('Invalid token type', 401, 'INVALID_TOKEN_TYPE');
      }

      // Verify token exists in Redis
      const storedToken = await redisClient.get(`refresh_token:${decoded.userId}`);
      
      // Timing-safe comparison
      const tokenBuffer = Buffer.from(refreshToken);
      const storedBuffer = Buffer.from(storedToken || '');
      
      if (!storedToken || !crypto.timingSafeEqual(tokenBuffer, storedBuffer)) {
        throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
      }

      return { userId: decoded.userId, email: decoded.email };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError('Refresh token expired', 401, 'REFRESH_TOKEN_EXPIRED');
      }
      throw error;
    }
  }

  static async revokeRefreshToken(userId: string): Promise<void> {
    await redisClient.del(`refresh_token:${userId}`);
  }

  static async handleGoogleCallback(
    code: string,
    state: string,
    ipAddress: string
  ) {
    // Validate state and get code verifier
    const codeVerifier = await this.validateState(state, ipAddress);

    // Exchange code for tokens
    const googleUser = await this.exchangeCodeForTokens(code, codeVerifier);

    // Find or create employee
    const employee = await this.findOrCreateEmployee(googleUser);

    // Generate JWT tokens
    const tokens = this.generateTokens(employee.id, employee.email);

    // Store refresh token
    await this.storeRefreshToken(employee.id, tokens.refreshToken);

    // Create audit log
    await createAuditLog({
      employeeId: employee.id,
      action: 'LOGIN',
      resource: 'AUTH',
      ipAddress,
      userAgent: '',
      details: { method: 'google_oauth' },
    });

    return {
      employee: {
        id: employee.id,
        email: employee.email,
        name: employee.name,
        profilePicture: employee.profilePicture,
        roles: employee.employeeRoles.map((er) => er.role.name),
      },
      tokens,
    };
  }
}