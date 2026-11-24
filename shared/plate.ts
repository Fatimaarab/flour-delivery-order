/**
 * پلاک انتظامی ایران.
 *
 * ── قالب ─────────────────────────────────────────────────────────────────
 * پلاک خودروهای ایران چهار بخش دارد:
 *
 *     ۴۲  ع  ۳۱۷   ایران ۳۶
 *     └┬┘ └┬┘ └─┬─┘       └┬┘
 *      │   │    │          └── کد استان، دو رقم
 *      │   │    └───────────── سه رقم سمت راست
 *      │   └────────────────── حرف
 *      └────────────────────── دو رقم سمت چپ
 *
 * ── چرا یک فایل مشترک ────────────────────────────────────────────────────
 * پیش از این پلاک یک رشته آزاد بود: فرم بارگیری هر چیزی را قبول می‌کرد و
 * فقط هنگام چاپ تلاش می‌شد خوانده شود. نتیجه‌اش این بود که یک پلاک بدشکل تا
 * لحظه چاپ برگه معلوم نمی‌شد — یعنی جایی که دیگر برای اصلاحش دیر است.
 *
 * حالا همین یک فایل هم در مرورگر (هنگام ورود اطلاعات) و هم روی سرور (هنگام
 * ذخیره) و هم هنگام چاپ استفاده می‌شود، پس هر سه جا یک تعریف از «پلاک
 * معتبر» دارند.
 * ────────────────────────────────────────────────────────────────────────
 */

import { toLatinDigits, toPersianDigits } from './digits.js';

/**
 * حروفی که روی پلاک خودروهای ایران می‌آیند.
 *
 * «الف» روی خود پلاک یک نویسه «ا» است. حروف ویژه مثل تشریفات و سیاسی اینجا
 * نیامده‌اند؛ کامیون باری که به کارخانه می‌آید یکی از این‌هاست.
 */
export const PLATE_LETTERS = [
  'الف', 'ب', 'پ', 'ت', 'ث', 'ج', 'د', 'ز', 'ژ', 'س', 'ش', 'ص',
  'ط', 'ع', 'ف', 'ق', 'ک', 'ل', 'م', 'ن', 'و', 'ه', 'ی',
] as const;

export type PlateLetter = (typeof PLATE_LETTERS)[number];

/** معنی حرف‌هایی که در کار روزمره کارخانه دیده می‌شوند. */
export const LETTER_MEANING: Partial<Record<string, string>> = {
  ع: 'بار (عمومی)',
  ت: 'تاکسی',
  ژ: 'معلولان و جانبازان',
  الف: 'دولتی',
};

export interface PlateParts {
  /** دو رقم سمت چپ */
  left: string;
  letter: string;
  /** سه رقم سمت راست */
  right: string;
  /** کد دو رقمی استان */
  zone: string;
}

/**
 * روی خود پلاک «الف» با یک نویسه «ا» نوشته می‌شود. هر دو پذیرفته می‌شوند و
 * همیشه به صورت «الف» ذخیره می‌شوند تا جستجو و مقایسه یکدست بماند.
 */
function normalizeLetter(raw: string): string {
  const t = raw.trim();
  if (t === 'ا' || t === 'آ' || t === 'أ') return 'الف';
  // «ه» گاهی با «هـ» یا «ة» نوشته می‌شود
  if (t === 'هـ' || t === 'ة') return 'ه';
  // «ک» و «ی» عربی با فارسی فرق دارند و چشم تفاوتشان را نمی‌بیند
  if (t === 'ك') return 'ک';
  if (t === 'ي' || t === 'ى') return 'ی';
  return t;
}

export function isPlateLetter(letter: string): boolean {
  return (PLATE_LETTERS as readonly string[]).includes(normalizeLetter(letter));
}

/** آیا این چهار بخش با هم یک پلاک معتبر می‌سازند؟ */
export function isValidPlate(parts: PlateParts): boolean {
  const left = toLatinDigits(parts.left).trim();
  const right = toLatinDigits(parts.right).trim();
  const zone = toLatinDigits(parts.zone).trim();

  if (!/^\d{2}$/.test(left)) return false;
  if (!/^\d{3}$/.test(right)) return false;
  // کد استان از ۱۰ شروع می‌شود؛ ۰۰ تا ۰۹ وجود ندارد
  if (!/^\d{2}$/.test(zone) || Number(zone) < 10) return false;
  if (!isPlateLetter(parts.letter)) return false;

  return true;
}

/**
 * شکل ذخیره‌سازی: `42ع317ایران36`
 *
 * ارقام لاتین ذخیره می‌شوند تا جستجو، مرتب‌سازی و خروجی اکسل درست کار کند؛
 * تبدیل به فارسی فقط هنگام نمایش انجام می‌شود.
 */
export function formatPlate(parts: PlateParts): string {
  const left = toLatinDigits(parts.left).trim().padStart(2, '0');
  const right = toLatinDigits(parts.right).trim().padStart(3, '0');
  const zone = toLatinDigits(parts.zone).trim().padStart(2, '0');
  return `${left}${normalizeLetter(parts.letter)}${right}ایران${zone}`;
}

/**
 * خواندن پلاک از یک رشته.
 *
 * قالب‌های زیر همه پذیرفته می‌شوند، چون داده قدیمی و ورودی دستی هر دو شکل
 * را دارند:
 *
 *     42ع317ایران36      ۴۲ع۳۱۷ایران۳۶
 *     42 ع 317 ایران 36  42ع317-36
 */
export function parsePlate(input: string): PlateParts | null {
  if (!input) return null;

  const clean = toLatinDigits(input).replace(/\s+/g, '');
  const match = clean.match(
    /^(\d{2})([ء-ی]{1,3}?)(\d{3})(?:[-–]?(?:ایران)?[-–]?(\d{2}))$/,
  );
  if (!match) return null;

  const parts: PlateParts = {
    left: match[1]!,
    letter: normalizeLetter(match[2]!),
    right: match[3]!,
    zone: match[4]!,
  };

  return isValidPlate(parts) ? parts : null;
}

/** برای نمایش روی صفحه و برگه چاپی: `۴۲ ع ۳۱۷ ایران ۳۶` */
export function formatPlateForDisplay(input: string): string {
  const p = parsePlate(input);
  if (!p) return input;
  return `${toPersianDigits(p.left)} ${p.letter} ${toPersianDigits(p.right)} ایران ${toPersianDigits(p.zone)}`;
}
