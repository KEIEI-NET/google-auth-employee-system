import { AppError } from '../../utils/AppError';

describe('AppError', () => {
  it('should create error with default values', () => {
    const error = new AppError('Test error');
    
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.isOperational).toBe(true);
    expect(error.details).toBeUndefined();
  });

  it('should create error with custom values', () => {
    const details = { field: 'email', value: 'invalid' };
    const error = new AppError(
      'Validation failed',
      400,
      'VALIDATION_ERROR',
      details
    );
    
    expect(error.message).toBe('Validation failed');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.isOperational).toBe(true);
    expect(error.details).toEqual(details);
  });

  it('should be instanceof Error', () => {
    const error = new AppError('Test error');
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it('should have stack trace', () => {
    const error = new AppError('Test error');
    
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('AppError');
  });

  it('should handle different status codes', () => {
    const badRequest = new AppError('Bad request', 400, 'BAD_REQUEST');
    const unauthorized = new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    const forbidden = new AppError('Forbidden', 403, 'FORBIDDEN');
    const notFound = new AppError('Not found', 404, 'NOT_FOUND');
    const serverError = new AppError('Server error', 500, 'SERVER_ERROR');
    
    expect(badRequest.statusCode).toBe(400);
    expect(unauthorized.statusCode).toBe(401);
    expect(forbidden.statusCode).toBe(403);
    expect(notFound.statusCode).toBe(404);
    expect(serverError.statusCode).toBe(500);
  });
});