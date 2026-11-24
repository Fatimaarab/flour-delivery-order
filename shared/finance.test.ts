import { describe, expect, it } from 'vitest';
import { checkCredit, validatePaymentAmount } from './finance.js';

describe('کنترل سقف اعتبار', () => {
  it('مشتری بدون بدهی، تا سقف اعتبارش می‌تواند حواله بگیرد', () => {
    const r = checkCredit({ balance: 0, creditLimit: 1_000_000_000, unpaidAmount: 900_000_000 });
    expect(r.allowed).toBe(true);
    expect(r.resultingDebt).toBe(900_000_000);
  });

  it('حواله‌ای که دقیقاً تا سقف اعتبار است، مجاز است', () => {
    const r = checkCredit({ balance: 0, creditLimit: 1_000_000_000, unpaidAmount: 1_000_000_000 });
    expect(r.allowed).toBe(true);
  });

  it('حتی یک ریال بیشتر از سقف، رد می‌شود', () => {
    const r = checkCredit({ balance: 0, creditLimit: 1_000_000_000, unpaidAmount: 1_000_000_001 });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('سقف اعتبار');
  });

  it('بدهی قبلی در محاسبه لحاظ می‌شود', () => {
    // مانده ۶۰۰ میلیون منفی یعنی ۶۰۰ میلیون بدهی؛ اعتبار باقی‌مانده ۴۰۰ میلیون
    const r = checkCredit({
      balance: -600_000_000,
      creditLimit: 1_000_000_000,
      unpaidAmount: 500_000_000,
    });
    expect(r.allowed).toBe(false);
    expect(r.availableCredit).toBe(400_000_000);
  });

  it('مشتری بستانکار، اعتبار کاملش را در اختیار دارد', () => {
    const r = checkCredit({
      balance: 200_000_000, // از قبل پول گذاشته
      creditLimit: 1_000_000_000,
      unpaidAmount: 900_000_000,
    });
    expect(r.allowed).toBe(true);
    expect(r.availableCredit).toBe(1_000_000_000);
  });

  it('حواله‌ای که کامل پرداخت شده، هرگز به سقف اعتبار برنمی‌خورد', () => {
    const r = checkCredit({
      balance: -999_999_999,
      creditLimit: 1_000_000_000,
      unpaidAmount: 0,
    });
    expect(r.allowed).toBe(true);
  });

  it('مشتری با سقف اعتبار صفر، فقط با پرداخت کامل می‌تواند حواله بگیرد', () => {
    expect(checkCredit({ balance: 0, creditLimit: 0, unpaidAmount: 1 }).allowed).toBe(false);
    expect(checkCredit({ balance: 0, creditLimit: 0, unpaidAmount: 0 }).allowed).toBe(true);
  });

  it('روی مبالغ میلیاردی دقت را از دست نمی‌دهد', () => {
    const r = checkCredit({
      balance: -19_000_000_000,
      creditLimit: 20_000_000_000,
      unpaidAmount: 1_000_000_000,
    });
    expect(r.allowed).toBe(true);
    expect(r.resultingDebt).toBe(20_000_000_000);
  });
});

describe('اعتبارسنجی مبلغ پرداخت', () => {
  it('پرداخت جزئی مجاز است', () => {
    expect(validatePaymentAmount(300_000, 1_000_000).valid).toBe(true);
  });

  it('پرداخت کامل مجاز است', () => {
    expect(validatePaymentAmount(1_000_000, 1_000_000).valid).toBe(true);
  });

  it('پرداخت بیش از مانده رد می‌شود', () => {
    const r = validatePaymentAmount(1_000_001, 1_000_000);
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('بیشتر');
  });

  it('مبلغ صفر یا منفی رد می‌شود', () => {
    expect(validatePaymentAmount(0, 1_000_000).valid).toBe(false);
    expect(validatePaymentAmount(-5, 1_000_000).valid).toBe(false);
  });

  it('مبلغ اعشاری رد می‌شود', () => {
    expect(validatePaymentAmount(1.5, 1_000_000).valid).toBe(false);
  });
});
