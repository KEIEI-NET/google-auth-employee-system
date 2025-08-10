import { prisma } from '../lib/prisma';
import logger from '../utils/logger';

interface AuditLogData {
  employeeId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
  errorMessage?: string;
}

export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        employeeId: data.employeeId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        details: data.details,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        success: data.success ?? true,
        errorMessage: data.errorMessage,
      },
    });
    
    logger.info('Audit log created', {
      action: data.action,
      resource: data.resource,
      employeeId: data.employeeId,
    });
  } catch (error) {
    logger.error('Failed to create audit log', {
      error,
      auditData: data,
    });
    // Don't throw error to prevent disrupting the main flow
  }
}

export async function getAuditLogs(
  filters: {
    employeeId?: string;
    action?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
  },
  pagination: {
    page: number;
    limit: number;
  }
) {
  const where: any = {};
  
  if (filters.employeeId) {
    where.employeeId = filters.employeeId;
  }
  
  if (filters.action) {
    where.action = filters.action;
  }
  
  if (filters.resource) {
    where.resource = filters.resource;
  }
  
  if (filters.startDate || filters.endDate) {
    where.timestamp = {};
    if (filters.startDate) {
      where.timestamp.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.timestamp.lte = filters.endDate;
    }
  }
  
  const skip = (pagination.page - 1) * pagination.limit;
  
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: pagination.limit,
      orderBy: {
        timestamp: 'desc',
      },
      include: {
        employee: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);
  
  return {
    logs,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
}