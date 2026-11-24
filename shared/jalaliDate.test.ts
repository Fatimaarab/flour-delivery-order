import { describe, expect, it } from 'vitest';
import {
  dateToJalali,
  formatJalaliParts,
  gregorianToJalali,
  isJalaliLeapYear,
  isValidJalaliDate,
  isoToJalaliText,
  jalaliMonthLength,
  jalaliToDate,
  jalaliToGregorian,
  jalaliTextToIso,
  parseJalali,
} from './jalaliDate.js';

/**
 * ── روش سنجش درستی ───────────────────────────────────────────────────────
 * تبدیل تاریخ جایی است که اشتباه در آن بی‌صدا می‌ماند: یک روز خطا سال‌ها
 * معلوم نمی‌شود تا روزی که گزارشی غلط دربیاید.
 *
 * برای همین به‌جای چند نمونه دستی، خروجی این کد با تقویم شمسی **خود موتور
 * جاوااسکریپت** (`Intl` با تقویم persian) روی هزاران تاریخ مقایسه می‌شود.
 * آن تقویم پیاده‌سازی مستقلی است، پس اگر هر دو یکی باشند، تبدیل درست است.
 * ────────────────────────────────────────────────────────────────────────
 */
const intlJalali = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  timeZone: 'UTC',
});

/** تاریخ شمسی همان روز، طبق تقویم خود موتور جاوااسکریپت. */
function jalaliByIntl(gy: number, gm: number, gd: number) {
  const parts = intlJalali.formatToParts(new Date(Date.UTC(gy, gm - 1, gd)));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { jy: get('year'), jm: get('month'), jd: get('day') };
}

describe('تبدیل میلادی به شمسی', () => {
  it('با تقویم خود موتور جاوااسکریپت، روی هر روز ۱۵ سال یکسان است', () => {
    const start = Date.UTC(2018, 0, 1);
    const end = Date.UTC(2033, 0, 1);
    let checked = 0;

    for (let t = start; t < end; t += 86_400_000) {
      const d = new Date(t);
      const gy = d.getUTCFullYear();
      const gm = d.getUTCMonth() + 1;
      const gd = d.getUTCDate();

      const mine = gregorianToJalali(gy, gm, gd);
      const theirs = jalaliByIntl(gy, gm, gd);

      expect(mine, `${gy}-${gm}-${gd}`).toEqual(theirs);
      checked++;
    }

    // اطمینان از اینکه حلقه واقعاً اجرا شده
    expect(checked).toBeGreaterThan(5000);
  });

  it('روی بازه‌های دورتر هم می‌خواند', () => {
    for (const [gy, gm, gd] of [
      [1990, 3, 21], [2000, 1, 1], [2010, 12, 31],
      [2040, 6, 15], [2050, 3, 20], [2060, 9, 1],
    ] as const) {
      expect(gregorianToJalali(gy, gm, gd), `${gy}-${gm}-${gd}`).toEqual(
        jalaliByIntl(gy, gm, gd),
      );
    }
  });
});

describe('تبدیل شمسی به میلادی', () => {
  it('رفت و برگشت، همان تاریخ اول را می‌دهد', () => {
    const start = Date.UTC(2020, 0, 1);
    const end = Date.UTC(2030, 0, 1);

    for (let t = start; t < end; t += 86_400_000) {
      const d = new Date(t);
      const gy = d.getUTCFullYear();
      const gm = d.getUTCMonth() + 1;
      const gd = d.getUTCDate();

      const j = gregorianToJalali(gy, gm, gd);
      const back = jalaliToGregorian(j.jy, j.jm, j.jd);

      expect(back, `${gy}-${gm}-${gd}`).toEqual({ gy, gm, gd });
    }
  });

  it('اول فروردین همیشه حوالی ۲۰ یا ۲۱ مارس است', () => {
    for (let jy = 1395; jy <= 1420; jy++) {
      const g = jalaliToGregorian(jy, 1, 1);
      expect(g.gm, `سال ${jy}`).toBe(3);
      expect([20, 21], `سال ${jy}`).toContain(g.gd);
    }
  });
});

