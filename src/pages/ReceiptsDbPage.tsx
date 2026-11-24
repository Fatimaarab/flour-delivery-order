import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Loader2, AlertCircle, FileText, Pencil, History, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { receiptApi, type Receipt, type ReceiptDetail } from '../lib/receiptApi';
import { ReceiptDraftForm } from '../components/ReceiptDraftForm';
import { ReceiptSmsPanel } from '../components/ReceiptSmsPanel';
import { IranPlateBadge } from '../components/IranPlate';
import { PrintDialog } from '../components/print/PrintDialog';
import { formatRial } from '../../shared/money';
import { formatJalaliDate, formatJalaliDateTime } from '../lib/jalali';
import {
  isExpired,
  RECEIPT_STATUSES,
  STATUS_LABELS,
  type ReceiptStatus,
} from '../../shared/receiptStateMachine';
import { useAuth } from '../auth/AuthContext';

const STATUS_STYLE: Record<ReceiptStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-300',
  ISSUED: 'bg-amber-100 text-amber-900 border-amber-300',
  FINANCE_APPROVED: 'bg-blue-100 text-blue-900 border-blue-300',
  READY_FOR_LOADING: 'bg-indigo-100 text-indigo-900 border-indigo-300',
  LOADED: 'bg-violet-100 text-violet-900 border-violet-300',
  DISPATCHED: 'bg-teal-100 text-teal-900 border-teal-300',
  CLOSED: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  CANCELLED: 'bg-red-100 text-red-900 border-red-300',
  RETURNED: 'bg-orange-100 text-orange-900 border-orange-300',
  EXPIRED: 'bg-slate-200 text-slate-600 border-slate-400',
};

