import request from 'supertest';
import app from '../../app';
import { prisma } from '../../lib/prisma';
import { redisClient } from '../../lib/redis';
import jwt from 'jsonwebtoken';

describe('Auth Integration Tests', () => {
  beforeAll(async () => {
    await redisClient.connect();
    await prisma.$connect();
  });

  afterAll(async () => {
    await redisClient.quit();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clear Redis data
    await redisClient.flushAll();
  });

  describe('GET /api/auth/google', () => {
    it('should return Google OAuth URL with state', async () => {
      const response = await request(app)
        .get('/api/auth/google')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.authUrl).toContain('accounts.google.com');
      expect(response.body.data.authUrl).toContain('code_challenge');
      expect(response.body.data.authUrl).toContain('code_challenge_method=S256');
      expect(response.body.data.state).toBeDefined();
      expect(response.body.data.state).toHaveLength(43);
    });

    it('should store state in Redis', async () => {
      const response = await request(app)
        .get('/api/auth/google')
        .expect(200);

      const state = response.body.data.state;
      const storedState = await redisClient.get(`oauth_state:${state}`);
      
      expect(storedState).toBeDefined();
      const parsedState = JSON.parse(storedState!);
      expect(parsedState.codeVerifier).toBeDefined();
      expect(parsedState.timestamp).toBeDefined();
    });
  });

  describe('POST /api/auth/google/callback', () => {
    it('should reject invalid state', async () => {
      const response = await request(app)
        .post('/api/auth/google/callback')
        .send({
          code: 'test-code',
          state: 'invalid-state',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_STATE');
    });

    it('should reject missing parameters', async () => {
      const response = await request(app)
        .post('/api/auth/google/callback')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should enforce rate limiting', async () => {
      // Make requests up to the limit
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/google/callback')
          .send({
            code: 'test-code',
            state: 'test-state',
          });
      }

      // This request should be rate limited
      const response = await request(app)
        .post('/api/auth/google/callback')
        .send({
          code: 'test-code',
          state: 'test-state',
        })
        .expect(429);

      expect(response.text).toContain('Too many attempts');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should reject when no refresh token provided', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_REFRESH_TOKEN');
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should refresh valid token', async () => {
      const userId = 'test-user-id';
      const email = 'test@example.com';
      const refreshToken = jwt.sign(
        { userId, email, type: 'refresh' },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: '7d' }
      );

      // Store refresh token in Redis
      await redisClient.setEx(
        `refresh_token:${userId}`,
        7 * 24 * 60 * 60,
        refreshToken
      );

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Token refreshed successfully');
      
      // Check for new access token cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('accessToken');
      expect(cookies[0]).toContain('HttpOnly');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return user data for authenticated request', async () => {
      const userId = 'test-user-id';
      const email = 'test@example.com';
      const accessToken = jwt.sign(
        { userId, email, type: 'access' },
        process.env.JWT_SECRET!,
        { expiresIn: '15m' }
      );

      // Mock employee in database
      const mockEmployee = {
        id: userId,
        googleId: 'google-123',
        email,
        name: 'Test User',
        profilePicture: null,
        department: null,
        position: null,
        phoneNumber: null,
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.employee.findUnique as jest.Mock).mockResolvedValue({
        ...mockEmployee,
        employeeRoles: [
          {
            role: {
              name: 'EMPLOYEE',
              rolePermissions: [
                { permission: { resource: 'profile', action: 'read' } },
              ],
            },
          },
        ],
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', `accessToken=${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(userId);
      expect(response.body.data.email).toBe(email);
      expect(response.body.data.roles).toContain('EMPLOYEE');
      expect(response.body.data.permissions).toContain('profile:read');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should clear tokens and logout', async () => {
      const userId = 'test-user-id';
      const email = 'test@example.com';
      const accessToken = jwt.sign(
        { userId, email, type: 'access' },
        process.env.JWT_SECRET!,
        { expiresIn: '15m' }
      );

      // Mock employee
      (prisma.employee.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        email,
        employeeRoles: [],
      });

      // Store refresh token
      await redisClient.setEx(
        `refresh_token:${userId}`,
        7 * 24 * 60 * 60,
        'test-refresh-token'
      );

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', `accessToken=${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Logged out successfully');
      
      // Check cookies are cleared
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('accessToken=;');
      expect(cookies[1]).toContain('refreshToken=;');
      
      // Check refresh token is revoked
      const storedToken = await redisClient.get(`refresh_token:${userId}`);
      expect(storedToken).toBeNull();
    });
  });
});