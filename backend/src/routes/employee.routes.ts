import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticate, authorize, checkPermission } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { createAuditLog } from '../services/auditLog.service';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const router = Router();
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// Get all employees
router.get(
  '/',
  authenticate,
  checkPermission('employee', 'read'),
  async (req: any, res, next) => {
    try {
      const { page = 1, limit = 10, search, role, isActive } = req.query;
      
      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);
      
      const where: any = {};
      
      if (search) {
        const sanitizedSearch = purify.sanitize(search as string);
        where.OR = [
          { name: { contains: sanitizedSearch, mode: 'insensitive' } },
          { email: { contains: sanitizedSearch, mode: 'insensitive' } },
        ];
      }
      
      if (role) {
        where.employeeRoles = {
          some: {
            role: {
              name: role,
            },
          },
        };
      }
      
      if (isActive !== undefined) {
        where.isActive = isActive === 'true';
      }
      
      const [employees, total] = await Promise.all([
        prisma.employee.findMany({
          where,
          skip,
          take,
          include: {
            employeeRoles: {
              include: {
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
        prisma.employee.count({ where }),
      ]);
      
      const formattedEmployees = employees.map((emp) => ({
        id: emp.id,
        email: emp.email,
        name: emp.name,
        profilePicture: emp.profilePicture,
        department: emp.department,
        position: emp.position,
        isActive: emp.isActive,
        roles: emp.employeeRoles.map((er) => er.role.name),
        lastLoginAt: emp.lastLoginAt,
        createdAt: emp.createdAt,
      }));
      
      res.json({
        success: true,
        data: {
          employees: formattedEmployees,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get employee by ID
router.get(
  '/:id',
  authenticate,
  checkPermission('employee', 'read'),
  param('id').isUUID().withMessage('Invalid employee ID'),
  async (req: any, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(
          'Validation failed',
          400,
          'VALIDATION_ERROR',
          errors.array()
        );
      }
      
      const employee = await prisma.employee.findUnique({
        where: { id: req.params.id },
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
        throw new AppError('Employee not found', 404, 'EMPLOYEE_NOT_FOUND');
      }
      
      const formattedEmployee = {
        id: employee.id,
        email: employee.email,
        name: employee.name,
        profilePicture: employee.profilePicture,
        department: employee.department,
        position: employee.position,
        phoneNumber: employee.phoneNumber,
        isActive: employee.isActive,
        roles: employee.employeeRoles.map((er) => ({
          id: er.role.id,
          name: er.role.name,
          assignedAt: er.assignedAt,
          permissions: er.role.rolePermissions.map((rp) => ({
            resource: rp.permission.resource,
            action: rp.permission.action,
          })),
        })),
        lastLoginAt: employee.lastLoginAt,
        createdAt: employee.createdAt,
        updatedAt: employee.updatedAt,
      };
      
      res.json({
        success: true,
        data: formattedEmployee,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update employee
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  checkPermission('employee', 'update'),
  [
    param('id').isUUID().withMessage('Invalid employee ID'),
    body('name').optional().isString().trim(),
    body('department').optional().isString().trim(),
    body('position').optional().isString().trim(),
    body('phoneNumber').optional().isString().trim(),
    body('isActive').optional().isBoolean(),
  ],
  async (req: any, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(
          'Validation failed',
          400,
          'VALIDATION_ERROR',
          errors.array()
        );
      }
      
      const { name, department, position, phoneNumber, isActive } = req.body;
      
      // Sanitize input
      const updateData: any = {};
      if (name !== undefined) updateData.name = purify.sanitize(name);
      if (department !== undefined) updateData.department = purify.sanitize(department);
      if (position !== undefined) updateData.position = purify.sanitize(position);
      if (phoneNumber !== undefined) updateData.phoneNumber = purify.sanitize(phoneNumber);
      if (isActive !== undefined) updateData.isActive = isActive;
      
      const employee = await prisma.employee.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          employeeRoles: {
            include: {
              role: true,
            },
          },
        },
      });
      
      // Create audit log
      await createAuditLog({
        employeeId: req.user.id,
        action: 'UPDATE_EMPLOYEE',
        resource: 'EMPLOYEE',
        resourceId: employee.id,
        details: { updatedFields: Object.keys(updateData) },
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || '',
      });
      
      res.json({
        success: true,
        data: {
          id: employee.id,
          email: employee.email,
          name: employee.name,
          department: employee.department,
          position: employee.position,
          phoneNumber: employee.phoneNumber,
          isActive: employee.isActive,
          roles: employee.employeeRoles.map((er) => er.role.name),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Assign role to employee
router.post(
  '/:id/roles',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  checkPermission('role', 'assign'),
  [
    param('id').isUUID().withMessage('Invalid employee ID'),
    body('roleId').isUUID().withMessage('Invalid role ID'),
  ],
  async (req: any, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(
          'Validation failed',
          400,
          'VALIDATION_ERROR',
          errors.array()
        );
      }
      
      const { roleId } = req.body;
      const employeeId = req.params.id;
      
      // Check if role exists
      const role = await prisma.role.findUnique({
        where: { id: roleId },
      });
      
      if (!role) {
        throw new AppError('Role not found', 404, 'ROLE_NOT_FOUND');
      }
      
      // Create employee role
      await prisma.employeeRole.create({
        data: {
          employeeId,
          roleId,
          assignedBy: req.user.id,
        },
      });
      
      // Create audit log
      await createAuditLog({
        employeeId: req.user.id,
        action: 'ASSIGN_ROLE',
        resource: 'EMPLOYEE_ROLE',
        resourceId: employeeId,
        details: { roleId, roleName: role.name },
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || '',
      });
      
      res.json({
        success: true,
        data: {
          message: 'Role assigned successfully',
          role: role.name,
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        return next(
          new AppError('Employee already has this role', 400, 'DUPLICATE_ROLE')
        );
      }
      next(error);
    }
  }
);

export default router;