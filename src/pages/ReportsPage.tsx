import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, Download, Loader2, AlertCircle, FileText } from 'lucide-react';
import { JalaliDateInput } from '../components/JalaliDateInput';
import { api, ApiError } from '../lib/api';
import { formatPlateForDisplay } from '../../shared/plate';
import { ReportPrintView } from '../components/print/ReportPrintView';
import { useAuth } from '../auth/AuthContext';
import { formatRial } from '../../shared/money';
import { formatJalaliDate } from '../lib/jalali';

interface ReportMeta {
  key: string;
  label: string;
}

type Row = Record<string, unknown>;

/** ستون‌های نمایشی هر گزارش روی صفحه. */
/** پلاک در گزارش، به همان شکلی که روی برگه چاپی دیده می‌شود. */
const plateText = (v: unknown) =>
  v ? formatPlateForDisplay(String(v)) : '—';

/** تاریخ شمسی، روز هفته یا ساعت یک لحظه، به وقت تهران. */
function tehranPart(value: unknown, part: 'date' | 'weekday' | 'time'): string {
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '—';
  const opts: Record<typeof part, Intl.DateTimeFormatOptions> = {
    date: { year: 'numeric', month: '2-digit', day: '2-digit' },
    weekday: { weekday: 'long' },
    time: { hour: '2-digit', minute: '2-digit', hour12: false },
  };
  return new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', ...opts[part] }).format(d);
}

const isDailyTotal = (r: Row) => r.kind === 'dayTotal' || r.kind === 'grandTotal';
const bold = (r: Row, v: React.ReactNode) =>
  isDailyTotal(r) ? <span className="font-black bg-amber-100 px-1 rounded">{v}</span> : v;

/** سلول‌های ستون‌های اول «فروش روزانه»؛ در سطر جمع به‌جای حواله، برچسب جمع می‌آید. */
const DailyCell: React.FC<{ r: Row; part: 'date' | 'weekday' | 'time' | 'number' }> = ({ r, part }) => {
  if (!isDailyTotal(r)) {
    return <>{part === 'number' ? String(r.receiptNumber) : tehranPart(r.soldAt, part)}</>;
  }
  if (part === 'date') return <span className="font-black">{r.kind === 'grandTotal' ? 'جمع کل' : `جمع ${tehranPart(r.soldAt, 'date')}`}</span>;
  if (part === 'number') return <span className="font-black">{Number(r.count).toLocaleString('fa-IR')} حواله</span>;
  return null;
};

