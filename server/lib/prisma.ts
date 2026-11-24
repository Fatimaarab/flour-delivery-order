import { PrismaClient } from '@prisma/client';

/**
 * یک نمونه مشترک از کلاینت دیتابیس.
 *
 * در حالت توسعه، هر بار که سرور دوباره بارگذاری می‌شود یک نمونه تازه ساخته
 * می‌شود و اتصال‌های قبلی باز می‌مانند؛ نگه‌داشتن نمونه روی globalThis از این
 * نشتی جلوگیری می‌کند.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
