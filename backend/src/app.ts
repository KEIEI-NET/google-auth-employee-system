import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import { json, urlencoded } from 'body-parser';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { apiLimiter, authLimiter } from './middleware/rateLimiter';
import authRoutes from './routes/auth.routes';
import employeeRoutes from './routes/employee.routes';
import { prisma } from './lib/prisma';
import { redisClient } from './lib/redis';
import logger from './utils/logger';
import { validateEnv } from './config/env.validation';

// Validate environment variables
validateEnv();

const app = express();

// Cookie parser (must be before CORS)
app.use(cookieParser());

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://apis.google.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://accounts.google.com'],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    permissionsPolicy: {
      geolocation: [],
      microphone: [],
      camera: [],
    },
  })
);

// CORS configuration with cookie support
const corsOptions: cors.CorsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Enable cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(json({ limit: '10mb' }));
app.use(urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Request logging
app.use(requestLogger);

// Rate limiting with Redis store
app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);

// Health check endpoint (no rate limiting)
app.get('/health', async (req, res, next) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Check Redis connection
    const redisStatus = redisClient.status === 'ready';
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: redisStatus ? 'connected' : 'disconnected',
      },
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Service unavailable',
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Resource not found',
    },
  });
});

// Global error handler
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  await prisma.$disconnect();
  await redisClient.quit();
  process.exit(0);
});

export default app;