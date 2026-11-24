import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncRoute } from '../../middleware/errorHandler.js';
import { requirePermission } from '../../middleware/authorize.js';
import { badRequest } from '../../lib/errors.js';
import { formatPlateForDisplay } from '../../../shared/plate.js';
import { isoToJalaliText } from '../../../shared/jalaliDate.js';
import { csvFileName, toCsv, type Column } from './excel.js';
import {
  dailySalesDetail,
  outstandingReceipts,
  salesByCustomer,
  salesByPeriod,
  salesByProduct,
  shipmentsReport,
  type DateRange,
} from './service.js';

export const REPORT_KEYS = [
  'sales-daily',
  'sales-monthly',
  'sales-by-product',
  'sales-by-customer',
  'outstanding',
  'shipments',
] as const;

export type ReportKey = (typeof REPORT_KEYS)[number];

export const REPORT_LABELS: Record<ReportKey, string> = {
  'sales-daily': 'فروش روزانه',
  'sales-monthly': 'فروش ماهانه',
  'sales-by-product': 'فروش به تفکیک محصول',
  'sales-by-customer': 'فروش به تفکیک مشتری',
  outstanding: 'حواله‌های معوق و پرداخت‌نشده',
  shipments: 'راننده‌ها و پلاک‌ها',
};

const rangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

function parseRange(query: unknown): DateRange {
  const parsed = rangeSchema.parse(query);
  return {
    from: parsed.from ? new Date(parsed.from) : undefined,
    to: parsed.to ? new Date(parsed.to) : undefined,
  };
}

type Row = Record<string, unknown>;

async function runReport(key: ReportKey, range: DateRange): Promise<Row[]> {
  switch (key) {
    case 'sales-daily':
      return (await dailySalesDetail(range)) as unknown as Row[];
    case 'sales-monthly':
      return (await salesByPeriod(range, 'month')) as unknown as Row[];
    case 'sales-by-product':
      return (await salesByProduct(range)) as unknown as Row[];
    case 'sales-by-customer':
      return (await salesByCustomer(range)) as unknown as Row[];
    case 'outstanding':
      return (await outstandingReceipts(range)) as unknown as Row[];
    case 'shipments':
      return (await shipmentsReport(range)) as unknown as Row[];
  }
}

