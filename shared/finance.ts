/**
 * مدل حساب مشتری — منطق مالی سامانه.
 *
 * ── به زبان ساده ──────────────────────────────────────────────────────────
 * «مانده حساب» مشتری یک عدد است:
 *   • منفی یعنی مشتری به کارخانه **بدهکار** است
 *   • مثبت یعنی مشتری از قبل پول گذاشته و **بستانکار** است
 *   • صفر یعنی حساب تسویه است
 *
 * دو اتفاق مانده را جابه‌جا می‌کنند:
 *   ۱. **تأیید مالی حواله:** هر مبلغی که هنوز پرداخت نشده، به بدهی مشتری
 *      اضافه می‌شود. اگر حواله کامل نقد پرداخت شده باشد، بدهی‌ای ایجاد نمی‌شود.
 *   ۲. **ثبت پرداخت:** پول دریافتی از بدهی کم می‌کند.
 *
 * «سقف اعتبار» یعنی بیشترین بدهی‌ای که برای آن مشتری مجاز است. هنگام تأیید
 * مالی بررسی می‌شود: اگر این حواله بدهی را از سقف رد کند، تأیید انجام نمی‌شود.
 * ─────────────────────────────────────────────────────────────────────────
 */

export const PAYMENT_METHODS = [
  'CASH',
  'POS',
  'BANK_TRANSFER',
  'CHEQUE',
  'CREDIT',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'نقدی',
  POS: 'کارت‌خوان',
  BANK_TRANSFER: 'واریز بانکی',
  CHEQUE: 'چک',
  CREDIT: 'کسر از اعتبار',
};

/** روش‌هایی که پول واقعی جابه‌جا می‌کنند (برخلاف «کسر از اعتبار»). */
export const REAL_PAYMENT_METHODS: readonly PaymentMethod[] = [
  'CASH',
  'POS',
  'BANK_TRANSFER',
  'CHEQUE',
];

/** روش‌هایی که شماره پیگیری اجباری دارند. */
export const METHODS_REQUIRING_REFERENCE: readonly PaymentMethod[] = [
  'BANK_TRANSFER',
  'CHEQUE',
];

export interface CreditCheckInput {
  /** مانده فعلی مشتری (منفی = بدهکار) */
  balance: number;
  creditLimit: number;
  /** مبلغی که قرار است به بدهی اضافه شود */
  unpaidAmount: number;
}

export interface CreditCheckResult {
  allowed: boolean;
  /** بدهی مشتری پس از این حواله */
  resultingDebt: number;
  /** اعتبار باقی‌مانده پیش از این حواله */
  availableCredit: number;
  reason?: string;
}

export function formatKg(kg: number): string {
  return (kg / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 2 });
}

/**
 * آیا مشتری اعتبار کافی برای این حواله دارد؟
 *
 * بدهی = قرینه مانده، وقتی مانده منفی است. مثلاً مانده ۵۰۰− یعنی ۵۰۰ بدهی.
 *
 * ⚠️ در حال حاضر هیچ‌جای سامانه این کنترل را صدا نمی‌زند: با حذف مرحله تأیید
 * مالی، سقف اعتبار هم از کار افتاد (در فرم مشتری قابل تنظیم نیست و برای
 * مشتری تازه صفر است). تابع و آزمون‌هایش نگه داشته شده‌اند تا اگر روزی
 * کنترل اعتبار برگشت، از نو نوشته نشود.
 */
export function checkCredit(input: CreditCheckInput): CreditCheckResult {
  const currentDebt = Math.max(0, -input.balance);
  const availableCredit = Math.max(0, input.creditLimit - currentDebt);
  const resultingDebt = currentDebt + input.unpaidAmount;

  if (input.unpaidAmount <= 0) {
    return { allowed: true, resultingDebt: currentDebt, availableCredit };
  }

  if (resultingDebt > input.creditLimit) {
    return {
      allowed: false,
      resultingDebt,
      availableCredit,
      reason:
        `این حواله از سقف اعتبار مشتری عبور می‌کند. ` +
        `سقف اعتبار: ${input.creditLimit.toLocaleString('fa-IR')} ریال، ` +
        `بدهی فعلی: ${currentDebt.toLocaleString('fa-IR')} ریال، ` +
        `اعتبار باقی‌مانده: ${availableCredit.toLocaleString('fa-IR')} ریال، ` +
        `مبلغ پرداخت‌نشده این حواله: ${input.unpaidAmount.toLocaleString('fa-IR')} ریال. ` +
        `برای ادامه، مشتری باید بخشی از مبلغ را پرداخت کند.`,
    };
  }

  return { allowed: true, resultingDebt, availableCredit };
}

/** آیا این پرداخت از نظر مبلغ معتبر است؟ */
export function validatePaymentAmount(
  amount: number,
  outstanding: number,
): { valid: boolean; reason?: string } {
  if (!Number.isInteger(amount) || amount <= 0) {
    return { valid: false, reason: 'مبلغ پرداخت باید عددی صحیح و بزرگ‌تر از صفر باشد.' };
  }
  if (amount > outstanding) {
    return {
      valid: false,
      reason:
        `مبلغ پرداخت از مانده این حواله بیشتر است. ` +
        `مانده: ${outstanding.toLocaleString('fa-IR')} ریال.`,
    };
  }
  return { valid: true };
}
