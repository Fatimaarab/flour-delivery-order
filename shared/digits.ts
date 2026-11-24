/**
 * تبدیل ارقام فارسی و عربی به لاتین.
 *
 * چرا لازم است: صفحه‌کلید فارسی ارقام «۰۱۲۳» تولید می‌کند که برای کامپیوتر
 * نویسه‌های کاملاً متفاوتی از «0123» هستند. بدون این تبدیل، اگر کاربر کد ملی
 * را با ارقام فارسی وارد کند، اعتبارسنجی شکست می‌خورد و جستجو چیزی پیدا
 * نمی‌کند — حتی وقتی عدد درست است.
 *
 * هر ورودی عددی که از کاربر می‌آید باید از این تابع عبور کند.
 */

const PERSIAN_ZERO = 0x06f0; // ۰
const ARABIC_ZERO = 0x0660; // ٠

export function toLatinDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code >= PERSIAN_ZERO && code <= PERSIAN_ZERO + 9) {
      out += String(code - PERSIAN_ZERO);
    } else if (code >= ARABIC_ZERO && code <= ARABIC_ZERO + 9) {
      out += String(code - ARABIC_ZERO);
    } else {
      out += ch;
    }
  }
  return out;
}

/** ارقام لاتین را برای نمایش به فارسی تبدیل می‌کند. */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) =>
    String.fromCodePoint(PERSIAN_ZERO + Number(d)),
  );
}

/**
 * یک ورودی عددی کاربر را پاک‌سازی می‌کند: ارقام فارسی/عربی را لاتین می‌کند،
 * جداکننده‌های هزارگان و فاصله‌ها را برمی‌دارد.
 */
export function normalizeNumeric(input: string): string {
  // ٬ جداکننده هزارگان عربی است و با ویرگول لاتین فرق دارد — نرم‌افزارهای
  // فارسی اعداد را با همین تولید می‌کنند.
  return toLatinDigits(input)
    .replace(/[\s,،_٬‌]/g, '')
    .trim();
}

/** فقط ارقام را نگه می‌دارد (برای کد ملی، تلفن، و مانند آن). */
export function digitsOnly(input: string): string {
  return normalizeNumeric(input).replace(/\D/g, '');
}