describe('سال کبیسه و طول ماه‌ها', () => {
  it('شش ماه اول ۳۱ روز و پنج ماه بعد ۳۰ روز است', () => {
    for (let jm = 1; jm <= 6; jm++) expect(jalaliMonthLength(1405, jm)).toBe(31);
    for (let jm = 7; jm <= 11; jm++) expect(jalaliMonthLength(1405, jm)).toBe(30);
  });

  it('اسفند در سال کبیسه ۳۰ روز و در غیر آن ۲۹ روز است', () => {
    for (let jy = 1395; jy <= 1420; jy++) {
      expect(jalaliMonthLength(jy, 12)).toBe(isJalaliLeapYear(jy) ? 30 : 29);
    }
  });

  it('تشخیص کبیسه با تقویم موتور جاوااسکریپت می‌خواند', () => {
    for (let jy = 1395; jy <= 1420; jy++) {
      // اگر سال کبیسه باشد، ۳۰ اسفند وجود دارد و دوباره همان تاریخ را می‌دهد
      if (!isJalaliLeapYear(jy)) continue;
      const g = jalaliToGregorian(jy, 12, 30);
      expect(jalaliByIntl(g.gy, g.gm, g.gd), `سال ${jy}`).toEqual({ jy, jm: 12, jd: 30 });
    }
  });
});

describe('اعتبارسنجی تاریخ', () => {
  it('تاریخ‌های موجود را می‌پذیرد', () => {
    expect(isValidJalaliDate(1405, 7, 12)).toBe(true);
    expect(isValidJalaliDate(1405, 1, 31)).toBe(true);
  });

  it('۳۱ ام ماه‌های ۳۰ روزه را رد می‌کند', () => {
    expect(isValidJalaliDate(1405, 7, 31)).toBe(false);
  });

  it('۳۰ اسفند را فقط در سال کبیسه می‌پذیرد', () => {
    for (let jy = 1400; jy <= 1410; jy++) {
      expect(isValidJalaliDate(jy, 12, 30), `سال ${jy}`).toBe(isJalaliLeapYear(jy));
    }
  });

  it('ماه و روز بیرون از بازه را رد می‌کند', () => {
    expect(isValidJalaliDate(1405, 0, 1)).toBe(false);
    expect(isValidJalaliDate(1405, 13, 1)).toBe(false);
    expect(isValidJalaliDate(1405, 1, 0)).toBe(false);
  });
});

describe('خواندن تاریخ از متن کاربر', () => {
  it('ارقام فارسی را می‌خواند', () => {
    expect(parseJalali('۱۴۰۵/۰۷/۱۲')).toEqual({ jy: 1405, jm: 7, jd: 12 });
  });

  it('ارقام لاتین را هم می‌خواند', () => {
    expect(parseJalali('1405/07/12')).toEqual({ jy: 1405, jm: 7, jd: 12 });
  });

  it('خط تیره و نقطه را هم به‌عنوان جداکننده می‌پذیرد', () => {
    expect(parseJalali('1405-07-12')).toEqual({ jy: 1405, jm: 7, jd: 12 });
    expect(parseJalali('1405.7.12')).toEqual({ jy: 1405, jm: 7, jd: 12 });
  });

  it('تاریخ بدون صفر ابتدایی را می‌پذیرد', () => {
    expect(parseJalali('1405/7/5')).toEqual({ jy: 1405, jm: 7, jd: 5 });
  });

  it('متن نامعتبر یا تاریخ ناموجود را رد می‌کند', () => {
    for (const bad of ['', 'abc', '1405', '1405/13/01', '1405/07/31', '۱۴۰۵/۰۱']) {
      expect(parseJalali(bad), bad).toBeNull();
    }
  });
});

describe('تبدیل متن شمسی و ISO میلادی', () => {
  it('متن شمسی به ISO میلادی', () => {
    expect(jalaliTextToIso('۱۴۰۵/۰۷/۱۲')).toBe('2026-10-04');
  });

  it('ISO میلادی به متن شمسی', () => {
    expect(isoToJalaliText('2026-10-04')).toBe('۱۴۰۵/۰۷/۱۲');
  });

  it('رفت و برگشت متن، تغییری ایجاد نمی‌کند', () => {
    for (const iso of ['2024-03-20', '2025-01-01', '2026-10-04', '2027-12-31']) {
      const text = isoToJalaliText(iso);
      expect(jalaliTextToIso(text), iso).toBe(iso);
    }
  });

  it('متن نامعتبر null می‌دهد', () => {
    expect(jalaliTextToIso('چیز بی‌ربط')).toBeNull();
  });
});

describe('نمایش', () => {
  it('با ارقام فارسی و صفر ابتدایی نمایش می‌دهد', () => {
    expect(formatJalaliParts({ jy: 1405, jm: 7, jd: 5 })).toBe('۱۴۰۵/۰۷/۰۵');
  });

  it('تبدیل از شیء Date درست کار می‌کند', () => {
    const d = jalaliToDate(1405, 7, 12);
    expect(dateToJalali(d)).toEqual({ jy: 1405, jm: 7, jd: 12 });
  });
});
