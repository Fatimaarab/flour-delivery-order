import { describe, expect, it } from 'vitest';
import { calculateVat, formatRial, parseRial } from './money.js';

describe('مبالغ ریالی', () => {
  it('مبلغ را با جداکننده هزارگان و ارقام فارسی نمایش می‌دهد', () => {
    expect(formatRial(1_500_000)).toBe('۱٬۵۰۰٬۰۰۰');
  });

  it('مبالغ بسیار بزرگ (فراتر از سقف عدد ۳۲ بیتی) را درست نمایش می‌دهد', () => {
    // این همان موردی است که در فاز ۱ باعث خطای دیتابیس شد
    expect(formatRial(20_000_000_000)).toBe('۲۰٬۰۰۰٬۰۰۰٬۰۰۰');
  });

  it('ورودی کاربر با ارقام فارسی و جداکننده را می‌خواند', () => {
    expect(parseRial('۱٬۵۰۰٬۰۰۰')).toBe(1_500_000);
    expect(parseRial('1,500,000')).toBe(1_500_000);
    expect(parseRial('۴۵۰۰۰')).toBe(45_000);
  });

  it('ورودی نامعتبر را رد می‌کند', () => {
    expect(parseRial('')).toBeNull();
    expect(parseRial('abc')).toBeNull();
    expect(parseRial('12.5')).toBeNull(); // مبلغ اعشاری مجاز نیست
    expect(parseRial('-500')).toBeNull();
  });

  describe('مالیات بر ارزش افزوده', () => {
    it('۱۰ درصد را درست حساب می‌کند', () => {
      expect(calculateVat(1_000_000, 10)).toBe(100_000);
    });

    it('آرد یارانه‌ای با نرخ صفر، مالیات ندارد', () => {
      expect(calculateVat(5_000_000, 0)).toBe(0);
    });

    it('نتیجه همیشه عدد صحیح است، حتی وقتی تقسیم گِرد نمی‌شود', () => {
      const vat = calculateVat(1_234_567, 10);
      expect(Number.isInteger(vat)).toBe(true);
      expect(vat).toBe(123_457);
    });

    it('روی مبالغ بزرگ هم دقت را از دست نمی‌دهد', () => {
      expect(calculateVat(18_000_000_000, 10)).toBe(1_800_000_000);
    });
  });
});
