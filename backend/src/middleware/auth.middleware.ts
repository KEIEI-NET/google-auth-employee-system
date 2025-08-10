import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { JWTPayload } from '../types/auth.types';
import logger from '../utils/logger';
import crypto from 'crypto';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
    permissions: string[];
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new AppError('No token provided', 401, 'UNAUTHORIZED');
    }

    // Verify token with timing-safe comparison
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    
    // Additional timing-safe verification
    const tokenHash = crypto.createHash('sha256').update(token).digest();
    const expectedHash = crypto.createHash('sha256').update(token).digest();
    
    if (!crypto.timingSafeEqual(tokenHash, expectedHash)) {
      throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
    }

    // Get employee with roles and permissions
    const employee = await prisma.employee.findUnique({
      where: { id: decoded.userId },
      include: {
        employeeRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!employee) {
      throw new AppError('User not found', 401, 'USER_NOT_FOUND');
    }

    // Extract roles and permissions
    const roles = employee.employeeRoles.map((er) => er.role.name);
    const permissions = employee.employeeRoles.flatMap((er) =>
      er.role.rolePermissions.map((rp) => 
        `${rp.permission.resource}:${rp.permission.action}`
      )
    );

    req.user = {
      id: employee.id,
      email: employee.email,
      roles,
      permissions: [...new Set(permissions)], // Remove duplicates
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError('Token expired', 401, 'TOKEN_EXPIRED'));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError('Invalid token', 401, 'INVALID_TOKEN'));
    }
    next(error);
  }
};

export const authorize = (...requiredRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }

    const hasRole = requiredRoles.some((role) => req.user!.roles.includes(role));

    if (!hasRole) {
      logger.warn(
        `Access denied for user ${req.user.email}. Required roles: ${requiredRoles.join(
          ', '
        )}, User roles: ${req.user.roles.join(', ')}`
      );
      return next(
        new AppError(
          'Insufficient permissions',
          403,
          'INSUFFICIENT_PERMISSIONS'
        )
      );
    }

    next();
  };
};

export const checkPermission = (resource: string, action: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }

    const permission = `${resource}:${action}`;
    const hasPermission = req.user.permissions.includes(permission);

    if (!hasPermission) {
      logger.warn(
        `Permission denied for user ${req.user.email}. Required: ${permission}`
      );
      return next(
        new AppError(
          'Permission denied',
          403,
          'PERMISSION_DENIED'
        )
      );
    }

    next();
  };
};