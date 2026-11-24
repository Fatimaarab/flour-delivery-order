/**
 * محاسبه مبالغ حواله.
 *
 * ⚠️ این محاسبه همیشه در **سرور** انجام می‌شود. مبلغی که مرورگر می‌فرستد هرگز
 * مبنا قرار نمی‌گیرد — فقط برای نمایش زنده به کاربر همین تابع در مرورگر هم
 * اجرا می‌شود. سند مالی نباید به داده‌ای که از سمت کاربر می‌آید اعتماد کند.
 *
 * قواعد:
 *   • همه مبالغ ریال و عدد صحیح‌اند
 *   • مالیات روی مبلغ **پس از کسر تخفیف** حساب می‌شود
 *   • تخفیف سطح حواله، به نسبت مبلغ هر ردیف بین ردیف‌ها پخش می‌شود
 *   • یک حواله می‌تواند همزمان آرد یارانه‌ای (مالیات صفر) و آزاد (۱۰٪) داشته
 *     باشد؛ برای همین مالیات ردیف‌به‌ردیف حساب می‌شود، نه یکجا
 */

export interface CalcItemInput {
  bagCount: number;
  bagWeightKg: number;
  unitPricePerKg: number;
  vatPercent: number;
}

export interface CalcItemResult extends CalcItemInput {
  weightKg: number;
  lineTotal: number;
  /** سهم این ردیف از تخفیف کل */
  discountShare: number;
  vatAmount: number;
}

export interface CalcResult {
  items: CalcItemResult[];
  subtotal: number;
  discount: number;
  vatAmount: number;
  grandTotal: number;
  totalWeightKg: number;
  totalBagCount: number;
}

export class CalcError extends Error {}

/**
 * تخفیف را به نسبت مبلغ هر ردیف پخش می‌کند.
 *
 * چون مبالغ باید صحیح بمانند، گِرد کردن ممکن است باعث شود جمع سهم‌ها با
 * تخفیف کل یکی نباشد. باقی‌مانده عمداً به آخرین ردیف داده می‌شود تا جمع
 * همیشه **دقیقاً** برابر تخفیف باشد — وگرنه فاکتور چند ریال اختلاف پیدا می‌کند.
 */
function allocateDiscount(lineTotals: number[], discount: number): number[] {
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);
  if (discount === 0 || subtotal === 0) return lineTotals.map(() => 0);

  const shares = lineTotals.map((lt) => Math.floor((lt * discount) / subtotal));
  const allocated = shares.reduce((a, b) => a + b, 0);

  const remainder = discount - allocated;
  if (remainder !== 0) {
    // باقی‌مانده به بزرگ‌ترین ردیف می‌رود تا کمترین اثر نسبی را داشته باشد
    let biggest = 0;
    for (let i = 1; i < lineTotals.length; i++) {
      if (lineTotals[i]! > lineTotals[biggest]!) biggest = i;
    }
    shares[biggest] = shares[biggest]! + remainder;
  }

  return shares;
}

export function calculateReceipt(
  items: readonly CalcItemInput[],
  discount = 0,
): CalcResult {
  if (items.length === 0) {
    throw new CalcError('حواله باید دست‌کم یک قلم کالا داشته باشد.');
  }

  for (const [index, item] of items.entries()) {
    const row = index + 1;
    if (!Number.isInteger(item.bagCount) || item.bagCount <= 0) {
      throw new CalcError(`تعداد کیسه در ردیف ${row} باید عددی بزرگ‌تر از صفر باشد.`);
    }
    if (!Number.isInteger(item.bagWeightKg) || item.bagWeightKg <= 0) {
      throw new CalcError(`وزن کیسه در ردیف ${row} معتبر نیست.`);
    }
    if (!Number.isInteger(item.unitPricePerKg) || item.unitPricePerKg < 0) {
      throw new CalcError(`قیمت واحد در ردیف ${row} باید عدد صحیح و نامنفی باشد.`);
    }
    if (!Number.isInteger(item.vatPercent) || item.vatPercent < 0 || item.vatPercent > 100) {
      throw new CalcError(`درصد مالیات در ردیف ${row} معتبر نیست.`);
    }
  }

  if (!Number.isInteger(discount) || discount < 0) {
    throw new CalcError('تخفیف باید عدد صحیح و نامنفی باشد.');
  }

  const lineTotals = items.map((i) => i.bagCount * i.bagWeightKg * i.unitPricePerKg);
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);

  if (discount > subtotal) {
    throw new CalcError('تخفیف نمی‌تواند از جمع کل بیشتر باشد.');
  }

  const discountShares = allocateDiscount(lineTotals, discount);

  const calcItems: CalcItemResult[] = items.map((item, i) => {
    const lineTotal = lineTotals[i]!;
    const discountShare = discountShares[i]!;
    const taxableBase = lineTotal - discountShare;

    return {
      ...item,
      weightKg: item.bagCount * item.bagWeightKg,
      lineTotal,
      discountShare,
      vatAmount: Math.round((taxableBase * item.vatPercent) / 100),
    };
  });

  const vatAmount = calcItems.reduce((sum, i) => sum + i.vatAmount, 0);

  return {
    items: calcItems,
    subtotal,
    discount,
    vatAmount,
    grandTotal: subtotal - discount + vatAmount,
    totalWeightKg: calcItems.reduce((sum, i) => sum + i.weightKg, 0),
    totalBagCount: calcItems.reduce((sum, i) => sum + i.bagCount, 0),
  };
}
