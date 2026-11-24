/**
 * نمایش تاریخ شمسی.
 *
 * تاریخ‌ها در دیتابیس میلادی/UTC ذخیره می‌شوند (تا مرتب‌سازی، محاسبه بازه و
 * گزارش‌گیری درست کار کند) و فقط در لحظه نمایش به شمسی تبدیل می‌شوند.
 *
 * تبدیل با `Intl` انجام می‌شود که داخل خود مرورگر و Node وجود دارد — بدون
 * نیاز به هیچ کتابخانه یا اینترنتی. این برای سروری که داخل ایران و آفلاین
 * کار می‌کند اهمیت دارد.
 */

const DATE_FMT = new Intl.DateTimeFormat('fa-IR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DATETIME_FMT = new Intl.DateTimeFormat('fa-IR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** مثال خروجی: ۱۴۰۵/۰۶/۱۶ */
export function formatJalaliDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? DATE_FMT.format(d) : '—';
}

/** مثال خروجی: ۱۴۰۵/۰۶/۱۶، ۱۴:۳۰ */
export function formatJalaliDateTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? DATETIME_FMT.format(d) : '—';
}

/** فاصله تا امروز، به زبان ساده — برای نشان دادن اعتبار حواله. */
export function daysUntil(value: string | Date | null | undefined): number | null {
  const d = toDate(value);
  if (!d) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);

  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
