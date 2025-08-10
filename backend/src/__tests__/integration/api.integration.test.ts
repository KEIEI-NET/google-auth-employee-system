import request from 'supertest';
import app from '../../app';
import { redisClient } from '../../lib/redis';

describe('API Integration Tests', () => {
  beforeAll(async () => {
    await redisClient.connect();
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  beforeEach(async () => {
    // Clear rate limit data
    const keys = await redisClient.keys('rl:*');
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.services).toBeDefined();
      expect(response.body.services.database).toBe('connected');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limiting on API endpoints', async () => {
      // Make requests up to the limit
      const requests = [];
      for (let i = 0; i < 100; i++) {
        requests.push(
          request(app)
            .get('/api/auth/me')
            .set('X-Forwarded-For', '127.0.0.1')
        );
      }
      
      await Promise.all(requests);

      // This request should be rate limited
      const response = await request(app)
        .get('/api/auth/me')
        .set('X-Forwarded-For', '127.0.0.1')
        .expect(429);

      expect(response.text).toContain('Too many requests');
      expect(response.headers['x-ratelimit-limit']).toBe('100');
      expect(response.headers['x-ratelimit-remaining']).toBe('0');
    });

    it('should have separate limits for different IPs', async () => {
      // Max out rate limit for first IP
      const requests1 = [];
      for (let i = 0; i < 100; i++) {
        requests1.push(
          request(app)
            .get('/api/auth/me')
            .set('X-Forwarded-For', '192.168.1.1')
        );
      }
      await Promise.all(requests1);

      // Different IP should still be able to make requests
      const response = await request(app)
        .get('/api/auth/me')
        .set('X-Forwarded-For', '192.168.1.2')
        .expect(401); // Unauthorized, but not rate limited

      expect(response.text).not.toContain('Too many requests');
    });

    it('should have stricter limits for auth endpoints', async () => {
      // Auth endpoints have limit of 5
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          request(app)
            .post('/api/auth/google/callback')
            .set('X-Forwarded-For', '127.0.0.1')
            .send({ code: 'test', state: 'test' })
        );
      }
      
      await Promise.all(requests);

      // This request should be rate limited
      const response = await request(app)
        .post('/api/auth/google/callback')
        .set('X-Forwarded-For', '127.0.0.1')
        .send({ code: 'test', state: 'test' })
        .expect(429);

      expect(response.text).toContain('Too many');
    });
  });

  describe('CORS', () => {
    it('should allow requests from allowed origins', async () => {
      const response = await request(app)
        .get('/api/auth/google')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should reject requests from disallowed origins', async () => {
      const response = await request(app)
        .get('/api/auth/google')
        .set('Origin', 'http://evil.com')
        .expect(500);

      expect(response.text).toContain('Not allowed by CORS');
    });

    it('should handle preflight requests', async () => {
      const response = await request(app)
        .options('/api/auth/google')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type')
        .expect(204);

      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
    });
  });

  describe('Security Headers', () => {
    it('should set security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('0');
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should set Content-Security-Policy', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toBe('Resource not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle JSON parsing errors', async () => {
      const response = await request(app)
        .post('/api/auth/google/callback')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle large payloads', async () => {
      const largePayload = 'x'.repeat(11 * 1024 * 1024); // 11MB
      
      const response = await request(app)
        .post('/api/auth/google/callback')
        .send({ data: largePayload })
        .expect(413);

      expect(response.text).toContain('too large');
    });
  });
});