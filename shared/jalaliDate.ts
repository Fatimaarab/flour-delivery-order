/**
 * تبدیل دوطرفه تاریخ شمسی و میلادی.
 *
 * ── چرا بدون کتابخانه ────────────────────────────────────────────────────
 * `Intl` که در خود مرورگر و Node هست، تاریخ میلادی را **به** شمسی نمایش
 * می‌دهد، اما نمی‌تواند تاریخ شمسی را **بخواند** و به میلادی برگرداند. برای
 * ورودی تاریخ شمسی، به تبدیل دوطرفه نیاز است.
 *
 * افزودن کتابخانه برای سروری که آفلاین و داخل ایران کار می‌کند، یک وابستگی
 * اضافه است. الگوریتم تبدیل شناخته‌شده و کوتاه است، پس همین‌جا پیاده شده —
 * و درستی‌اش در تست با مقایسه مستقیم با تقویم خود `Intl` سنجیده می‌شود.
 * ────────────────────────────────────────────────────────────────────────
 */

const div = (a: number, b: number) => Math.trunc(a / b);
const mod = (a: number, b: number) => a - Math.trunc(a / b) * b;

/** سال‌هایی که الگوی کبیسه در آن‌ها تغییر می‌کند. */
const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
  2192, 2262, 2324, 2394, 2456, 3178,
];

interface JalaliCal {
  leap: number;
  gy: number;
  march: number;
}

function jalaliCal(jy: number): JalaliCal {
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0]!;

  if (jy < jp || jy >= BREAKS[BREAKS.length - 1]!) {
    throw new RangeError(`سال شمسی ${jy} خارج از محدوده پشتیبانی‌شده است.`);
  }

  let jump = 0;
  for (let i = 1; i < BREAKS.length; i++) {
    const jm = BREAKS[i]!;
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }

  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

/** شماره روز مطلق از تاریخ میلادی. */
function gregorianToDayNumber(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function dayNumberToGregorian(dn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * dn + 139361631;
  j += div(div(4 * dn + 183187720, 146097) * 3, 4) * 4 - 3908;

  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);

  return { gy, gm, gd };
}

export interface JalaliParts {
  jy: number;
  jm: number;
  jd: number;
}

/** آیا سال شمسی کبیسه است؟ */
export function isJalaliLeapYear(jy: number): boolean {
  return jalaliCal(jy).leap === 0;
}

/** تعداد روزهای یک ماه شمسی. */
export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}

/** آیا این تاریخ شمسی واقعاً وجود دارد؟ */
export function isValidJalaliDate(jy: number, jm: number, jd: number): boolean {
  if (!Number.isInteger(jy) || !Number.isInteger(jm) || !Number.isInteger(jd)) return false;
  if (jy < 1 || jy > 3177) return false;
  if (jm < 1 || jm > 12) return false;
  if (jd < 1) return false;

  try {
    return jd <= jalaliMonthLength(jy, jm);
  } catch {
    return false;
  }
}

export function jalaliToGregorian(jy: number, jm: number, jd: number) {
  const cal = jalaliCal(jy);
  const dn =
    gregorianToDayNumber(cal.gy, 3, cal.march) +
    (jm - 1) * 31 -
    div(jm, 7) * (jm - 7) +
    jd -
    1;
  return dayNumberToGregorian(dn);
}

export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliParts {
  const dn = gregorianToDayNumber(gy, gm, gd);
  let jy = gy - 621;
  const cal = jalaliCal(jy);
  const firstDay = gregorianToDayNumber(cal.gy, 3, cal.march);

  let k = dn - firstDay;
  if (k >= 0) {
    if (k <= 185) {
      return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (cal.leap === 1) k += 1;
  }

  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

// ─────────────────────── تبدیل به و از Date ───────────────────────

export function dateToJalali(date: Date): JalaliParts {
  return gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function jalaliToDate(jy: number, jm: number, jd: number): Date {
  const g = jalaliToGregorian(jy, jm, jd);
  return new Date(g.gy, g.gm - 1, g.gd);
}

// ─────────────────────── خواندن و نوشتن متن ───────────────────────

const PERSIAN_ZERO = 0x06f0;
const ARABIC_ZERO = 0x0660;

function toLatin(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code >= PERSIAN_ZERO && code <= PERSIAN_ZERO + 9) out += String(code - PERSIAN_ZERO);
    else if (code >= ARABIC_ZERO && code <= ARABIC_ZERO + 9) out += String(code - ARABIC_ZERO);
    else out += ch;
  }
  return out;
}

/** مثال خروجی: ۱۴۰۵/۰۷/۱۲ */
export function formatJalaliParts(p: JalaliParts): string {
  const fa = (n: number, width: number) =>
    String(n)
      .padStart(width, '0')
      .replace(/[0-9]/g, (d) => String.fromCodePoint(PERSIAN_ZERO + Number(d)));
  return `${fa(p.jy, 4)}/${fa(p.jm, 2)}/${fa(p.jd, 2)}`;
}

/**
 * خواندن تاریخ شمسی از متن کاربر.
 *
 * ارقام فارسی و لاتین، و جداکننده‌های `/`، `-` و `.` پذیرفته می‌شوند.
 * اگر تاریخ وجود نداشته باشد (مثلاً ۳۱ اسفند در سال غیرکبیسه) null برمی‌گردد.
 */
export function parseJalali(input: string): JalaliParts | null {
  const cleaned = toLatin(input).trim().replace(/[-.]/g, '/');
  const match = cleaned.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;

  const jy = Number(match[1]);
  const jm = Number(match[2]);
  const jd = Number(match[3]);

  return isValidJalaliDate(jy, jm, jd) ? { jy, jm, jd } : null;
}

/** تاریخ میلادی ISO (`2026-10-04`) را به متن شمسی تبدیل می‌کند. */
export function isoToJalaliText(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatJalaliParts(dateToJalali(d));
}

/** متن شمسی را به تاریخ میلادی ISO (`2026-10-04`) تبدیل می‌کند. */
export function jalaliTextToIso(text: string): string | null {
  const parts = parseJalali(text);
  if (!parts) return null;

  const g = jalaliToGregorian(parts.jy, parts.jm, parts.jd);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
}

export const JALALI_MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
] as const;
