import { describe, expect, it } from 'vitest';
import { calculateReceipt, CalcError, type CalcItemInput } from './receiptCalc.js';

const item = (over: Partial<CalcItemInput> = {}): CalcItemInput => ({
  bagCount: 100,
  bagWeightKg: 40,
  unitPricePerKg: 15_000,
  vatPercent: 0,
  ...over,
});

describe('محاسبه مبالغ حواله', () => {
  describe('محاسبه پایه', () => {
    it('وزن و مبلغ یک ردیف را درست حساب می‌کند', () => {
      const r = calculateReceipt([item()]);
      expect(r.items[0]!.weightKg).toBe(4_000);
      expect(r.items[0]!.lineTotal).toBe(60_000_000);
      expect(r.subtotal).toBe(60_000_000);
      expect(r.grandTotal).toBe(60_000_000);
    });

    it('چند ردیف را جمع می‌زند', () => {
      const r = calculateReceipt([
        item({ bagCount: 100, bagWeightKg: 40, unitPricePerKg: 15_000 }),
        item({ bagCount: 50, bagWeightKg: 50, unitPricePerKg: 46_000 }),
      ]);
      expect(r.subtotal).toBe(60_000_000 + 115_000_000);
      expect(r.totalWeightKg).toBe(4_000 + 2_500);
      expect(r.totalBagCount).toBe(150);
    });
  });

  describe('مالیات بر ارزش افزوده', () => {
    it('۱۰ درصد را روی آرد آزاد اعمال می‌کند', () => {
      const r = calculateReceipt([item({ vatPercent: 10 })]);
      expect(r.vatAmount).toBe(6_000_000);
      expect(r.grandTotal).toBe(66_000_000);
    });

    it('آرد یارانه‌ای مالیات ندارد', () => {
      const r = calculateReceipt([item({ vatPercent: 0 })]);
      expect(r.vatAmount).toBe(0);
    });

    // ⭐ نکته ظریف: یک حواله می‌تواند هر دو نوع آرد را داشته باشد
    it('در حواله ترکیبی، مالیات فقط روی ردیف آزاد حساب می‌شود', () => {
      const r = calculateReceipt([
        item({ vatPercent: 0, unitPricePerKg: 15_000 }), // یارانه‌ای
        item({ vatPercent: 10, unitPricePerKg: 38_000 }), // آزاد
      ]);

      expect(r.items[0]!.vatAmount).toBe(0);
      expect(r.items[1]!.vatAmount).toBe(15_200_000); // ۱۰٪ از ۱۵۲ میلیون
      expect(r.vatAmount).toBe(15_200_000);
    });
  });

  describe('تخفیف', () => {
    it('تخفیف از جمع کل کم می‌شود', () => {
      const r = calculateReceipt([item()], 10_000_000);
      expect(r.discount).toBe(10_000_000);
      expect(r.grandTotal).toBe(50_000_000);
    });

    // ⭐ مهم: اگر مالیات پیش از تخفیف حساب شود، مشتری مالیات چیزی را
    // می‌پردازد که تخفیف گرفته — و فاکتور غلط می‌شود
    it('مالیات پس از کسر تخفیف حساب می‌شود، نه پیش از آن', () => {
      const r = calculateReceipt([item({ vatPercent: 10 })], 10_000_000);
      // پایه مشمول: ۶۰ میلیون منهای ۱۰ میلیون = ۵۰ میلیون → مالیات ۵ میلیون
      expect(r.vatAmount).toBe(5_000_000);
      expect(r.grandTotal).toBe(60_000_000 - 10_000_000 + 5_000_000);
    });

    it('تخفیف به نسبت مبلغ بین ردیف‌ها پخش می‌شود', () => {
      const r = calculateReceipt(
        [
          item({ unitPricePerKg: 10_000 }), // ۴۰ میلیون
          item({ unitPricePerKg: 30_000 }), // ۱۲۰ میلیون
        ],
        16_000_000,
      );
      // نسبت ۱ به ۳
      expect(r.items[0]!.discountShare).toBe(4_000_000);
      expect(r.items[1]!.discountShare).toBe(12_000_000);
    });

    // ⭐ این همان جایی است که فاکتورها معمولاً چند ریال اختلاف پیدا می‌کنند
    it('وقتی تقسیم گِرد نمی‌شود، جمع سهم‌ها دقیقاً برابر تخفیف می‌ماند', () => {
      const r = calculateReceipt(
        [
          item({ bagCount: 3, bagWeightKg: 1, unitPricePerKg: 1 }),
          item({ bagCount: 3, bagWeightKg: 1, unitPricePerKg: 1 }),
          item({ bagCount: 3, bagWeightKg: 1, unitPricePerKg: 1 }),
        ],
        // جمع کل ۹ است و ۵ بین سه ردیف مساوی تقسیم نمی‌شود
        5,
      );
      const sum = r.items.reduce((s, i) => s + i.discountShare, 0);
      expect(sum).toBe(5);
    });

    it('در صدها ترکیب تصادفی، جمع سهم تخفیف هرگز از تخفیف منحرف نمی‌شود', () => {
      for (let n = 0; n < 300; n++) {
        const count = 1 + (n % 5);
        const items = Array.from({ length: count }, (_, i) =>
          item({
            bagCount: 1 + ((n * 7 + i * 13) % 500),
            bagWeightKg: i % 2 === 0 ? 40 : 50,
            unitPricePerKg: 1_000 + ((n * 37 + i * 91) % 90_000),
          }),
        );
        const subtotal = items.reduce(
          (s, it) => s + it.bagCount * it.bagWeightKg * it.unitPricePerKg,
          0,
        );
        const discount = Math.floor(subtotal / (2 + (n % 7)));

        const r = calculateReceipt(items, discount);
        const sum = r.items.reduce((s, i) => s + i.discountShare, 0);
        expect(sum).toBe(discount);
      }
    });

    it('تخفیف بیشتر از جمع کل رد می‌شود', () => {
      expect(() => calculateReceipt([item()], 60_000_001)).toThrow(CalcError);
    });

    it('تخفیف برابر جمع کل، مبلغ نهایی را صفر می‌کند', () => {
      const r = calculateReceipt([item({ vatPercent: 10 })], 60_000_000);
      expect(r.vatAmount).toBe(0);
      expect(r.grandTotal).toBe(0);
    });
  });

  describe('همه مبالغ عدد صحیح می‌مانند', () => {
    it('حتی با اعداد نامناسب، هیچ مبلغ اعشاری تولید نمی‌شود', () => {
      const r = calculateReceipt(
        [item({ bagCount: 7, bagWeightKg: 40, unitPricePerKg: 12_345, vatPercent: 10 })],
        1_111,
      );
      for (const value of [r.subtotal, r.discount, r.vatAmount, r.grandTotal]) {
        expect(Number.isInteger(value)).toBe(true);
      }
      for (const i of r.items) {
        expect(Number.isInteger(i.lineTotal)).toBe(true);
        expect(Number.isInteger(i.vatAmount)).toBe(true);
        expect(Number.isInteger(i.discountShare)).toBe(true);
      }
    });

    it('روی مبالغ میلیاردی هم دقت را از دست نمی‌دهد', () => {
      const r = calculateReceipt(
        [item({ bagCount: 10_000, bagWeightKg: 50, unitPricePerKg: 46_000, vatPercent: 10 })],
      );
      expect(r.subtotal).toBe(23_000_000_000);
      expect(r.vatAmount).toBe(2_300_000_000);
      expect(r.grandTotal).toBe(25_300_000_000);
      expect(Number.isSafeInteger(r.grandTotal)).toBe(true);
    });
  });

  describe('ورودی نامعتبر رد می‌شود', () => {
    it('حواله بدون قلم کالا', () => {
      expect(() => calculateReceipt([])).toThrow('دست‌کم یک قلم');
    });

    it('تعداد کیسه صفر یا منفی', () => {
      expect(() => calculateReceipt([item({ bagCount: 0 })])).toThrow(CalcError);
      expect(() => calculateReceipt([item({ bagCount: -5 })])).toThrow(CalcError);
    });

    it('تعداد کیسه اعشاری', () => {
      expect(() => calculateReceipt([item({ bagCount: 2.5 })])).toThrow(CalcError);
    });

    it('قیمت منفی', () => {
      expect(() => calculateReceipt([item({ unitPricePerKg: -1 })])).toThrow(CalcError);
    });

    it('درصد مالیات بیرون از بازه', () => {
      expect(() => calculateReceipt([item({ vatPercent: 101 })])).toThrow(CalcError);
      expect(() => calculateReceipt([item({ vatPercent: -1 })])).toThrow(CalcError);
    });

    it('تخفیف منفی', () => {
      expect(() => calculateReceipt([item()], -1)).toThrow(CalcError);
    });

    it('پیام خطا شماره ردیف مشکل‌دار را می‌گوید', () => {
      expect(() => calculateReceipt([item(), item({ bagCount: 0 })])).toThrow('ردیف ۲'.replace('۲', '2'));
    });
  });
});
