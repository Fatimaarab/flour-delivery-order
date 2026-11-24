/**
 * متن پیامک‌ها.
 *
 * ── چرا اینجا و جدا از کد ارسال ──────────────────────────────────────────
 * متن پیامک تصمیم کسب‌وکار است، نه جزئیات فنی: کارفرما دیر یا زود می‌خواهد
 * یک کلمه‌اش را عوض کند. همه متن‌ها در همین یک فایل‌اند تا آن تغییر، گشتن
 * در کد ارسال و صف نخواهد — و چون تابع‌ها خالص‌اند، با آزمون ثابت می‌مانند.
 *
 * ── چرا مبلغ در هیچ پیامکی نیست ──────────────────────────────────────────
 * همان منطق برگه حواله: راننده به قیمت کاری ندارد، و پیامک روی گوشی‌ای
 * می‌نشیند که دست هر کسی ممکن است بیفتد.
 * ────────────────────────────────────────────────────────────────────────
 */

import { toPersianDigits } from './digits.js';

export interface SmsReceiptInfo {
  receiptNumber: string;
  customerName: string;
  totalWeightKg: number;
  items: { productName: string; bagCount: number }[];
  issuerName: string;
  driverName?: string | null;
}

const tons = (kg: number) =>
  (kg / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 2 });

/** «۳۰۰ کیسه آرد خبازی، ۱۰۰ کیسه آرد ستاره» */
function itemsLine(items: SmsReceiptInfo['items']): string {
  return items
    .map((i) => `${toPersianDigits(i.bagCount)} کیسه ${i.productName}`)
    .join('، ');
}

/** پیامک راننده، هنگام صدور حواله. */
export function driverIssuedText(companyName: string, r: SmsReceiptInfo): string {
  return [
    companyName,
    `حواله ${toPersianDigits(r.receiptNumber)} به نام شما صادر شد.`,
    `بار: ${itemsLine(r.items)} (${tons(r.totalWeightKg)} تُن)`,
    `مقصد: ${r.customerName}`,
  ].join('\n');
}

/** پیامک مدیر کارخانه، هنگام صدور حواله. */
export function managerIssuedText(r: SmsReceiptInfo): string {
  return [
    `حواله ${toPersianDigits(r.receiptNumber)} صادر شد.`,
    `مشتری: ${r.customerName}`,
    `بار: ${itemsLine(r.items)} (${tons(r.totalWeightKg)} تُن)`,
    r.driverName ? `راننده: ${r.driverName}` : null,
    `صادرکننده: ${r.issuerName}`,
  ]
    .filter(Boolean)
    .join('\n');
}
