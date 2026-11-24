import { prisma } from '../lib/prisma.js';

/**
 * فیلدهای راننده و حمل که هر حواله در آزمون‌ها باید داشته باشد.
 *
 * راننده یک‌بار ساخته می‌شود و بین آزمون‌ها مشترک است (کد ملی یکتاست).
 */
export async function driverFields() {
  const nationalId = '0499370899';
  const driver = await prisma.driver.upsert({
    where: { nationalId },
    update: { isActive: true },
    create: { fullName: 'اصغر محمدی', nationalId, mobile: '09123456789', plateNumber: '44ع789ایران77' },
  });
  return { driverId: driver.id, haulType: 'SELF' as const };
}
