import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create roles
  const roles = [
    { name: 'SUPER_ADMIN', description: 'Full system access', priority: 100 },
    { name: 'ADMIN', description: 'Administrative access', priority: 80 },
    { name: 'MANAGER', description: 'Team management access', priority: 60 },
    { name: 'EMPLOYEE', description: 'Standard employee access', priority: 40 },
    { name: 'VIEWER', description: 'Read-only access', priority: 20 },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  console.log('Roles created');

  // Create permissions
  const permissions = [
    // Employee permissions
    { resource: 'employee', action: 'create' },
    { resource: 'employee', action: 'read' },
    { resource: 'employee', action: 'update' },
    { resource: 'employee', action: 'delete' },
    
    // Role permissions
    { resource: 'role', action: 'create' },
    { resource: 'role', action: 'read' },
    { resource: 'role', action: 'update' },
    { resource: 'role', action: 'delete' },
    { resource: 'role', action: 'assign' },
    
    // Audit log permissions
    { resource: 'audit_log', action: 'read' },
    
    // Report permissions
    { resource: 'report', action: 'create' },
    { resource: 'report', action: 'read' },
    { resource: 'report', action: 'export' },
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        resource_action: {
          resource: permission.resource,
          action: permission.action,
        },
      },
      update: {},
      create: permission,
    });
  }

  console.log('Permissions created');

  // Assign permissions to roles
  const rolePermissionMappings = [
    // SUPER_ADMIN - all permissions
    { role: 'SUPER_ADMIN', permissions: permissions.map(p => `${p.resource}:${p.action}`) },
    
    // ADMIN - most permissions except role management
    { role: 'ADMIN', permissions: [
      'employee:create', 'employee:read', 'employee:update', 'employee:delete',
      'role:read', 'role:assign',
      'audit_log:read',
      'report:create', 'report:read', 'report:export',
    ]},
    
    // MANAGER - team management permissions
    { role: 'MANAGER', permissions: [
      'employee:read', 'employee:update',
      'role:read',
      'report:read', 'report:export',
    ]},
    
    // EMPLOYEE - basic permissions
    { role: 'EMPLOYEE', permissions: [
      'employee:read',
      'report:read',
    ]},
    
    // VIEWER - read-only
    { role: 'VIEWER', permissions: [
      'employee:read',
    ]},
  ];

  for (const mapping of rolePermissionMappings) {
    const role = await prisma.role.findUnique({
      where: { name: mapping.role },
    });

    if (role) {
      for (const permString of mapping.permissions) {
        const [resource, action] = permString.split(':');
        const permission = await prisma.permission.findUnique({
          where: {
            resource_action: { resource, action },
          },
        });

        if (permission) {
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: role.id,
                permissionId: permission.id,
              },
            },
            update: {},
            create: {
              roleId: role.id,
              permissionId: permission.id,
            },
          });
        }
      }
    }
  }

  console.log('Role permissions assigned');
  console.log('Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });