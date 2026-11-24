import { prisma } from '../../lib/prisma.js';
import type { ReceiptStatus } from '../../../shared/receiptStateMachine.js';

/**
 * گزارش‌های سامانه.
 *
 * ── یک قاعده مشترک در همه گزارش‌های فروش ─────────────────────────────────
 * فقط حواله‌هایی شمرده می‌شوند که از نظر مالی تأیید شده‌اند. پیش‌نویس‌ها و
 * حواله‌های ابطال‌شده یا منقضی هرگز در آمار فروش نمی‌آیند — وگرنه گزارش،
 * فروشی را نشان می‌دهد که هرگز اتفاق نیفتاده.
 * ─────────────────────────────────────────────────────────────────────────
 */
const SOLD_STATUSES: ReceiptStatus[] = [
  // «صادر شده» هم فروش است: از وقتی تأیید مالی حذف شد، بدهی مشتری همان لحظه صدور ثبت می‌شود
  'ISSUED',
  'FINANCE_APPROVED',
  'READY_FOR_LOADING',
  'LOADED',
  'DISPATCHED',
  'CLOSED',
];

export interface DateRange {
  from?: Date;
  to?: Date;
}

function rangeFilter({ from, to }: DateRange) {
  if (!from && !to) return {};
  return { issueDate: { ...(from && { gte: from }), ...(to && { lte: to }) } };
}

const soldWhere = (range: DateRange) => ({
  deletedAt: null,
  status: { in: SOLD_STATUSES },
  ...rangeFilter(range),
});