const COLUMNS: Record<string, { header: string; render: (r: Row) => React.ReactNode }[]> = {
  'sales-daily': [
    { header: 'تاریخ', render: (r) => <DailyCell r={r} part="date" /> },
    { header: 'روز', render: (r) => <DailyCell r={r} part="weekday" /> },
    { header: 'ساعت', render: (r) => <DailyCell r={r} part="time" /> },
    { header: 'شماره حواله', render: (r) => <DailyCell r={r} part="number" /> },
    { header: 'نام مشتری', render: (r) => (isDailyTotal(r) ? '' : String(r.customerName)) },
    { header: 'نام راننده', render: (r) => (isDailyTotal(r) ? '' : String(r.driverName ?? '—')) },
    { header: 'محصول', render: (r) => (isDailyTotal(r) ? '' : String(r.products)) },
    { header: 'تعداد کیسه', render: (r) => bold(r, Number(r.bagCount).toLocaleString('fa-IR')) },
    { header: 'وزن', render: (r) => bold(r, `${(Number(r.weightKg) / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 2 })} تُن`) },
    { header: 'مبلغ (ریال)', render: (r) => bold(r, formatRial(Number(r.amount))) },
  ],
  'sales-monthly': [
    { header: 'ماه', render: (r) => formatJalaliDate(`${String(r.key)}-15`) },
    { header: 'تعداد حواله', render: (r) => Number(r.count).toLocaleString('fa-IR') },
    { header: 'وزن', render: (r) => `${(Number(r.weightKg) / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} تُن` },
    { header: 'مبلغ (ریال)', render: (r) => formatRial(Number(r.amount)) },
  ],
  'sales-by-product': [
    { header: 'کد', render: (r) => String(r.code) },
    { header: 'محصول', render: (r) => String(r.name) },
    { header: 'کیسه', render: (r) => Number(r.bagCount).toLocaleString('fa-IR') },
    { header: 'وزن', render: (r) => `${(Number(r.weightKg) / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} تُن` },
    { header: 'مبلغ (ریال)', render: (r) => formatRial(Number(r.amount)) },
  ],
  'sales-by-customer': [
    { header: 'مشتری', render: (r) => String(r.name) },
    { header: 'حواله', render: (r) => Number(r.count).toLocaleString('fa-IR') },
    { header: 'وزن', render: (r) => `${(Number(r.weightKg) / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} تُن` },
    { header: 'فروش (ریال)', render: (r) => formatRial(Number(r.amount)) },
    { header: 'پرداخت‌شده', render: (r) => formatRial(Number(r.paid)) },
    {
      header: 'مانده حساب',
      render: (r) => {
        const b = Number(r.balance);
        if (b === 0) return <span className="text-slate-500">تسویه</span>;
        return (
          <span className={b < 0 ? 'text-red-800 font-black' : 'text-emerald-800 font-black'}>
            {formatRial(Math.abs(b))} {b < 0 ? 'بدهکار' : 'بستانکار'}
          </span>
        );
      },
    },
  ],
  outstanding: [
    { header: 'شماره حواله', render: (r) => String(r.receiptNumber) },
    { header: 'مشتری', render: (r) => (r.customer as { name: string }).name },
    { header: 'تلفن', render: (r) => (r.customer as { phone: string | null }).phone ?? '—' },
    { header: 'مانده (ریال)', render: (r) => formatRial(Number(r.outstanding)) },
    {
      header: 'تأخیر',
      render: (r) => {
        const days = Number(r.daysOverdue);
        return days > 0 ? (
          <span className="text-red-800 font-black">{days.toLocaleString('fa-IR')} روز</span>
        ) : (
          <span className="text-slate-500">در مهلت</span>
        );
      },
    },
  ],
  shipments: [
    { header: 'شماره حواله', render: (r) => String(r.receiptNumber) },
    { header: 'تاریخ', render: (r) => formatJalaliDate(String(r.issueDate)) },
    { header: 'مشتری', render: (r) => String(r.customerName) },
    { header: 'محصول', render: (r) => String(r.products) },
    { header: 'نام راننده', render: (r) => String(r.driverName ?? '—') },
    { header: 'کد ملی راننده', render: (r) => String(r.driverNationalId ?? '—') },
    { header: 'پلاک خودرو', render: (r) => plateText(r.plateNumber) },
    { header: 'شرکت حمل', render: (r) => String(r.carrierCompany ?? '—') },
    {
      header: 'وزن',
      render: (r) => {
        const net = r.netWeightKg ? Number(r.netWeightKg) : null;
        const receiptKg = Number(r.receiptWeightKg);
        return (
          <span>
            {(receiptKg / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 2 })} تُن
            {net !== null && net !== receiptKg && (
              <span className="text-amber-800 font-bold">
                {' '}
                (باسکول: {(net / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 2 })})
              </span>
            )}
          </span>
        );
      },
    },
  ],
};