export const ReceiptsDbPage: React.FC = () => {
  const { can } = useAuth();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Receipt | null>(null);
  const [detail, setDetail] = useState<ReceiptDetail | null>(null);
  const [acting, setActing] = useState(false);
  const [printing, setPrinting] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await receiptApi.list({ status, search, page });
      setReceipts(data.receipts);
      setTotal(data.total);
      setPageSize(data.pageSize);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'دریافت حواله‌ها ناموفق بود.');
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const openDetail = async (id: number) => {
    try {
      setDetail(await receiptApi.get(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'دریافت حواله ناموفق بود.');
    }
  };

  const runTransition = async (to: ReceiptStatus, action: string, requiresReason?: boolean) => {
    if (!detail || acting) return;

    let reason: string | undefined;
    if (requiresReason) {
      const answer = prompt(`دلیل «${action}» را بنویسید:`);
      if (!answer?.trim()) return;
      reason = answer.trim();
    }

    setActing(true);
    setError(null);
    try {
      await receiptApi.transition(detail.receipt.id, to, reason);
      await openDetail(detail.receipt.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تغییر وضعیت ناموفق بود.');
    } finally {
      setActing(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <Loader2 className="w-6 h-6 text-slate-300 mx-auto animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input type="text" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="جستجوی شماره حواله یا نام مشتری…"
            className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden" />
        </div>

        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold cursor-pointer focus:outline-amber-500">
          <option value="">همه وضعیت‌ها</option>
          {RECEIPT_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        {can('receipt:create') && (
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer">
            <Plus className="w-4 h-4" />
            <span>صدور حواله جدید</span>
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-300 rounded-2xl p-3 flex items-center gap-2 text-xs text-red-800 font-bold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">شماره</th>
                <th className="py-3 px-3">تاریخ</th>
                <th className="py-3 px-3">مشتری</th>
                <th className="py-3 px-3">اقلام</th>
                <th className="py-3 px-3">وزن</th>
                <th className="py-3 px-3">مبلغ نهایی</th>
                <th className="py-3 px-3">وضعیت</th>
                <th className="py-3 px-4 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {receipts.length === 0 ? (
                <tr><td colSpan={8} className="py-8 text-center text-slate-500 font-bold">حواله‌ای یافت نشد.</td></tr>
              ) : (
                receipts.map((r) => (
                  <tr key={r.id} className="hover:bg-amber-50/40 transition cursor-pointer"
                    onClick={() => void openDetail(r.id)}>
                    <td className="py-3 px-4 font-mono font-black text-slate-900">{r.receiptNumber}</td>
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{formatJalaliDate(r.issueDate)}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{r.customer.name}</td>
                    <td className="py-3 px-3 text-slate-700">
                      {r.items.length.toLocaleString('fa-IR')} قلم
                    </td>
                    <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                      {(r.totalWeightKg / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 2 })} تُن
                    </td>
                    <td className="py-3 px-3 font-black text-slate-900 whitespace-nowrap">{formatRial(r.grandTotal)}</td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`px-2 py-0.5 rounded-full font-bold border whitespace-nowrap ${STATUS_STYLE[r.status]}`}>
                          {STATUS_LABELS[r.status]}
                        </span>
                        {/* حواله‌ای که اعتبارش گذشته، دیگر تحویل نمی‌شود */}
                        {isExpired(r.validUntil) && !['CLOSED', 'CANCELLED', 'RETURNED', 'EXPIRED', 'DISPATCHED'].includes(r.status) && (
                          <span className="px-2 py-0.5 rounded-full font-bold border whitespace-nowrap bg-red-100 text-red-900 border-red-400">
                            اعتبار گذشته
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => void openDetail(r.id)} title="مشاهده"
                          className="text-slate-500 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer">
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setPrinting(r.id)} title="چاپ حواله"
                          className="bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer">
                          <Printer className="w-3.5 h-3.5" />
                          <span>چاپ</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="border-t border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-bold">
              {total.toLocaleString('fa-IR')} حواله • صفحه {page.toLocaleString('fa-IR')} از {totalPages.toLocaleString('fa-IR')}
            </span>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 transition cursor-pointer disabled:cursor-not-allowed">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 transition cursor-pointer disabled:cursor-not-allowed">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {printing !== null && (
        <PrintDialog receiptId={printing} onClose={() => setPrinting(null)} />
      )}

      {showForm && (
        <ReceiptDraftForm editing={editing} onClose={() => setShowForm(false)}
          onSaved={(r) => { setShowForm(false); void load(); void openDetail(r.id); }} />
      )}

      {detail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-3 overflow-y-auto no-print">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl my-4">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base font-mono">{detail.receipt.receiptNumber}</h3>
                <span className={`text-[11px] px-2 py-0.5 rounded-full border font-bold ${STATUS_STYLE[detail.receipt.status]}`}>
                  {STATUS_LABELS[detail.receipt.status]}
                </span>
              </div>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-white text-xl leading-none px-2 cursor-pointer">×</button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><div className="text-slate-500 font-bold">مشتری</div><div className="font-black text-slate-900">{detail.receipt.customer.name}</div></div>
                <div><div className="text-slate-500 font-bold">تاریخ صدور</div><div className="font-bold">{formatJalaliDate(detail.receipt.issueDate)}</div></div>
                <div>
                  <div className="text-slate-500 font-bold">اعتبار تا</div>
                  <div className={`font-bold ${isExpired(detail.receipt.validUntil) ? 'text-red-800' : ''}`}>
                    {formatJalaliDate(detail.receipt.validUntil)}
                  </div>
                </div>
                <div><div className="text-slate-500 font-bold">صادرکننده</div><div className="font-bold">{detail.receipt.issuedBy.fullName}</div></div>
              </div>

              <table className="w-full border-collapse border border-slate-300 text-center">
                <thead className="bg-slate-50 font-bold">
                  <tr>
                    <th className="border border-slate-300 p-1.5">محصول</th>
                    <th className="border border-slate-300 p-1.5">کیسه</th>
                    <th className="border border-slate-300 p-1.5">وزن</th>
                    <th className="border border-slate-300 p-1.5">قیمت هر کیلو</th>
                    <th className="border border-slate-300 p-1.5">مالیات</th>
                    <th className="border border-slate-300 p-1.5">جمع ردیف</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.receipt.items.map((i) => (
                    <tr key={i.id}>
                      <td className="border border-slate-300 p-1.5 text-right font-bold">{i.product.name}</td>
                      <td className="border border-slate-300 p-1.5">{i.bagCount.toLocaleString('fa-IR')}</td>
                      <td className="border border-slate-300 p-1.5">{(i.weightKg / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 2 })} تُن</td>
                      <td className="border border-slate-300 p-1.5">{formatRial(i.unitPricePerKg)}</td>
                      <td className="border border-slate-300 p-1.5">{i.vatPercent.toLocaleString('fa-IR')}٪</td>
                      <td className="border border-slate-300 p-1.5 font-bold">{formatRial(i.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="bg-slate-50 rounded-xl p-3 space-y-1 font-bold">
                <div className="flex justify-between"><span>جمع کل:</span><span>{formatRial(detail.receipt.subtotal)}</span></div>
                {detail.receipt.discount > 0 && <div className="flex justify-between"><span>تخفیف:</span><span>−{formatRial(detail.receipt.discount)}</span></div>}
                <div className="flex justify-between"><span>مالیات:</span><span>{formatRial(detail.receipt.vatAmount)}</span></div>
                <div className="flex justify-between text-sm font-black pt-1 border-t border-slate-200"><span>مبلغ نهایی:</span><span>{formatRial(detail.receipt.grandTotal)} ریال</span></div>
              </div>

              {isExpired(detail.receipt.validUntil) &&
                !['CLOSED', 'CANCELLED', 'RETURNED', 'EXPIRED', 'DISPATCHED'].includes(detail.receipt.status) && (
                  <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3 flex items-start gap-2 text-xs font-bold text-red-900">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      تاریخ اعتبار این حواله گذشته است و بار آن تحویل نمی‌شود.
                      مالی باید ابطالش کند و در صورت نیاز حواله تازه صادر شود.
                    </span>
                  </div>
                )}

              {/* راننده در حواله فقط انتخاب می‌شود (از بخش «رانندگان»)؛ اینجا فقط نمایش است */}
              {detail.receipt.shipment?.driverName && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div>
                    <div className="text-slate-500 font-bold">راننده</div>
                    <div className="font-black text-slate-900">{detail.receipt.shipment.driverName}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-bold">کد ملی</div>
                    <div className="font-mono font-bold">{detail.receipt.shipment.driverNationalId ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-bold">موبایل</div>
                    <div className="font-mono font-bold">{detail.receipt.shipment.driverMobile ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-bold">حمل</div>
                    <div className="font-bold">
                      {detail.receipt.shipment.haulType === 'SELF'
                        ? 'خود حمل'
                        : detail.receipt.shipment.carrierCompany || 'شرکت حمل'}
                    </div>
                  </div>
                  {detail.receipt.shipment.plateNumber && (
                    <IranPlateBadge plateString={detail.receipt.shipment.plateNumber} size="sm" />
                  )}
                </div>
              )}

              <ReceiptSmsPanel
                receiptId={detail.receipt.id}
                isDraft={detail.receipt.status === 'DRAFT'}
                canSend={can('sms:send')}
                reloadToken={`${detail.receipt.status}|${detail.receipt.shipment?.driverName ?? ''}|${detail.receipt.shipment?.driverMobile ?? ''}`}
              />

              {/* دکمه‌ها مستقیماً از جدول قوانین وضعیت ساخته می‌شوند */}
              {detail.transitions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
                  <span className="text-slate-500 font-bold">اقدام:</span>
                  {detail.transitions.map((t) => (
                    <button key={t.to} disabled={acting}
                      onClick={() => void runTransition(t.to, t.action, t.requiresReason)}
                      className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-amber-400 font-bold px-3 py-1.5 rounded-lg transition cursor-pointer">
                      {t.action}
                    </button>
                  ))}
                </div>
              )}

              <button onClick={() => { setPrinting(detail.receipt.id); setDetail(null); }}
                className="bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer">
                <Printer className="w-3.5 h-3.5" /><span>چاپ حواله و فاکتور</span>
              </button>

              {detail.editable && can('receipt:create') && (
                <button onClick={() => { setEditing(detail.receipt); setDetail(null); setShowForm(true); }}
                  className="text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1 cursor-pointer">
                  <Pencil className="w-3.5 h-3.5" /><span>ویرایش پیش‌نویس</span>
                </button>
              )}

              {detail.receipt.statusLogs.length > 0 && (
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-1 font-black text-slate-800 mb-2">
                    <History className="w-3.5 h-3.5" /><span>تاریخچه تغییر وضعیت</span>
                  </div>
                  <div className="space-y-1">
                    {detail.receipt.statusLogs.map((log) => (
                      <div key={log.id} className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-600">
                        <span className="font-mono text-slate-400">{formatJalaliDateTime(log.createdAt)}</span>
                        <span className="font-bold text-slate-900">{STATUS_LABELS[log.toStatus]}</span>
                        <span>توسط {log.user.fullName}</span>
                        {log.ipAddress && <span className="text-slate-400 font-mono">({log.ipAddress})</span>}
                        {log.reason && <span className="text-amber-800">— {log.reason}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
