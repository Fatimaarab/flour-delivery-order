import type { Prisma } from '@prisma/client';
import { dateToJalali } from '../../../shared/jalaliDate.js';

/**
 * تولید شماره سریال یکتا و پیوسته حواله.
 *
 * ── قانون شماره‌گذاری ────────────────────────────────────────────────────
 * شماره از دو بخش ساخته می‌شود: سال شمسی صدور، و یک شمارنده که **هر سال از
 * نو شروع می‌شود** — مثل همان دفتر کاغذی کارخانه:
 *
 *   ۲۹ اسفند ۱۴۰۵  →  1405-0742
 *   ۱ فروردین ۱۴۰۶ →  1406-0001
 *
 * پیش از این پیشوند یک مقدار ثابت «1405» در تنظیمات بود و شمارنده هم هرگز
 * صفر نمی‌شد؛ یعنی از فروردین ۱۴۰۶ همه حواله‌ها همچنان با سال ۱۴۰۵ شماره
 * می‌خوردند و شماره‌ها از سال قبل ادامه پیدا می‌کرد. حالا سال از خود تاریخ
 * گرفته می‌شود و هیچ تنظیمی لازم نیست که کسی یادش بماند عوضش کند.
 *
 * ── چرا شمارنده جداگانه برای هر سال ──────────────────────────────────────
 * شمارنده هر سال در کلید خودش نگهداری می‌شود (`receipt_serial_last:1406`)،
 * پس شروع سال جدید خودبه‌خود از ۱ آغاز می‌شود و به شمارنده سال قبل دست
 * نمی‌خورد — حتی اگر حواله‌ای از سال قبل دیرتر ثبت شود.
 * ────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ این تابع باید **داخل یک تراکنش** صدا زده شود. شمارنده در همان تراکنشی
 * خوانده و افزایش داده می‌شود که حواله ساخته می‌شود؛ بنابراین حتی اگر دو
 * کاربر دقیقاً همزمان حواله صادر کنند، غیرممکن است شماره تکراری بگیرند.
 */

/** کلید شمارنده سالی که این پیشوند به آن تعلق دارد. */
function counterKey(prefix: string): string {
  return `receipt_serial_last:${prefix}`;
}

/** سال شمسی که شماره حواله با آن شروع می‌شود. */
export function serialPrefixFor(date: Date): string {
  return String(dateToJalali(date).jy);
}

/**
 * بزرگ‌ترین شماره‌ای که تا حالا با این پیشوند صادر شده.
 *
 * فقط وقتی لازم می‌شود که شمارنده آن سال هنوز وجود نداشته باشد — یعنی اولین
 * حواله سال جدید، یا دیتابیسی که از پشتیبان برگردانده شده و شمارنده‌اش عقب
 * است. در این حالت شماره از روی خود حواله‌های موجود بازسازی می‌شود تا هیچ
 * شماره‌ای دوبار صادر نشود.
 *
 * حواله‌های باطل‌شده و حذف‌شده هم شمرده می‌شوند: شماره یک سند رسمی هرگز
 * بازاستفاده نمی‌شود.
 */
async function highestIssued(tx: Prisma.TransactionClient, prefix: string): Promise<number> {
  const rows = await tx.receipt.findMany({
    where: { receiptNumber: { startsWith: `${prefix}-` } },
    select: { receiptNumber: true },
  });

  let max = 0;
  for (const { receiptNumber } of rows) {
    // مقایسه عددی، نه متنی: در مقایسه متنی «9999» از «10000» بزرگ‌تر درمی‌آید
    const n = Number(receiptNumber.slice(prefix.length + 1));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

export async function nextReceiptNumber(
  tx: Prisma.TransactionClient,
  now: Date = new Date(),
): Promise<string> {
  const prefix = serialPrefixFor(now);
  const key = counterKey(prefix);

  const row = await tx.setting.findUnique({ where: { key } });
  const stored = row ? Number(row.value) : NaN;
  const last = Number.isFinite(stored) ? stored : await highestIssued(tx, prefix);

  const next = last + 1;

  await tx.setting.upsert({
    where: { key },
    update: { value: String(next) },
    create: { key, value: String(next) },
  });

  // padStart فقط کف چهار رقم را تضمین می‌کند؛ از ۱۰۰۰۰ به بعد خودش پنج رقم
  // می‌شود و چیزی نمی‌شکند.
  return `${prefix}-${String(next).padStart(4, '0')}`;
}