const NEEDS_RANGE = new Set([
  'sales-daily', 'sales-monthly', 'sales-by-product', 'sales-by-customer',
  'outstanding', 'shipments',
]);

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [companyName, setCompanyName] = useState('شرکت آرد طلای سفید ماهان');
  const [active, setActive] = useState<string>('sales-daily');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    void api
      .get<{ reports: ReportMeta[]; companyName: string | null }>('/reports')
      .then((d) => {
        setReports(d.reports);
        if (d.companyName) setCompanyName(d.companyName);
      })
      .catch(() => undefined);
  }, []);

  const query = useCallback(() => {
    const q = new URLSearchParams();
    if (from) q.set('from', new Date(from).toISOString());
    if (to) {
      // تا پایان همان روز، وگرنه حواله‌های خود آن روز جا می‌مانند
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      q.set('to', end.toISOString());
    }
    return q.toString();
  }, [from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ rows: Row[] }>(`/reports/${active}?${query()}`);
      setRows(data.rows);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'دریافت گزارش ناموفق بود.');
    } finally {
      setLoading(false);
    }
  }, [active, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = COLUMNS[active] ?? [];
  const activeLabel = reports.find((r) => r.key === active)?.label ?? 'گزارش';

  /**
   * خروجی PDF — از قابلیت چاپ خود مرورگر استفاده می‌کند.
   *
   * کاربر در پنجره چاپ ویندوز، مقصد را «Save as PDF» می‌گذارد. هیچ
   * کتابخانه‌ای لازم نیست و فارسی و راست‌به‌چپ دقیقاً درست درمی‌آیند.
   */
  const handlePdf = () => {
    document.documentElement.dataset.print = 'report';
    document.body.classList.add('printing');
    window.print();

    window.setTimeout(() => {
      document.body.classList.remove('printing');
      delete document.documentElement.dataset.print;
    }, 500);
  };
  const inputCls =
    'px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:bg-white focus:outline-amber-500';

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-800 flex items-center justify-center">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div className="text-xs font-black text-slate-900">گزارش‌ها</div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {reports.map((r) => (
            <button key={r.key} onClick={() => setActive(r.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                active === r.key ? 'bg-slate-900 text-amber-400' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}>
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-2 pt-1 border-t border-slate-100">
          {NEEDS_RANGE.has(active) && (
            <>
              <JalaliDateInput label="از تاریخ" value={from} onChange={setFrom} className="w-36" />
              <JalaliDateInput label="تا تاریخ" value={to} onChange={setTo} className="w-36" />
              {(from || to) && (
                <button onClick={() => { setFrom(''); setTo(''); }}
                  className="text-slate-500 hover:text-slate-800 text-xs font-bold px-2 py-2 cursor-pointer">
                  حذف بازه
                </button>
              )}
            </>
          )}

          <div className="mr-auto flex items-center gap-2">
            <button onClick={handlePdf} disabled={loading}
              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-amber-400 font-black px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer">
              <FileText className="w-4 h-4" />
              <span>خروجی PDF</span>
            </button>

            <a href={`/api/reports/${active}/export?${query()}`}
              title="خروجی اکسل (CSV)"
              className="text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 font-bold px-3 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer">
              <Download className="w-3.5 h-3.5" />
              <span>اکسل</span>
            </a>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-300 rounded-2xl p-3 flex items-center gap-2 text-xs text-red-800 font-bold">
          <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-10 text-center"><Loader2 className="w-6 h-6 text-slate-300 mx-auto animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-slate-500 font-bold text-sm">
            داده‌ای برای این گزارش وجود ندارد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  {columns.map((c) => (
                    <th key={c.header} className="py-3 px-3 whitespace-nowrap">{c.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {rows.map((row, i) => (
                  <tr key={i} className="hover:bg-amber-50/40 transition">
                    {columns.map((c) => (
                      <td key={c.header} className="py-3 px-3 whitespace-nowrap">{c.render(row)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-500 font-bold text-center">
        {rows.length.toLocaleString('fa-IR')} سطر
      </p>

      {/*
        ناحیه چاپ با Portal مستقیم زیر <body> قرار می‌گیرد.

        قاعده چاپ، همه فرزندان مستقیم body را پنهان می‌کند به‌جز این ناحیه.
        اگر اینجا داخل درخت معمولی می‌ماند، همراه بقیه پنهان می‌شد و PDF
        خالی تولید می‌کرد.
      */}
      {createPortal(
        <div className="print-root hidden print:block">
          <ReportPrintView
            companyName={companyName}
            reportLabel={activeLabel}
            columns={columns}
            rows={rows}
            from={from || undefined}
            to={to || undefined}
            generatedBy={user?.fullName ?? '—'}
          />
        </div>,
        document.body,
      )}
    </div>
  );
};
