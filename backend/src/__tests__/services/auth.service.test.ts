import { AuthService } from '../../services/auth.service';
import { redisClient } from '../../lib/redis';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import jwt from 'jsonwebtoken';

jest.mock('google-auth-library');

describe('AuthService', () => {
  describe('generatePKCE', () => {
    it('should generate valid PKCE verifier and challenge', () => {
      const { verifier, challenge } = AuthService.generatePKCE();
      
      expect(verifier).toBeDefined();
      expect(challenge).toBeDefined();
      expect(verifier).toHaveLength(43); // Base64url encoded 32 bytes
      expect(challenge).toHaveLength(43); // SHA256 hash base64url encoded
    });

    it('should generate unique values each time', () => {
      const pkce1 = AuthService.generatePKCE();
      const pkce2 = AuthService.generatePKCE();
      
      expect(pkce1.verifier).not.toBe(pkce2.verifier);
      expect(pkce1.challenge).not.toBe(pkce2.challenge);
    });
  });

  describe('generateState', () => {
    it('should generate valid state parameter', () => {
      const state = AuthService.generateState();
      
      expect(state).toBeDefined();
      expect(state).toHaveLength(43); // Base64url encoded 32 bytes
    });

    it('should generate unique states', () => {
      const state1 = AuthService.generateState();
      const state2 = AuthService.generateState();
      
      expect(state1).not.toBe(state2);
    });
  });

  describe('storeState', () => {
    it('should store state in Redis with correct expiry', async () => {
      const state = 'test-state';
      const codeVerifier = 'test-verifier';
      const ipAddress = '127.0.0.1';
      
      await AuthService.storeState(state, codeVerifier, ipAddress);
      
      expect(redisClient.setEx).toHaveBeenCalledWith(
        `oauth_state:${state}`,
        600, // 10 minutes
        expect.stringContaining(codeVerifier)
      );
    });
  });

  describe('validateState', () => {
    it('should validate state and return code verifier', async () => {
      const state = 'test-state';
      const codeVerifier = 'test-verifier';
      const ipAddress = '127.0.0.1';
      
      const mockData = JSON.stringify({
        codeVerifier,
        ipAddress,
        timestamp: Date.now(),
      });
      
      (redisClient.multi as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnThis(),
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, mockData], [null, 1]]),
      });
      
      const result = await AuthService.validateState(state, ipAddress);
      
      expect(result).toBe(codeVerifier);
    });

    it('should throw error for invalid state', async () => {
      const state = 'invalid-state';
      const ipAddress = '127.0.0.1';
      
      (redisClient.multi as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnThis(),
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, null], [null, 0]]),
      });
      
      await expect(
        AuthService.validateState(state, ipAddress)
      ).rejects.toThrow(AppError);
    });

    it('should throw error for IP mismatch', async () => {
      const state = 'test-state';
      const codeVerifier = 'test-verifier';
      const storedIp = '127.0.0.1';
      const requestIp = '192.168.1.1';
      
      const mockData = JSON.stringify({
        codeVerifier,
        ipAddress: storedIp,
        timestamp: Date.now(),
      });
      
      (redisClient.multi as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnThis(),
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, mockData], [null, 1]]),
      });
      
      await expect(
        AuthService.validateState(state, requestIp)
      ).rejects.toThrow('State validation failed');
    });
  });

  describe('generateTokens', () => {
    it('should generate valid JWT tokens', () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      
      const { accessToken, refreshToken } = AuthService.generateTokens(userId, email);
      
      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();
      
      // Verify access token
      const decodedAccess = jwt.verify(accessToken, process.env.JWT_SECRET!) as any;
      expect(decodedAccess.userId).toBe(userId);
      expect(decodedAccess.email).toBe(email);
      expect(decodedAccess.type).toBe('access');
      
      // Verify refresh token
      const decodedRefresh = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
      expect(decodedRefresh.userId).toBe(userId);
      expect(decodedRefresh.email).toBe(email);
      expect(decodedRefresh.type).toBe('refresh');
    });
  });

  describe('validateRefreshToken', () => {
    it('should validate refresh token and return user info', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const { refreshToken } = AuthService.generateTokens(userId, email);
      
      (redisClient.get as jest.Mock).mockResolvedValue(refreshToken);
      
      const result = await AuthService.validateRefreshToken(refreshToken);
      
      expect(result.userId).toBe(userId);
      expect(result.email).toBe(email);
    });

    it('should throw error for invalid token type', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const { accessToken } = AuthService.generateTokens(userId, email);
      
      await expect(
        AuthService.validateRefreshToken(accessToken)
      ).rejects.toThrow('Invalid token type');
    });

    it('should throw error for expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: 'user-123', email: 'test@example.com', type: 'refresh' },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: '-1h' }
      );
      
      await expect(
        AuthService.validateRefreshToken(expiredToken)
      ).rejects.toThrow('Refresh token expired');
    });
  });

  describe('findOrCreateEmployee', () => {
    it('should create new employee if not exists', async () => {
      const googleUser = {
        id: 'google-123',
        email: 'new@example.com',
        name: 'New User',
        picture: 'https://example.com/photo.jpg',
        email_verified: true,
      };
      
      const mockRole = { id: 'role-1', name: 'VIEWER' };
      const mockEmployee = {
        id: 'emp-123',
        ...googleUser,
        googleId: googleUser.id,
        employeeRoles: [{ role: mockRole }],
      };
      
      (prisma.employee.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.role.findFirst as jest.Mock).mockResolvedValue(mockRole);
      (prisma.employee.create as jest.Mock).mockResolvedValue(mockEmployee);
      
      const result = await AuthService.findOrCreateEmployee(googleUser);
      
      expect(result).toEqual(mockEmployee);
      expect(prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: googleUser.email,
            name: googleUser.name,
          }),
        })
      );
    });

    it('should update existing employee', async () => {
      const googleUser = {
        id: 'google-123',
        email: 'existing@example.com',
        name: 'Existing User',
        picture: 'https://example.com/photo.jpg',
        email_verified: true,
      };
      
      const mockEmployee = {
        id: 'emp-123',
        ...googleUser,
        googleId: googleUser.id,
        employeeRoles: [],
      };
      
      (prisma.employee.findUnique as jest.Mock).mockResolvedValue(mockEmployee);
      (prisma.employee.update as jest.Mock).mockResolvedValue(mockEmployee);
      
      const result = await AuthService.findOrCreateEmployee(googleUser);
      
      expect(result).toEqual(mockEmployee);
      expect(prisma.employee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockEmployee.id },
          data: expect.objectContaining({
            lastLoginAt: expect.any(Date),
          }),
        })
      );
    });
  });
});