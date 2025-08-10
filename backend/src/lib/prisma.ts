import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: [
      { level: 'warn', emit: 'event' },
      { level: 'info', emit: 'event' },
      { level: 'error', emit: 'event' },
    ],
  });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Log Prisma events
prisma.$on('warn' as any, (e: any) => {
  logger.warn('Prisma warning:', e);
});

prisma.$on('info' as any, (e: any) => {
  logger.info('Prisma info:', e);
});

prisma.$on('error' as any, (e: any) => {
  logger.error('Prisma error:', e);
});