/** تاریخ شمسی، روز هفته و ساعت به وقت تهران — برای اکسل (ارقام لاتین تا اکسل عدد ببیند). */
function tehran(iso: string) {
  const d = new Date(iso);
  const f = (locale: string, o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Tehran', ...o }).format(d);
  return {
    date: f('fa-IR-u-nu-latn-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }),
    weekday: f('fa-IR', { weekday: 'long' }),
    time: f('fa-IR-u-nu-latn', { hour: '2-digit', minute: '2-digit', hour12: false }),
  };
}

const isTotal = (r: Row) => r.kind === 'dayTotal' || r.kind === 'grandTotal';
const totalLabel = (r: Row) => (r.kind === 'grandTotal' ? 'جمع کل (تعداد حواله در ستون شماره)' : 'جمع روز (تعداد حواله در ستون شماره)');

/** ستون‌های خروجی اکسل هر گزارش، با سرآیند فارسی. */
const CSV_COLUMNS: Record<ReportKey, readonly Column<Row>[]> = {
  'sales-daily': [
    { header: 'تاریخ', value: (r) => tehran(r.soldAt as string).date },
    { header: 'روز', value: (r) => (isTotal(r) ? totalLabel(r) : tehran(r.soldAt as string).weekday) },
    { header: 'ساعت', value: (r) => (isTotal(r) ? '' : tehran(r.soldAt as string).time) },
    { header: 'شماره حواله', value: (r) => (isTotal(r) ? (r.count as number) : (r.receiptNumber as string)) },
    { header: 'نام مشتری', value: (r) => (isTotal(r) ? '' : (r.customerName as string)) },
    { header: 'نام راننده', value: (r) => (isTotal(r) ? '' : (r.driverName as string)) },
    { header: 'محصول', value: (r) => (isTotal(r) ? '' : (r.products as string)) },
    { header: 'تعداد کیسه', value: (r) => r.bagCount as number },
    { header: 'وزن (کیلوگرم)', value: (r) => r.weightKg as number },
    { header: 'مبلغ (ریال)', value: (r) => r.amount as number },
  ],
  'sales-monthly': [
    // کلید ماه به صورت «۲۰۲۶-۱۰» است؛ روز پانزدهم برای تبدیل کافی است
    { header: 'ماه', value: (r) => isoToJalaliText(`${r.key as string}-15`).slice(0, 7) },
    { header: 'تعداد حواله', value: (r) => r.count as number },
    { header: 'وزن (کیلوگرم)', value: (r) => r.weightKg as number },
    { header: 'مبلغ (ریال)', value: (r) => r.amount as number },
  ],
  'sales-by-product': [
    { header: 'کد محصول', value: (r) => r.code as string },
    { header: 'نام محصول', value: (r) => r.name as string },
    { header: 'تعداد کیسه', value: (r) => r.bagCount as number },
    { header: 'وزن (کیلوگرم)', value: (r) => r.weightKg as number },
    { header: 'مبلغ (ریال)', value: (r) => r.amount as number },
  ],
  'sales-by-customer': [
    { header: 'کد مشتری', value: (r) => r.code as string },
    { header: 'نام مشتری', value: (r) => r.name as string },
    { header: 'تعداد حواله', value: (r) => r.count as number },
    { header: 'وزن (کیلوگرم)', value: (r) => r.weightKg as number },
    { header: 'مبلغ فروش (ریال)', value: (r) => r.amount as number },
    { header: 'پرداخت‌شده (ریال)', value: (r) => r.paid as number },
    { header: 'مانده حساب (ریال)', value: (r) => r.balance as number },
  ],
  outstanding: [
    { header: 'شماره حواله', value: (r) => r.receiptNumber as string },
    { header: 'مشتری', value: (r) => (r.customer as { name: string }).name },
    { header: 'تلفن', value: (r) => (r.customer as { phone: string | null }).phone },
    { header: 'مبلغ کل (ریال)', value: (r) => r.grandTotal as number },
    { header: 'پرداخت‌شده (ریال)', value: (r) => r.paidAmount as number },
    { header: 'مانده (ریال)', value: (r) => r.outstanding as number },
    { header: 'روزهای گذشته از اعتبار', value: (r) => r.daysOverdue as number },
  ],
  shipments: [
    { header: 'شماره حواله', value: (r) => r.receiptNumber as string },
    { header: 'تاریخ', value: (r) => isoToJalaliText(String(r.issueDate)) },
    { header: 'مشتری', value: (r) => r.customerName as string },
    { header: 'محصول', value: (r) => r.products as string },
    { header: 'نام راننده', value: (r) => r.driverName as string },
    { header: 'کد ملی راننده', value: (r) => r.driverNationalId as string },
    { header: 'موبایل راننده', value: (r) => r.driverMobile as string },
    { header: 'پلاک خودرو', value: (r) => formatPlateForDisplay(String(r.plateNumber ?? '')) },
    { header: 'حمل', value: (r) => r.carrierCompany as string },
    { header: 'وزن حواله (کیلوگرم)', value: (r) => r.receiptWeightKg as number },
    { header: 'وزن باسکول (کیلوگرم)', value: (r) => r.netWeightKg as number },
  ],
};

export const reportsRouter = Router();

reportsRouter.use(requirePermission('report:read'));

reportsRouter.get(
  '/',
  asyncRoute(async (_req, res) => {
    // نام شرکت برای سربرگ گزارش چاپی — از تنظیمات، نه هاردکد
    const company = await prisma.setting.findUnique({ where: { key: 'company_name' } });

    res.json({
      reports: REPORT_KEYS.map((key) => ({ key, label: REPORT_LABELS[key] })),
      companyName: company?.value ?? null,
    });
  }),
);

reportsRouter.get(
  '/:key',
  asyncRoute(async (req, res) => {
    const key = req.params.key as ReportKey;
    if (!REPORT_KEYS.includes(key)) throw badRequest('گزارشی با این نام وجود ندارد.');

    const range = parseRange(req.query);
    const rows = await runReport(key, range);

    res.json({ key, label: REPORT_LABELS[key], rows });
  }),
);

/** خروجی اکسل (CSV با BOM — اکسل مستقیم بازش می‌کند). */
reportsRouter.get(
  '/:key/export',
  asyncRoute(async (req, res) => {
    const key = req.params.key as ReportKey;
    if (!REPORT_KEYS.includes(key)) throw badRequest('گزارشی با این نام وجود ندارد.');

    const rows = await runReport(key, parseRange(req.query));
    const csv = toCsv(rows, CSV_COLUMNS[key]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${csvFileName(key)}"`);
    res.send(csv);
  }),
);
