import rateLimit from 'express-rate-limit';
import { redisClient } from '../lib/redis';
import crypto from 'crypto';
import { Request } from 'express';

// Custom Redis store implementation for rate-limit
class CustomRedisStore {
  constructor(private prefix: string) {}

  async increment(key: string): Promise<{ totalHits: number; resetTime?: Date }> {
    const fullKey = `${this.prefix}:${key}`;
    const now = Date.now();
    const window = 15 * 60 * 1000; // 15 minutes in ms
    const expiry = Math.ceil(window / 1000); // Convert to seconds for Redis
    
    // Increment the counter
    const count = await redisClient.incr(fullKey);
    
    // Set expiry only if this is the first request in the window
    if (count === 1) {
      await redisClient.expire(fullKey, expiry);
    }
    
    // Get TTL to calculate reset time
    const ttl = await redisClient.ttl(fullKey);
    const resetTime = ttl > 0 ? new Date(now + ttl * 1000) : new Date(now + window);
    
    return {
      totalHits: count,
      resetTime,
    };
  }

  async decrement(key: string): Promise<void> {
    const fullKey = `${this.prefix}:${key}`;
    const current = await redisClient.get(fullKey);
    if (current && parseInt(current) > 0) {
      await redisClient.decr(fullKey);
    }
  }

  async resetKey(key: string): Promise<void> {
    const fullKey = `${this.prefix}:${key}`;
    await redisClient.del(fullKey);
  }
}

// Key generator that combines IP and User-Agent for better tracking
const keyGenerator = (req: Request): string => {
  const userAgent = req.get('User-Agent') || 'unknown';
  const userAgentHash = crypto.createHash('md5').update(userAgent).digest('hex');
  return `${req.ip}-${userAgentHash}`;
};

// General API rate limiter with Redis
export const apiLimiter = rateLimit({
  store: new CustomRedisStore('rl:api') as any,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each key to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
});

// Stricter rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  store: new CustomRedisStore('rl:auth') as any,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 auth attempts per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  keyGenerator,
});

// Even stricter rate limiter for password reset/sensitive operations
export const strictLimiter = rateLimit({
  store: new CustomRedisStore('rl:strict') as any,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 attempts per hour
  message: 'Too many attempts for this sensitive operation. Please wait before trying again.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator,
});

// Progressive rate limiter with penalties for repeated failures
export const createProgressiveLimiter = (baseMax: number, windowMs: number, prefix: string) => {
  return rateLimit({
    store: new CustomRedisStore(`rl:${prefix}`) as any,
    windowMs,
    max: async (req: Request) => {
      // Get the number of failed attempts from Redis
      const key = `failed_attempts:${keyGenerator(req)}`;
      const failedAttempts = await redisClient.get(key);
      const attempts = parseInt(failedAttempts || '0', 10);
      
      // Reduce allowed attempts based on failures
      const reducedMax = Math.max(1, baseMax - Math.floor(attempts / 2));
      return reducedMax;
    },
    message: 'Rate limit exceeded. Your limit has been reduced due to repeated failures.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
  });
};

// Track failed authentication attempts
export const trackFailedAttempt = async (req: Request): Promise<void> => {
  const key = `failed_attempts:${keyGenerator(req)}`;
  const current = await redisClient.get(key);
  const attempts = parseInt(current || '0', 10) + 1;
  
  // Store with 1 hour expiry
  await redisClient.setEx(key, 3600, attempts.toString());
};

// Clear failed attempts on successful authentication
export const clearFailedAttempts = async (req: Request): Promise<void> => {
  const key = `failed_attempts:${keyGenerator(req)}`;
  await redisClient.del(key);
};

// Role-based rate limit multipliers
export const getRoleLimiter = (role: string) => {
  const multipliers: Record<string, number> = {
    SUPER_ADMIN: 10,
    ADMIN: 5,
    MANAGER: 2,
    EMPLOYEE: 1.5,
    VIEWER: 1,
  };
  
  const multiplier = multipliers[role] || 1;
  
  return rateLimit({
    store: new CustomRedisStore(`rl:role:${role}`) as any,
    windowMs: 15 * 60 * 1000,
    max: Math.floor(100 * multiplier),
    message: `Rate limit for ${role} exceeded.`,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
  });
};