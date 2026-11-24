import { describe, expect, it } from 'vitest';
import { calculateWeighbridge, WeighbridgeError } from './weighbridge.js';

const base = { receiptWeightKg: 20_000, tolerancePercent: 2 };

describe('محاسبه باسکول', () => {
  it('وزن خالص را از تفاوت پر و خالی حساب می‌کند', () => {
    const r = calculateWeighbridge({ ...base, tareWeightKg: 12_000, grossWeightKg: 32_000 });
    expect(r.netWeightKg).toBe(20_000);
    expect(r.varianceKg).toBe(0);
    expect(r.exceedsTolerance).toBe(false);
  });

  it('وزن پر کمتر یا مساوی وزن خالی رد می‌شود', () => {
    expect(() =>
      calculateWeighbridge({ ...base, tareWeightKg: 20_000, grossWeightKg: 15_000 }),
    ).toThrow(WeighbridgeError);

    expect(() =>
      calculateWeighbridge({ ...base, tareWeightKg: 20_000, grossWeightKg: 20_000 }),
    ).toThrow(WeighbridgeError);
  });

  it('پیام خطای جابه‌جایی دو عدد، راهنمایی می‌کند', () => {
    try {
      calculateWeighbridge({ ...base, tareWeightKg: 30_000, grossWeightKg: 12_000 });
      expect.unreachable();
    } catch (err) {
      expect((err as Error).message).toContain('جابه‌جا');
    }
  });

  it('وزن منفی یا اعشاری رد می‌شود', () => {
    expect(() =>
      calculateWeighbridge({ ...base, tareWeightKg: -1, grossWeightKg: 100 }),
    ).toThrow(WeighbridgeError);
    expect(() =>
      calculateWeighbridge({ ...base, tareWeightKg: 1.5, grossWeightKg: 100 }),
    ).toThrow(WeighbridgeError);
  });
});

describe('مغایرت وزنی با حد مجاز ۲٪', () => {
  it('اختلاف دقیقاً روی مرز ۲٪، مغایرت محسوب نمی‌شود', () => {
    // ۲٪ از ۲۰ تن = ۴۰۰ کیلو
    const r = calculateWeighbridge({ ...base, tareWeightKg: 12_000, grossWeightKg: 32_400 });
    expect(r.varianceKg).toBe(400);
    expect(r.variancePercent).toBe(2);
    expect(r.exceedsTolerance).toBe(false);
  });

  it('یک کیلو بیشتر از حد مجاز، مغایرت است', () => {
    const r = calculateWeighbridge({ ...base, tareWeightKg: 12_000, grossWeightKg: 32_401 });
    expect(r.exceedsTolerance).toBe(true);
    expect(r.message).toContain('تأیید انباردار');
  });

  it('کسری بار هم مغایرت محسوب می‌شود، نه فقط اضافه بار', () => {
    const r = calculateWeighbridge({ ...base, tareWeightKg: 12_000, grossWeightKg: 31_000 });
    expect(r.varianceKg).toBe(-1_000);
    expect(r.exceedsTolerance).toBe(true);
    expect(r.message).toContain('کمتر');
  });

  it('اضافه بار در پیام «بیشتر» گزارش می‌شود', () => {
    const r = calculateWeighbridge({ ...base, tareWeightKg: 12_000, grossWeightKg: 33_000 });
    expect(r.varianceKg).toBe(1_000);
    expect(r.message).toContain('بیشتر');
  });

  it('وقتی وزن دقیق بخواند، پیام مثبت می‌دهد', () => {
    const r = calculateWeighbridge({ ...base, tareWeightKg: 12_000, grossWeightKg: 32_000 });
    expect(r.message).toContain('دقیقاً');
  });

  it('حد مجاز از تنظیمات می‌آید و قابل تغییر است', () => {
    const strict = calculateWeighbridge({
      ...base,
      tareWeightKg: 12_000,
      grossWeightKg: 32_200,
      tolerancePercent: 0.5,
    });
    expect(strict.exceedsTolerance).toBe(true);

    const loose = calculateWeighbridge({
      ...base,
      tareWeightKg: 12_000,
      grossWeightKg: 32_200,
      tolerancePercent: 5,
    });
    expect(loose.exceedsTolerance).toBe(false);
  });

  it('روی بارهای بزرگ هم درصد درست حساب می‌شود', () => {
    const r = calculateWeighbridge({
      receiptWeightKg: 100_000,
      tolerancePercent: 2,
      tareWeightKg: 15_000,
      grossWeightKg: 118_000,
    });
    expect(r.netWeightKg).toBe(103_000);
    expect(r.varianceKg).toBe(3_000);
    expect(r.variancePercent).toBe(3);
    expect(r.exceedsTolerance).toBe(true);
  });
});
