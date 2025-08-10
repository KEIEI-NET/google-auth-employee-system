import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthService } from '../services/auth.service';
import { authenticate } from '../middleware/auth.middleware';
import { AppError } from '../utils/AppError';
import logger from '../utils/logger';

const router = Router();

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
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Refresh access token
router.post(
  '/refresh',
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
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

      const { refreshToken } = req.body;
      
      // Validate refresh token
      const { userId, email } = await AuthService.validateRefreshToken(
        refreshToken
      );
      
      // Generate new access token
      const tokens = AuthService.generateTokens(userId, email);
      
      res.json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Logout
router.post('/logout', authenticate, async (req: any, res, next) => {
  try {
    // Revoke refresh token
    await AuthService.revokeRefreshToken(req.user.id);
    
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