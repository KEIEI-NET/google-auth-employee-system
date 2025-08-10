import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import logger from '../utils/logger';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = err;

  // Handle Prisma errors
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any;
    if (prismaError.code === 'P2002') {
      error = new AppError(
        'Duplicate field value',
        400,
        'DUPLICATE_VALUE',
        { field: prismaError.meta?.target }
      );
    } else if (prismaError.code === 'P2025') {
      error = new AppError('Record not found', 404, 'NOT_FOUND');
    } else {
      error = new AppError(
        'Database operation failed',
        500,
        'DATABASE_ERROR'
      );
    }
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token', 401, 'INVALID_TOKEN');
  } else if (err.name === 'TokenExpiredError') {
    error = new AppError('Token expired', 401, 'TOKEN_EXPIRED');
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    error = new AppError(
      'Validation failed',
      400,
      'VALIDATION_ERROR',
      err.message
    );
  }

  // Default to 500 server error
  if (!(error instanceof AppError)) {
    error = new AppError(
      'An unexpected error occurred',
      500,
      'INTERNAL_ERROR'
    );
  }

  const appError = error as AppError;

  // Log error
  logger.error({
    message: appError.message,
    code: appError.code,
    statusCode: appError.statusCode,
    stack: appError.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Send error response
  res.status(appError.statusCode).json({
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(process.env.NODE_ENV === 'development' && {
        details: appError.details,
        stack: appError.stack,
      }),
    },
  });
};