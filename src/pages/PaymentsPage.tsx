import React, { useCallback, useEffect, useState } from 'react';
import { Plus, AlertCircle, Loader2, Check, Ban, Wallet, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { formatRial, parseRial } from '../../shared/money';
import { formatJalaliDateTime } from '../lib/jalali';
import {
  METHODS_REQUIRING_REFERENCE,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from '../../shared/finance';
import { useAuth } from '../auth/AuthContext';
import { CustomerStatement } from '../components/CustomerStatement';

interface Payment {
  id: number;
  amount: number;
  method: PaymentMethod;
  referenceNumber: string | null;
  note: string | null;
  createdAt: string;
  customer: { id: number; code: string; name: string };
  receipt: { id: number; receiptNumber: string } | null;
  user: { fullName: string };
}

interface CustomerOption {
  id: number;
  code: string;
  name: string;
  balance: number;
  creditLimit: number;
}

interface ReceiptOption {
  id: number;
  receiptNumber: string;
  grandTotal: number;
  paidAmount: number;
  customer: { id: number };
}

export const PaymentsPage: React.FC = () => {
  const { can } = useAuth();
  const canCreate = can('payment:create');
  const canVoid = can('payment:void');

  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [receipts, setReceipts] = useState<ReceiptOption[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statementFor, setStatementFor] = useState<number | null>(null);

  const [customerId, setCustomerId] = useState<number | null>(null);
  const [receiptId, setReceiptId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ payments: Payment[]; total: number; pageSize: number }>(
        `/payments?page=${page}`,
      );
      setPayments(data.payments);
      setTotal(data.total);
      setPageSize(data.pageSize);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'دریافت پرداخت‌ها ناموفق بود.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canCreate) return;
    void api
      .get<{ customers: CustomerOption[] }>('/customers')
      .then((d) => setCustomers(d.customers))
      .catch(() => undefined);
  }, [canCreate]);

  // فقط حواله‌های همان مشتری که هنوز مانده دارند
  useEffect(() => {
    if (!customerId) return setReceipts([]);
    void api
      .get<{ receipts: ReceiptOption[] }>('/receipts?pageSize=100')
      .then((d) =>
        setReceipts(
          d.receipts.filter(
            (r) => r.customer.id === customerId && r.grandTotal - r.paidAmount > 0,
          ),
        ),
      )
      .catch(() => undefined);
  }, [customerId]);

  const selectedReceipt = receipts.find((r) => r.id === receiptId);
  const outstanding = selectedReceipt
    ? selectedReceipt.grandTotal - selectedReceipt.paidAmount
    : null;

  const resetForm = () => {
    setCustomerId(null); setReceiptId(null); setAmount('');
    setMethod('CASH'); setReference(''); setChequeDate(''); setNote('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const value = parseRial(amount);
    if (!customerId) return setError('مشتری را انتخاب کنید.');
    if (value === null || value <= 0) return setError('مبلغ پرداخت معتبر نیست.');

    setBusy(true);
    setError(null);
    try {
      await api.post('/payments', {
        customerId,
        receiptId: receiptId ?? undefined,
        amount: value,
        method,
        referenceNumber: reference.trim() || undefined,
        chequeDueDate: chequeDate ? new Date(chequeDate).toISOString() : undefined,
        note: note.trim() || undefined,
      });
      setNotice(`پرداخت ${formatRial(value)} ریال ثبت شد.`);
      resetForm();
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ثبت پرداخت ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };

  const handleVoid = async (payment: Payment) => {
    const reason = prompt(`دلیل ابطال پرداخت ${formatRial(payment.amount)} ریال:`);
    if (!reason?.trim()) return;

    setError(null);
    try {
      await api.post(`/payments/${payment.id}/void`, { reason: reason.trim() });
      setNotice('پرداخت باطل شد. رکورد آن برای همیشه در سوابق می‌ماند.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ابطال پرداخت ناموفق بود.');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const inputCls =
    'w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:bg-white focus:outline-amber-500';

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <Loader2 className="w-6 h-6 text-slate-300 mx-auto animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-bold">پرداخت‌ها</div>
            <div className="text-xs font-black text-slate-900">
              {total.toLocaleString('fa-IR')} پرداخت ثبت‌شده
            </div>
          </div>
        </div>

        {canCreate && (
          <button onClick={() => { setShowForm((v) => !v); resetForm(); }}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer">
            <Plus className="w-4 h-4" />
            <span>{showForm ? 'انصراف' : 'ثبت پرداخت'}</span>
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-300 rounded-2xl p-3 flex items-center gap-2 text-xs text-red-800 font-bold">
          <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3 flex items-center gap-2 text-xs text-emerald-900 font-bold">
          <Check className="w-4 h-4 shrink-0" /><span>{notice}</span>
        </div>
      )}

      {showForm && canCreate && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">مشتری</label>
            <select required value={customerId ?? ''} onChange={(e) => { setCustomerId(Number(e.target.value) || null); setReceiptId(null); }}
              className={`${inputCls} cursor-pointer`}>
              <option value="">— انتخاب کنید —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">حواله (اختیاری)</label>
            <select value={receiptId ?? ''} onChange={(e) => setReceiptId(Number(e.target.value) || null)}
              className={`${inputCls} cursor-pointer`} disabled={!customerId}>
              <option value="">— پرداخت علی‌الحساب —</option>
              {receipts.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.receiptNumber} — مانده {formatRial(r.grandTotal - r.paidAmount)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              مبلغ (ریال)
              {outstanding !== null && (
                <button type="button" onClick={() => setAmount(String(outstanding))}
                  className="mr-2 text-amber-700 hover:text-amber-900 font-bold cursor-pointer">
                  تسویه کامل
                </button>
              )}
            </label>
            <input type="text" required value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">روش پرداخت</label>
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className={`${inputCls} cursor-pointer`}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
              ))}
            </select>
          </div>

          {METHODS_REQUIRING_REFERENCE.includes(method) && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {method === 'CHEQUE' ? 'شماره چک' : 'شماره فیش'}
              </label>
              <input type="text" required dir="ltr" value={reference} onChange={(e) => setReference(e.target.value)}
                className={`${inputCls} text-left`} />
            </div>
          )}

          {method === 'CHEQUE' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">سررسید چک</label>
              <input type="date" required value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} className={inputCls} />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">توضیحات</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
          </div>

          <div className="flex items-end">
            <button type="submit" disabled={busy}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-black px-4 py-2 rounded-xl text-xs transition cursor-pointer">
              {busy ? 'در حال ثبت…' : 'ثبت پرداخت'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">تاریخ</th>
                <th className="py-3 px-3">مشتری</th>
                <th className="py-3 px-3">حواله</th>
                <th className="py-3 px-3">مبلغ</th>
                <th className="py-3 px-3">روش</th>
                <th className="py-3 px-3">شماره پیگیری</th>
                <th className="py-3 px-3">ثبت‌کننده</th>
                <th className="py-3 px-4 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {payments.length === 0 ? (
                <tr><td colSpan={8} className="py-8 text-center text-slate-500 font-bold">پرداختی ثبت نشده است.</td></tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-amber-50/40 transition">
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{formatJalaliDateTime(p.createdAt)}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{p.customer.name}</td>
                    <td className="py-3 px-3 font-mono text-slate-700">{p.receipt?.receiptNumber ?? '— علی‌الحساب —'}</td>
                    <td className="py-3 px-3 font-black text-emerald-800 whitespace-nowrap">{formatRial(p.amount)}</td>
                    <td className="py-3 px-3">
                      <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-lg font-bold">
                        {PAYMENT_METHOD_LABELS[p.method]}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">{p.referenceNumber ?? '—'}</td>
                    <td className="py-3 px-3 text-slate-600">{p.user.fullName}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setStatementFor(p.customer.id)} title="صورتحساب مشتری"
                          className="text-slate-500 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer">
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                        </button>
                        {canVoid && (
                          <button onClick={() => void handleVoid(p)} title="ابطال پرداخت"
                            className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer">
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
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
              صفحه {page.toLocaleString('fa-IR')} از {totalPages.toLocaleString('fa-IR')}
            </span>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 cursor-pointer disabled:cursor-not-allowed">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 cursor-pointer disabled:cursor-not-allowed">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {statementFor !== null && (
        <CustomerStatement customerId={statementFor} onClose={() => setStatementFor(null)} />
      )}
    </div>
  );
};
