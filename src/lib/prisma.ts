import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

// Cache on globalThis in every environment: reuses one client per warm serverless instance
// (and across HMR in dev) so Vercel + Neon connections are not exhausted.
globalForPrisma.prisma = prisma;
