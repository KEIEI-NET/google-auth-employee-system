import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthService } from '../services/auth.service';
import { authenticate } from '../middleware/auth.middleware';
import { AppError } from '../utils/AppError';
import logger from '../utils/logger';

const router = Router();

// Cookie options for production
const getCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge,
  path: '/'
});

// Get OAuth URL with PKCE
router.get('/google', async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress || '';
    
    // Generate PKCE and state
    const { verifier, challenge } = AuthService.generatePKCE();
    const state = AuthService.generateState();
    
    // Store state with code verifier
    await AuthService.storeState(state, verifier, ipAddress);
    
    // Generate auth URL
    const authUrl = AuthService.getAuthUrl(challenge, state);
    
    res.json({
      success: true,
      data: {
        authUrl,
        state,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Handle OAuth callback
router.post(
  '/google/callback',
  [
    body('code').notEmpty().withMessage('Authorization code is required'),
    body('state').notEmpty().withMessage('State parameter is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(
          'Validation failed',
          400,
          'VALIDATION_ERROR',
          errors.array()
        );
      }

      const { code, state } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || '';
      
      // Handle the OAuth callback
      const result = await AuthService.handleGoogleCallback(
        code,
        state,
        ipAddress
      );
      
      // Set httpOnly cookies
      res.cookie('accessToken', result.tokens.accessToken, getCookieOptions(15 * 60 * 1000)); // 15 minutes
      res.cookie('refreshToken', result.tokens.refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000)); // 7 days
      
      // Return user data without tokens
      res.json({
        success: true,
        data: {
          employee: result.employee
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Refresh access token
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    
    if (!refreshToken) {
      throw new AppError('No refresh token provided', 401, 'NO_REFRESH_TOKEN');
    }
    
    // Validate refresh token
    const { userId, email } = await AuthService.validateRefreshToken(
      refreshToken
    );
    
    // Generate new access token
    const tokens = AuthService.generateTokens(userId, email);
    
    // Update access token cookie
    res.cookie('accessToken', tokens.accessToken, getCookieOptions(15 * 60 * 1000));
    
    res.json({
      success: true,
      data: {
        message: 'Token refreshed successfully',
      },
    });
  } catch (error) {
    next(error);
  }
});

// Logout
router.post('/logout', authenticate, async (req: any, res, next) => {
  try {
    // Revoke refresh token
    await AuthService.revokeRefreshToken(req.user.id);
    
    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    
    logger.info(`User ${req.user.email} logged out`);
    
    res.json({
      success: true,
      data: {
        message: 'Logged out successfully',
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', authenticate, async (req: any, res, next) => {
  try {
    res.json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    next(error);
  }
});

export default router;