/** ۱ و ۲ — فروش روزانه و ماهانه. */
export async function salesByPeriod(range: DateRange, period: 'day' | 'month') {
  const receipts = await prisma.receipt.findMany({
    where: soldWhere(range),
    select: { issueDate: true, grandTotal: true, totalWeightKg: true },
  });

  const buckets = new Map<string, { count: number; amount: number; weightKg: number }>();

  for (const r of receipts) {
    const d = r.issueDate;
    // کلید بر مبنای تاریخ میلادی ساخته می‌شود و در نمایش شمسی می‌شود
    const key =
      period === 'day'
        ? d.toISOString().slice(0, 10)
        : d.toISOString().slice(0, 7);

    const bucket = buckets.get(key) ?? { count: 0, amount: 0, weightKg: 0 };
    bucket.count += 1;
    bucket.amount += Number(r.grandTotal);
    bucket.weightKg += r.totalWeightKg;
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * ۱-الف — فروش روزانه با جزئیات: یک سطر برای هر حواله.
 *
 * ساعت، ساعت صدور نهایی است (از تاریخچه وضعیت)، نه ساعت ساخت پیش‌نویس؛
 * پیش‌نویسی که صبح ساخته و عصر صادر شده، عصر فروش حساب می‌شود.
 */
export async function dailySalesDetail(range: DateRange) {
  const receipts = await prisma.receipt.findMany({
    where: soldWhere(range),
    select: {
      receiptNumber: true,
      issueDate: true,
      totalWeightKg: true,
      grandTotal: true,
      customer: { select: { name: true } },
      items: { select: { bagCount: true, product: { select: { name: true } } } },
      shipment: { select: { driverName: true } },
      statusLogs: {
        where: { toStatus: 'ISSUED' },
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  const details = receipts
    .map((r) => ({
      kind: 'receipt' as const,
      receiptNumber: r.receiptNumber,
      soldAt: (r.statusLogs[0]?.createdAt ?? r.issueDate).toISOString(),
      customerName: r.customer.name,
      driverName: r.shipment?.driverName?.trim() || null,
      products: [...new Set(r.items.map((i) => i.product.name))].join('، '),
      bagCount: r.items.reduce((sum, i) => sum + i.bagCount, 0),
      weightKg: r.totalWeightKg,
      amount: Number(r.grandTotal),
    }))
    .sort((a, b) => a.soldAt.localeCompare(b.soldAt));

  // بعد از آخرین حواله هر روز (به وقت تهران)، یک سطر «جمع روز»؛ و در پایان «جمع کل»
  const dayOf = (iso: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date(iso));
  type Total = { count: number; bagCount: number; weightKg: number; amount: number };
  const zero = (): Total => ({ count: 0, bagCount: 0, weightKg: 0, amount: 0 });
  const add = (t: Total, r: (typeof details)[number]) => {
    t.count += 1;
    t.bagCount += r.bagCount;
    t.weightKg += r.weightKg;
    t.amount += r.amount;
  };

  const out: Array<
    (typeof details)[number] | ({ kind: 'dayTotal' | 'grandTotal'; soldAt: string } & Total)
  > = [];
  let day = zero();
  const grand = zero();
  details.forEach((r, i) => {
    out.push(r);
    add(day, r);
    add(grand, r);
    const next = details[i + 1];
    if (!next || dayOf(next.soldAt) !== dayOf(r.soldAt)) {
      out.push({ kind: 'dayTotal', soldAt: r.soldAt, ...day });
      day = zero();
    }
  });
  if (details.length > 0) {
    out.push({ kind: 'grandTotal', soldAt: details[details.length - 1]!.soldAt, ...grand });
  }
  return out;
}

/** ۳ — فروش به تفکیک محصول. */
export async function salesByProduct(range: DateRange) {
  const items = await prisma.receiptItem.findMany({
    where: { receipt: soldWhere(range) },
    select: {
      weightKg: true,
      bagCount: true,
      lineTotal: true,
      vatAmount: true,
      product: { select: { id: true, code: true, name: true } },
    },
  });

  const byProduct = new Map<
    number,
    { code: string; name: string; bagCount: number; weightKg: number; amount: number }
  >();

  for (const i of items) {
    const row = byProduct.get(i.product.id) ?? {
      code: i.product.code,
      name: i.product.name,
      bagCount: 0,
      weightKg: 0,
      amount: 0,
    };
    row.bagCount += i.bagCount;
    row.weightKg += i.weightKg;
    row.amount += Number(i.lineTotal) + Number(i.vatAmount);
    byProduct.set(i.product.id, row);
  }

  return [...byProduct.entries()]
    .map(([productId, v]) => ({ productId, ...v }))
    .sort((a, b) => b.amount - a.amount);
}

/** ۴ — فروش به تفکیک مشتری. */
export async function salesByCustomer(range: DateRange) {
  const receipts = await prisma.receipt.findMany({
    where: soldWhere(range),
    select: {
      grandTotal: true,
      paidAmount: true,
      totalWeightKg: true,
      customer: { select: { id: true, code: true, name: true, balance: true } },
    },
  });

  const byCustomer = new Map<
    number,
    { code: string; name: string; count: number; weightKg: number; amount: number; paid: number; balance: number }
  >();

  for (const r of receipts) {
    const row = byCustomer.get(r.customer.id) ?? {
      code: r.customer.code,
      name: r.customer.name,
      count: 0,
      weightKg: 0,
      amount: 0,
      paid: 0,
      balance: Number(r.customer.balance),
    };
    row.count += 1;
    row.weightKg += r.totalWeightKg;
    row.amount += Number(r.grandTotal);
    row.paid += Number(r.paidAmount);
    byCustomer.set(r.customer.id, row);
  }

  return [...byCustomer.entries()]
    .map(([customerId, v]) => ({ customerId, ...v }))
    .sort((a, b) => b.amount - a.amount);
}

/** ۵ — حواله‌های معوق و پرداخت‌نشده. */
export async function outstandingReceipts(range: DateRange) {
  const receipts = await prisma.receipt.findMany({
    where: soldWhere(range),
    select: {
      id: true,
      receiptNumber: true,
      issueDate: true,
      validUntil: true,
      status: true,
      grandTotal: true,
      paidAmount: true,
      customer: { select: { code: true, name: true, phone: true } },
    },
    orderBy: { issueDate: 'asc' },
  });

  const now = Date.now();

  return receipts
    .map((r) => ({
      ...r,
      grandTotal: Number(r.grandTotal),
      paidAmount: Number(r.paidAmount),
      outstanding: Number(r.grandTotal) - Number(r.paidAmount),
      daysOverdue: Math.max(
        0,
        Math.floor((now - r.validUntil.getTime()) / 86_400_000),
      ),
    }))
    .filter((r) => r.outstanding > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue || b.outstanding - a.outstanding);
}

/**
 * ۸ — بارگیری و خروج بار.
 *
 * گزارش‌های فروش، جمع‌بندی‌شده‌اند (بر حسب روز، محصول یا مشتری) و جایی برای
 * مشخصات راننده ندارند. این گزارش سطر‌به‌سطر است: هر بارگیری با نام راننده،
 * کد ملی و پلاک کامیون — همان چیزی که برای پیگیری یک بار مشخص لازم است.
 */
export async function shipmentsReport(range: DateRange) {
  const shipments = await prisma.shipment.findMany({
    where: {
      driverName: { not: '' },
      receipt: { deletedAt: null, ...rangeFilter(range) },
    },
    select: {
      driverName: true,
      driverNationalId: true,
      driverMobile: true,
      plateNumber: true,
      haulType: true,
      carrierCompany: true,
      netWeightKg: true,
      varianceKg: true,
      varianceApproved: true,
      loadedAt: true,
      dispatchedAt: true,
      receipt: {
        select: {
          receiptNumber: true,
          issueDate: true,
          status: true,
          totalWeightKg: true,
          customer: { select: { name: true } },
          items: { select: { product: { select: { name: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return shipments.map((s) => ({
    receiptNumber: s.receipt.receiptNumber,
    issueDate: s.receipt.issueDate,
    status: s.receipt.status,
    customerName: s.receipt.customer.name,
    products: [...new Set(s.receipt.items.map((i) => i.product.name))].join('، '),
    driverName: s.driverName,
    driverNationalId: s.driverNationalId,
    driverMobile: s.driverMobile,
    plateNumber: s.plateNumber,
    // در گزارش، «خود حمل» یک مقدار است نه خانه خالی
    carrierCompany: s.haulType === 'SELF' ? 'خود حمل' : s.carrierCompany,
    receiptWeightKg: s.receipt.totalWeightKg,
    netWeightKg: s.netWeightKg,
    varianceKg: s.varianceKg,
    varianceApproved: s.varianceApproved,
    loadedAt: s.loadedAt,
    dispatchedAt: s.dispatchedAt,
  }));
}
