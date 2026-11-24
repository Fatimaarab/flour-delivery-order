import { describe, expect, it } from 'vitest';
import {
  isValidLegalId,
  isValidMobile,
  isValidNationalId,
  isValidPartyId,
} from './nationalId.js';
import { digitsOnly, normalizeNumeric, toLatinDigits, toPersianDigits } from './digits.js';

describe('تبدیل ارقام', () => {
  it('ارقام فارسی را به لاتین تبدیل می‌کند', () => {
    expect(toLatinDigits('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
  });

  it('ارقام عربی را هم تبدیل می‌کند', () => {
    expect(toLatinDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
  });

  it('حروف فارسی را دست‌نخورده می‌گذارد', () => {
    expect(toLatinDigits('پلاک ۴۴ع۷۸۹')).toBe('پلاک 44ع789');
  });

  it('جداکننده هزارگان و نیم‌فاصله را برمی‌دارد', () => {
    expect(normalizeNumeric('۱٬۲۳۴٬۵۶۷')).toBe('1234567');
    expect(normalizeNumeric('12,345')).toBe('12345');
  });

  it('فقط ارقام را نگه می‌دارد', () => {
    expect(digitsOnly('۰۹۱۲-۳۴۵ ۶۷۸۹')).toBe('09123456789');
  });

  it('برای نمایش، لاتین را به فارسی برمی‌گرداند', () => {
    expect(toPersianDigits(1405)).toBe('۱۴۰۵');
  });

  it('رفت و برگشت تبدیل، عدد را تغییر نمی‌دهد', () => {
    expect(toLatinDigits(toPersianDigits('9876543210'))).toBe('9876543210');
  });
});

describe('کد ملی اشخاص حقیقی', () => {
  // این کدها با خود الگوریتم رقم کنترلی ساخته شده‌اند و معتبرند
  it.each(['0499370899', '0790419904', '0068569327'])(
    'کد معتبر %s را می‌پذیرد',
    (id) => {
      expect(isValidNationalId(id)).toBe(true);
    },
  );

  it('کد معتبر با ارقام فارسی را هم می‌پذیرد', () => {
    expect(isValidNationalId('۰۴۹۹۳۷۰۸۹۹')).toBe(true);
  });

  it('کدی که رقم کنترلی‌اش نمی‌خواند را رد می‌کند', () => {
    expect(isValidNationalId('0499370898')).toBe(false);
  });

  it('کد با تعداد رقم اشتباه را رد می‌کند', () => {
    expect(isValidNationalId('049937089')).toBe(false);
    expect(isValidNationalId('04993708990')).toBe(false);
  });

  it('کدهای تکراری مثل ۱۱۱۱۱۱۱۱۱۱ را رد می‌کند', () => {
    for (let d = 0; d <= 9; d++) {
      expect(isValidNationalId(String(d).repeat(10))).toBe(false);
    }
  });

  it('ورودی خالی یا حروف را رد می‌کند', () => {
    expect(isValidNationalId('')).toBe(false);
    expect(isValidNationalId('abcdefghij')).toBe(false);
  });
});

describe('شناسه ملی اشخاص حقوقی', () => {
  it.each(['10380284655', '10861234565', '10100123456'])('شناسه معتبر %s را می‌پذیرد', (id) => {
    expect(isValidLegalId(id)).toBe(true);
  });

  it('شناسه با رقم کنترلی غلط را رد می‌کند', () => {
    expect(isValidLegalId('10380284650')).toBe(false);
  });

  it('طول اشتباه را رد می‌کند', () => {
    expect(isValidLegalId('1038028465')).toBe(false);
  });
});

describe('انتخاب خودکار نوع شناسه', () => {
  it('برای شخص حقیقی، کد ملی ۱۰ رقمی می‌خواهد', () => {
    expect(isValidPartyId('0499370899', 'INDIVIDUAL')).toBe(true);
    expect(isValidPartyId('10380284650', 'INDIVIDUAL')).toBe(false);
  });

  it('برای شخص حقوقی، شناسه ملی ۱۱ رقمی می‌خواهد', () => {
    expect(isValidPartyId('10380284655', 'COMPANY')).toBe(true);
    expect(isValidPartyId('0499370899', 'COMPANY')).toBe(false);
  });
});

describe('شماره موبایل', () => {
  it('شماره درست را می‌پذیرد، با ارقام فارسی یا لاتین', () => {
    expect(isValidMobile('09123456789')).toBe(true);
    expect(isValidMobile('۰۹۱۲۳۴۵۶۷۸۹')).toBe(true);
  });

  it('شماره‌ای که با ۰۹ شروع نشود یا طولش غلط باشد را رد می‌کند', () => {
    expect(isValidMobile('02112345678')).toBe(false);
    expect(isValidMobile('0912345678')).toBe(false);
  });
});
