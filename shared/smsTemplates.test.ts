import { describe, expect, it } from 'vitest';
import { driverIssuedText, managerIssuedText, type SmsReceiptInfo } from './smsTemplates.js';

const receipt: SmsReceiptInfo = {
  receiptNumber: '1405-0012',
  customerName: 'نانوایی سنگک مرکزی برکت',
  totalWeightKg: 16_000,
  items: [
    { productName: 'آرد خبازی نوع ۱', bagCount: 300 },
    { productName: 'آرد ستاره فانتزی', bagCount: 100 },
  ],
  issuerName: 'علیرضا عرب‌آبادی',
  driverName: 'اصغر محمدی',
};

describe('متن پیامک‌ها', () => {
  it('پیامک راننده شماره حواله، بار و مقصد را دارد', () => {
    const text = driverIssuedText('شرکت آرد طلای سفید ماهان', receipt);
    expect(text).toContain('شرکت آرد طلای سفید ماهان');
    expect(text).toContain('۱۴۰۵-۰۰۱۲');
    expect(text).toContain('۳۰۰ کیسه آرد خبازی نوع ۱');
    expect(text).toContain('۱۰۰ کیسه آرد ستاره فانتزی');
    expect(text).toContain('۱۶ تُن');
    expect(text).toContain('نانوایی سنگک مرکزی برکت');
  });

  it('پیامک مدیر نام راننده و صادرکننده را دارد', () => {
    const text = managerIssuedText(receipt);
    expect(text).toContain('۱۴۰۵-۰۰۱۲');
    expect(text).toContain('راننده: اصغر محمدی');
    expect(text).toContain('صادرکننده: علیرضا عرب‌آبادی');
  });

  it('اگر راننده هنوز ثبت نشده، سطر راننده در پیامک مدیر نمی‌آید', () => {
    const text = managerIssuedText({ ...receipt, driverName: null });
    expect(text).not.toContain('راننده:');
  });

  // ⭐ قانون ثبت‌شده: مبلغ روی گوشی کسی نمی‌رود
  it('هیچ پیامکی مبلغ ندارد', () => {
    for (const text of [driverIssuedText('شرکت', receipt), managerIssuedText(receipt)]) {
      expect(text).not.toMatch(/ریال|تومان|مبلغ/);
    }
  });
});
