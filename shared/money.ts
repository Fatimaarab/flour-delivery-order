/**
 * کار با مبالغ ریالی.
 *
 * قاعده ثابت سامانه: مبالغ همیشه **ریال** و **عدد صحیح**‌اند. هرگز اعشاری
 * نمی‌شوند، چون اعداد اعشاری در کامپیوتر دقیق نیستند و در جمع فاکتورها
 * اختلاف چند ریالی می‌سازند.
 */

import { normalizeNumeric } from './digits.js';

/** نمایش مبلغ با جداکننده هزارگان و ارقام فارسی. */
export function formatRial(amount: number | bigint): string {
  return Number(amount).toLocaleString('fa-IR', { maximumFractionDigits: 0 });
}

/** نمایش کامل با واحد. */
export function formatRialWithUnit(amount: number | bigint): string {
  return `${formatRial(amount)} ریال`;
}

/**
 * ورودی مبلغ کاربر را به عدد صحیح تبدیل می‌کند.
 * ارقام فارسی و جداکننده هزارگان را می‌پذیرد. اگر معتبر نباشد null می‌دهد.
 */
export function parseRial(input: string): number | null {
  const cleaned = normalizeNumeric(input);
  if (!cleaned || !/^\d+$/.test(cleaned)) return null;

  const value = Number(cleaned);
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * محاسبه مالیات بر ارزش افزوده.
 *
 * نتیجه به نزدیک‌ترین ریال گرد می‌شود تا هرگز مبلغ اعشاری تولید نشود.
 */
export function calculateVat(baseAmount: number, vatPercent: number): number {
  return Math.round((baseAmount * vatPercent) / 100);
}
