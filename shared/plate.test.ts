import { describe, expect, it } from 'vitest';
import {
  PLATE_LETTERS,
  formatPlate,
  formatPlateForDisplay,
  isPlateLetter,
  isValidPlate,
  parsePlate,
} from './plate.js';

/**
 * پلاک روی برگه‌ای چاپ می‌شود که نگهبان با آن بار را از گیت بیرون می‌دهد.
 * اگر پلاک بدشکل یا ناقص ذخیره شود، این موضوع تا لحظه چاپ معلوم نمی‌شود —
 * یعنی وقتی کامیون دم در ایستاده. پس اعتبارسنجی باید هنگام ورود اطلاعات
 * قاطع باشد.
 */

const P = (left: string, letter: string, right: string, zone: string) => ({
  left,
  letter,
  right,
  zone,
});

describe('اعتبارسنجی پلاک', () => {
  it('پلاک درست را می‌پذیرد', () => {
    expect(isValidPlate(P('42', 'ع', '317', '36'))).toBe(true);
  });

  it('تعداد رقم‌های نادرست را رد می‌کند', () => {
    expect(isValidPlate(P('4', 'ع', '317', '36'))).toBe(false);
    expect(isValidPlate(P('422', 'ع', '317', '36'))).toBe(false);
    expect(isValidPlate(P('42', 'ع', '31', '36'))).toBe(false);
    expect(isValidPlate(P('42', 'ع', '3177', '36'))).toBe(false);
  });

  it('کد استان کمتر از ۱۰ را رد می‌کند', () => {
    // کد استان از ۱۰ شروع می‌شود
    for (const zone of ['00', '09', '07']) {
      expect(isValidPlate(P('42', 'ع', '317', zone)), zone).toBe(false);
    }
    expect(isValidPlate(P('42', 'ع', '317', '10'))).toBe(true);
  });

  it('حرفی که روی پلاک ایران نیست را رد می‌کند', () => {
    for (const bad of ['ض', 'خ', 'A', '', 'عع']) {
      expect(isValidPlate(P('42', bad, '317', '36')), bad).toBe(false);
    }
  });

  it('همه حروف فهرست رسمی پذیرفته می‌شوند', () => {
    for (const letter of PLATE_LETTERS) {
      expect(isPlateLetter(letter), letter).toBe(true);
    }
  });

  it('شکل‌های مختلف نوشتن یک حرف را یکی می‌داند', () => {
    // «الف» روی خود پلاک یک نویسه است
    expect(isPlateLetter('ا')).toBe(true);
    // «ک» و «ی» عربی که چشم تفاوتشان را نمی‌بیند
    expect(isPlateLetter('ك')).toBe(true);
    expect(isPlateLetter('ي')).toBe(true);
  });
});

describe('خواندن پلاک از متن', () => {
  const expected = P('42', 'ع', '317', '36');

  it('قالب‌های رایج را می‌خواند', () => {
    for (const input of [
      '42ع317ایران36',
      '۴۲ع۳۱۷ایران۳۶',
      '42 ع 317 ایران 36',
      '۴۲ ع ۳۱۷ ایران ۳۶',
      '42ع317-36',
      '42ع31736',
    ]) {
      expect(parsePlate(input), input).toEqual(expected);
    }
  });

  it('«ا» را به «الف» تبدیل می‌کند', () => {
    expect(parsePlate('12ا345ایران10')?.letter).toBe('الف');
    expect(parsePlate('12الف345ایران10')?.letter).toBe('الف');
  });

  it('پلاک بدون کد استان را رد می‌کند', () => {
    // کد استان بخشی از هویت پلاک است، نه یک افزونه اختیاری
    expect(parsePlate('42ع317')).toBeNull();
  });

  it('متن نامعتبر را رد می‌کند', () => {
    for (const bad of ['', 'نامشخص', '123', 'abc', '42ض317ایران36', '42ع317ایران07']) {
      expect(parsePlate(bad), bad).toBeNull();
    }
  });
});

describe('ذخیره و نمایش', () => {
  it('همیشه با ارقام لاتین ذخیره می‌شود', () => {
    expect(formatPlate(P('۴۲', 'ع', '۳۱۷', '۳۶'))).toBe('42ع317ایران36');
    expect(formatPlate(P('42', 'ا', '317', '36'))).toBe('42الف317ایران36');
  });

  it('رقم‌های کم را با صفر پر می‌کند', () => {
    expect(formatPlate(P('5', 'ب', '42', '11'))).toBe('05ب042ایران11');
  });

  it('برای نمایش با ارقام فارسی و فاصله درمی‌آید', () => {
    expect(formatPlateForDisplay('42ع317ایران36')).toBe('۴۲ ع ۳۱۷ ایران ۳۶');
  });

  it('رفت و برگشت، همان مقدار اول را می‌دهد', () => {
    for (const plate of ['42ع317ایران36', '11الف222ایران99', '05ب042ایران11']) {
      expect(formatPlate(parsePlate(plate)!), plate).toBe(plate);
    }
  });

  it('هرگز پلاک نمونه از خودش نمی‌سازد', () => {
    // نسخه قدیمیِ خواندن پلاک، برای ورودی خالی مقدار نمونه «۴۴ع۷۸۹ ایران۷۷»
    // برمی‌گرداند و کد استان نداشته را «۱۱» می‌گذاشت. روی برگه خروج بار،
    // یک پلاک ساختگیِ باورپذیر از پلاک خالی بدتر است.
    for (const input of ['', '   ', 'نامشخص', '-', '44ع789']) {
      expect(parsePlate(input), JSON.stringify(input)).toBeNull();
    }
  });

  it('متنی که پلاک نیست، دست‌نخورده نمایش داده می‌شود', () => {
    // بهتر از این است که وانمود کنیم پلاک است
    expect(formatPlateForDisplay('نامشخص')).toBe('نامشخص');
  });
});
