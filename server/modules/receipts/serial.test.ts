import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { nextReceiptNumber, serialPrefixFor } from './serial.js';
import { jalaliToDate } from '../../../shared/jalaliDate.js';

/**
 * ── چرا این تست مهم است ──────────────────────────────────────────────────
 * شماره حواله شماره یک سند رسمی است. دو خطا اینجا گران تمام می‌شود:
 *
 *   ۱. شماره تکراری — دو بار صادر شدن یک شماره.
 *   ۲. سال اشتباه — که تا پایان سال مالی معلوم نمی‌شود.
 *
 * هر دو از نوع خطاهایی هستند که بی‌صدا می‌مانند، پس اینجا مستقیم سنجیده
 * می‌شوند.
 * ────────────────────────────────────────────────────────────────────────
 */

/** گرفتن شماره بعدی در یک تراکنش، با تاریخ دلخواه. */
function nextOn(jy: number, jm: number, jd: number) {
  return prisma.$transaction((tx) => nextReceiptNumber(tx, jalaliToDate(jy, jm, jd)));
}

/** پاک کردن شمارنده‌های سال‌هایی که این تست می‌سازد. */
async function resetCounters() {
  await prisma.setting.deleteMany({
    where: { key: { startsWith: 'receipt_serial_last:' } },
  });
}

describe('شماره‌گذاری حواله', () => {
  beforeEach(resetCounters);

  it('سال شمسی را از تاریخ صدور می‌گیرد، نه از تنظیمات', () => {
    expect(serialPrefixFor(jalaliToDate(1405, 12, 29))).toBe('1405');
    expect(serialPrefixFor(jalaliToDate(1406, 1, 1))).toBe('1406');
    expect(serialPrefixFor(jalaliToDate(1410, 6, 15))).toBe('1410');
  });

  it('در طول یک سال پشت سر هم جلو می‌رود', async () => {
    const a = await nextOn(1409, 3, 10);
    const b = await nextOn(1409, 3, 10);
    const c = await nextOn(1409, 8, 22);

    expect(a).toBe('1409-0001');
    expect(b).toBe('1409-0002');
    expect(c).toBe('1409-0003');
  });

  it('با شروع سال نو از ۱ شروع می‌شود', async () => {
    await nextOn(1409, 12, 29);
    await nextOn(1409, 12, 29);
    const last = await nextOn(1409, 12, 29);
    expect(last).toBe('1409-0003');

    // ۱ فروردین سال بعد
    const first = await nextOn(1410, 1, 1);
    expect(first).toBe('1410-0001');
  });

  it('شمارنده سال قبل دست‌نخورده می‌ماند', async () => {
    await nextOn(1409, 12, 29);
    await nextOn(1410, 1, 1);

    // حواله‌ای که دیرتر برای سال قبل ثبت می‌شود، از شمارنده همان سال ادامه می‌دهد
    expect(await nextOn(1409, 12, 25)).toBe('1409-0002');
    expect(await nextOn(1410, 1, 5)).toBe('1410-0002');
  });

  it('قالب شماره همان قالب فرم کاغذی است', async () => {
    expect(await nextOn(1407, 5, 5)).toMatch(/^\d{4}-\d{4}$/);
  });

  describe('وقتی شمارنده گم شده باشد — مثلاً پس از بازگردانی پشتیبان', () => {
    it('شماره را از روی حواله‌های موجود بازسازی می‌کند و تکراری نمی‌دهد', async () => {
      const n1 = await nextOn(1411, 2, 2);
      const n2 = await nextOn(1411, 2, 2);
      expect(n2).toBe('1411-0002');

      // شمارنده پاک می‌شود، اما خود حواله‌ها سر جایشان هستند
      const customer = await prisma.customer.findFirstOrThrow();
      const user = await prisma.user.findFirstOrThrow();
      for (const receiptNumber of [n1, n2]) {
        await prisma.receipt.create({
          data: {
            receiptNumber,
            status: 'DRAFT',
            customerId: customer.id,
            issuedById: user.id,
            validUntil: new Date(),
            totalWeightKg: 0,
          },
        });
      }
      await resetCounters();

      // نباید دوباره 0001 بدهد
      expect(await nextOn(1411, 2, 2)).toBe('1411-0003');

      await prisma.receipt.deleteMany({ where: { receiptNumber: { startsWith: '1411-' } } });
    });
  });
});
