import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisClient } from '../lib/redis';
import crypto from 'crypto';
import { Request } from 'express';

// Create a Redis store for rate limiting
const createRedisStore = (prefix: string) => {
  return new RedisStore({
    client: redisClient,
    prefix: `rl:${prefix}:`,
    sendCommand: (...args: string[]) => (redisClient as any).sendCommand(args),
  });
};

// Key generator that combines IP and User-Agent for better tracking
const keyGenerator = (req: Request): string => {
  const userAgent = req.get('User-Agent') || 'unknown';
  const userAgentHash = crypto.createHash('md5').update(userAgent).digest('hex');
  return `${req.ip}-${userAgentHash}`;
};

// General API rate limiter
export const apiLimiter = rateLimit({
  store: createRedisStore('api'),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each key to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
});

// Stricter rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  store: createRedisStore('auth'),
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
  store: createRedisStore('strict'),
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
    store: createRedisStore(prefix),
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
  await redisClient.setex(key, 3600, attempts.toString());
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
    store: createRedisStore(`role:${role}`),
    windowMs: 15 * 60 * 1000,
    max: Math.floor(100 * multiplier),
    message: `Rate limit for ${role} exceeded.`,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
  });
};