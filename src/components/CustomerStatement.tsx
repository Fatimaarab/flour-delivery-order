import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, Printer } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { formatRial } from '../../shared/money';
import { formatJalaliDate } from '../lib/jalali';

interface LedgerEntry {
  date: string;
  kind: 'RECEIPT' | 'PAYMENT';
  title: string;
  reference: string | null;
  debit: number;
  credit: number;
  balance: number;
}

interface Statement {
  customer: { id: number; code: string; name: string; creditLimit: number; balance: number };
  ledger: LedgerEntry[];
  totals: { debit: number; credit: number };
}

/** مانده را به زبان ساده توضیح می‌دهد — «منفی» برای کاربر معنای روشنی ندارد. */
function describeBalance(balance: number): { text: string; cls: string } {
  if (balance === 0) return { text: 'حساب تسویه است', cls: 'text-slate-700' };
  if (balance < 0)
    return { text: `${formatRial(-balance)} ریال بدهکار`, cls: 'text-red-800' };
  return { text: `${formatRial(balance)} ریال بستانکار`, cls: 'text-emerald-800' };
}

export const CustomerStatement: React.FC<{ customerId: number; onClose: () => void }> = ({
  customerId,
  onClose,
}) => {
  const [data, setData] = useState<Statement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Statement>(`/payments/statement/${customerId}`)
      .then(setData)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'دریافت صورتحساب ناموفق بود.'),
      );
  }, [customerId]);

  const balance = data ? describeBalance(data.customer.balance) : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-3 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl my-4 print-area-container">
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between rounded-t-2xl no-print">
          <h3 className="font-black text-base">صورتحساب مشتری</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} title="چاپ"
              className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer">
              <Printer className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none px-2 cursor-pointer">×</button>
          </div>
        </div>

        {error ? (
          <div className="p-6 flex items-center gap-2 text-xs text-red-800 font-bold">
            <AlertCircle className="w-4 h-4" /><span>{error}</span>
          </div>
        ) : !data ? (
          <div className="p-10 text-center"><Loader2 className="w-6 h-6 text-slate-300 mx-auto animate-spin" /></div>
        ) : (
          <div className="p-5 space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="text-slate-500 font-bold">مشتری</div>
                <div className="font-black text-slate-900">{data.customer.name}</div>
              </div>
              <div>
                <div className="text-slate-500 font-bold">کد</div>
                <div className="font-mono font-bold">{data.customer.code}</div>
              </div>
              <div>
                <div className="text-slate-500 font-bold">سقف اعتبار</div>
                <div className="font-bold">{formatRial(data.customer.creditLimit)} ریال</div>
              </div>
              <div>
                <div className="text-slate-500 font-bold">مانده حساب</div>
                <div className={`font-black ${balance!.cls}`}>{balance!.text}</div>
              </div>
            </div>

            <table className="w-full border-collapse border border-slate-300 text-center">
              <thead className="bg-slate-50 font-bold">
                <tr>
                  <th className="border border-slate-300 p-1.5">تاریخ</th>
                  <th className="border border-slate-300 p-1.5">شرح</th>
                  <th className="border border-slate-300 p-1.5">بدهکار</th>
                  <th className="border border-slate-300 p-1.5">بستانکار</th>
                  <th className="border border-slate-300 p-1.5">مانده</th>
                </tr>
              </thead>
              <tbody>
                {data.ledger.length === 0 ? (
                  <tr><td colSpan={5} className="border border-slate-300 p-4 text-slate-500 font-bold">گردشی ثبت نشده است.</td></tr>
                ) : (
                  data.ledger.map((e, i) => (
                    <tr key={i} className={e.kind === 'PAYMENT' ? 'bg-emerald-50/40' : ''}>
                      <td className="border border-slate-300 p-1.5 whitespace-nowrap">{formatJalaliDate(e.date)}</td>
                      <td className="border border-slate-300 p-1.5 text-right font-bold">{e.title}</td>
                      <td className="border border-slate-300 p-1.5">{e.debit ? formatRial(e.debit) : '—'}</td>
                      <td className="border border-slate-300 p-1.5">{e.credit ? formatRial(e.credit) : '—'}</td>
                      <td className={`border border-slate-300 p-1.5 font-bold ${e.balance < 0 ? 'text-red-800' : 'text-emerald-800'}`}>
                        {formatRial(Math.abs(e.balance))} {e.balance < 0 ? 'بد' : 'بس'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-50 font-black">
                <tr>
                  <td className="border border-slate-300 p-1.5" colSpan={2}>جمع</td>
                  <td className="border border-slate-300 p-1.5">{formatRial(data.totals.debit)}</td>
                  <td className="border border-slate-300 p-1.5">{formatRial(data.totals.credit)}</td>
                  <td className="border border-slate-300 p-1.5">{balance!.text}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
