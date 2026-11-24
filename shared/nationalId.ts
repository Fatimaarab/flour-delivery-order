/**
 * اعتبارسنجی کد ملی (اشخاص حقیقی) و شناسه ملی (اشخاص حقوقی).
 *
 * هر دو شماره رقم کنترلی دارند؛ یعنی می‌توان بدون هیچ استعلامی فهمید که عددی
 * اصلاً نمی‌تواند معتبر باشد. این جلوی ثبت غلط‌های تایپی را می‌گیرد — که در
 * سندی که پای مالیات و حسابرسی در میان است اهمیت دارد.
 *
 * ⚠️ این فقط ساختار عدد را بررسی می‌کند، نه اینکه واقعاً به کسی تعلق دارد.
 */

import { digitsOnly } from './digits.js';

/** کد ملی اشخاص حقیقی: ۱۰ رقم با رقم کنترلی. */
export function isValidNationalId(input: string): boolean {
  const id = digitsOnly(input);
  if (id.length !== 10) return false;

  // کدهایی مثل ۰۰۰۰۰۰۰۰۰۰ یا ۱۱۱۱۱۱۱۱۱۱ از نظر ریاضی درست‌اند ولی معتبر نیستند
  if (/^(\d)\1{9}$/.test(id)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(id[i]) * (10 - i);
  }

  const remainder = sum % 11;
  const checkDigit = Number(id[9]);

  return remainder < 2 ? checkDigit === remainder : checkDigit === 11 - remainder;
}

/** شناسه ملی اشخاص حقوقی: ۱۱ رقم با رقم کنترلی. */
export function isValidLegalId(input: string): boolean {
  const id = digitsOnly(input);
  if (id.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(id)) return false;

  const coefficients = [29, 27, 23, 19, 17, 29, 27, 23, 19, 17];
  const decimalPlus2 = Number(id[9]) + 2;

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += (Number(id[i]) + decimalPlus2) * coefficients[i]!;
  }

  let remainder = sum % 11;
  if (remainder === 10) remainder = 0;

  return remainder === Number(id[10]);
}

/** بسته به حقیقی یا حقوقی بودن، شناسه درست را بررسی می‌کند. */
export function isValidPartyId(input: string, kind: 'INDIVIDUAL' | 'COMPANY'): boolean {
  return kind === 'INDIVIDUAL' ? isValidNationalId(input) : isValidLegalId(input);
}

/** شماره موبایل ایران: ۱۱ رقم که با ۰۹ شروع می‌شود. */
export function isValidMobile(input: string): boolean {
  return /^09\d{9}$/.test(digitsOnly(input));
}
