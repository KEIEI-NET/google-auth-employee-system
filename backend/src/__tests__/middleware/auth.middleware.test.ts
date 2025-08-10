import { Request, Response, NextFunction } from 'express';
import { authenticate, authorize, checkPermission } from '../../middleware/auth.middleware';
import { prisma } from '../../lib/prisma';
import jwt from 'jsonwebtoken';
import { AppError } from '../../utils/AppError';

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      cookies: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
  });

  describe('authenticate', () => {
    it('should authenticate with valid token from cookies', async () => {
      const userId = 'user-123';
      const token = jwt.sign(
        { userId, email: 'test@example.com', type: 'access' },
        process.env.JWT_SECRET!,
        { expiresIn: '15m' }
      );
      
      const mockEmployee = {
        id: userId,
        email: 'test@example.com',
        employeeRoles: [
          {
            role: {
              name: 'ADMIN',
              rolePermissions: [
                { permission: { resource: 'employee', action: 'read' } },
              ],
            },
          },
        ],
      };
      
      mockRequest.cookies = { accessToken: token };
      (prisma.employee.findUnique as jest.Mock).mockResolvedValue(mockEmployee);
      
      await authenticate(mockRequest as any, mockResponse as Response, nextFunction);
      
      expect(nextFunction).toHaveBeenCalledWith();
      expect((mockRequest as any).user).toEqual({
        id: userId,
        email: 'test@example.com',
        roles: ['ADMIN'],
        permissions: ['employee:read'],
      });
    });

    it('should authenticate with valid token from Authorization header', async () => {
      const userId = 'user-123';
      const token = jwt.sign(
        { userId, email: 'test@example.com', type: 'access' },
        process.env.JWT_SECRET!,
        { expiresIn: '15m' }
      );
      
      const mockEmployee = {
        id: userId,
        email: 'test@example.com',
        employeeRoles: [],
      };
      
      mockRequest.headers = { authorization: `Bearer ${token}` };
      (prisma.employee.findUnique as jest.Mock).mockResolvedValue(mockEmployee);
      
      await authenticate(mockRequest as any, mockResponse as Response, nextFunction);
      
      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should reject when no token provided', async () => {
      await authenticate(mockRequest as any, mockResponse as Response, nextFunction);
      
      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'No token provided',
          statusCode: 401,
        })
      );
    });

    it('should reject expired token', async () => {
      const token = jwt.sign(
        { userId: 'user-123', email: 'test@example.com', type: 'access' },
        process.env.JWT_SECRET!,
        { expiresIn: '-1h' }
      );
      
      mockRequest.cookies = { accessToken: token };
      
      await authenticate(mockRequest as any, mockResponse as Response, nextFunction);
      
      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Token expired',
          statusCode: 401,
        })
      );
    });

    it('should reject invalid token', async () => {
      mockRequest.cookies = { accessToken: 'invalid-token' };
      
      await authenticate(mockRequest as any, mockResponse as Response, nextFunction);
      
      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid token',
          statusCode: 401,
        })
      );
    });

    it('should reject when user not found', async () => {
      const token = jwt.sign(
        { userId: 'user-123', email: 'test@example.com', type: 'access' },
        process.env.JWT_SECRET!,
        { expiresIn: '15m' }
      );
      
      mockRequest.cookies = { accessToken: token };
      (prisma.employee.findUnique as jest.Mock).mockResolvedValue(null);
      
      await authenticate(mockRequest as any, mockResponse as Response, nextFunction);
      
      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User not found',
          statusCode: 401,
        })
      );
    });
  });

  describe('authorize', () => {
    it('should allow user with required role', () => {
      (mockRequest as any).user = {
        id: 'user-123',
        email: 'test@example.com',
        roles: ['ADMIN', 'MANAGER'],
        permissions: [],
      };
      
      const middleware = authorize('ADMIN');
      middleware(mockRequest as any, mockResponse as Response, nextFunction);
      
      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should allow user with any of required roles', () => {
      (mockRequest as any).user = {
        id: 'user-123',
        email: 'test@example.com',
        roles: ['MANAGER'],
        permissions: [],
      };
      
      const middleware = authorize('ADMIN', 'MANAGER');
      middleware(mockRequest as any, mockResponse as Response, nextFunction);
      
      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should reject user without required role', () => {
      (mockRequest as any).user = {
        id: 'user-123',
        email: 'test@example.com',
        roles: ['EMPLOYEE'],
        permissions: [],
      };
      
      const middleware = authorize('ADMIN');
      middleware(mockRequest as any, mockResponse as Response, nextFunction);
      
      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Insufficient permissions',
          statusCode: 403,
        })
      );
    });

    it('should reject when no user in request', () => {
      const middleware = authorize('ADMIN');
      middleware(mockRequest as any, mockResponse as Response, nextFunction);
      
      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Authentication required',
          statusCode: 401,
        })
      );
    });
  });

  describe('checkPermission', () => {
    it('should allow user with required permission', () => {
      (mockRequest as any).user = {
        id: 'user-123',
        email: 'test@example.com',
        roles: ['ADMIN'],
        permissions: ['employee:read', 'employee:write'],
      };
      
      const middleware = checkPermission('employee', 'read');
      middleware(mockRequest as any, mockResponse as Response, nextFunction);
      
      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should reject user without required permission', () => {
      (mockRequest as any).user = {
        id: 'user-123',
        email: 'test@example.com',
        roles: ['EMPLOYEE'],
        permissions: ['employee:read'],
      };
      
      const middleware = checkPermission('employee', 'delete');
      middleware(mockRequest as any, mockResponse as Response, nextFunction);
      
      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Permission denied',
          statusCode: 403,
        })
      );
    });

    it('should reject when no user in request', () => {
      const middleware = checkPermission('employee', 'read');
      middleware(mockRequest as any, mockResponse as Response, nextFunction);
      
      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Authentication required',
          statusCode: 401,
        })
      );
    });
  });
});