/**
 * خروجی اکسل گزارش‌ها.
 *
 * فرمت خروجی CSV با جداکننده ویرگول است که اکسل مستقیم بازش می‌کند و هیچ
 * کتابخانه‌ای هم لازم ندارد.
 *
 * ── دو نکته که بدون آن‌ها فایل در اکسل فارسی خراب می‌شود ────────────────
 * ۱. **BOM** ابتدای فایل: بدون آن اکسل روی ویندوز متن فارسی را به‌صورت
 *    نویسه‌های درهم نشان می‌دهد.
 * ۲. **ارقام لاتین**: اعداد باید لاتین بمانند، وگرنه اکسل آن‌ها را متن
 *    می‌بیند و جمع‌بستن و مرتب‌سازی کار نمی‌کند.
 * ───────────────────────────────────────────────────────────────────────
 */

const BOM = '﻿';

export interface Column<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';

  const text = String(value);
  // ویرگول، نقل‌قول و خط جدید باید داخل نقل‌قول محصور شوند
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv<T>(rows: readonly T[], columns: readonly Column<T>[]): string {
  const lines = [
    columns.map((c) => escapeCell(c.header)).join(','),
    ...rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(',')),
  ];
  return BOM + lines.join('\r\n');
}

/** نام فایل با تاریخ امروز، به‌صورت امن برای همه سیستم‌عامل‌ها. */
export function csvFileName(reportKey: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `${reportKey}-${today}.csv`;
}
