import React, { useCallback, useEffect, useState } from 'react';
import { Warehouse, PackagePlus, SlidersHorizontal, AlertCircle, Loader2, Check, FileSpreadsheet } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { parseRial } from '../../shared/money';
import { formatJalaliDateTime } from '../lib/jalali';
import { useAuth } from '../auth/AuthContext';

interface StockRow {
  productId: number;
  code: string;
  name: string;
  bagWeightKg: number;
  onHandKg: number;
  reservedKg: number;
  availableKg: number;
}

interface Movement {
  id: number;
  type: string;
  quantityKg: number;
  note: string | null;
  createdAt: string;
  user: string;
  receiptNumber: string | null;
  balanceAfter: number | null;
}

const MOVEMENT_LABELS: Record<string, { label: string; cls: string }> = {
  PRODUCTION: { label: 'تولید', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  RESERVE: { label: 'رزرو', cls: 'bg-amber-100 text-amber-900 border-amber-300' },
  RELEASE_RESERVE: { label: 'آزادسازی رزرو', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
  ISSUE: { label: 'بارگیری و خروج', cls: 'bg-violet-100 text-violet-900 border-violet-300' },
  RETURN: { label: 'مرجوعی', cls: 'bg-orange-100 text-orange-900 border-orange-300' },
  ADJUSTMENT: { label: 'اصلاح دستی', cls: 'bg-blue-100 text-blue-900 border-blue-300' },
};

const tons = (kg: number) =>
  (kg / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 2 });

export const InventoryPage: React.FC = () => {
  const { can } = useAuth();
  const canProduce = can('inventory:produce');
  const canAdjust = can('inventory:adjust');

  const [stock, setStock] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [showProduction, setShowProduction] = useState(false);
  const [prodProduct, setProdProduct] = useState<number | null>(null);
  const [prodQty, setProdQty] = useState('');
  const [prodNote, setProdNote] = useState('');

  const [kardexFor, setKardexFor] = useState<StockRow | null>(null);
  const [movements, setMovements] = useState<Movement[] | null>(null);

  const load = useCallback(async () => {
    try {
      const { stock } = await api.get<{ stock: StockRow[] }>('/inventory');
      setStock(stock);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'دریافت موجودی ناموفق بود.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openKardex = async (row: StockRow) => {
    setKardexFor(row);
    setMovements(null);
    try {
      const data = await api.get<{ movements: Movement[] }>(`/inventory/kardex/${row.productId}`);
      setMovements(data.movements);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'دریافت کاردکس ناموفق بود.');
    }
  };

  const submitProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const qty = parseRial(prodQty);
    if (!prodProduct) return setError('محصول را انتخاب کنید.');
    if (qty === null || qty <= 0) return setError('مقدار تولید معتبر نیست.');

    setBusy(true);
    setError(null);
    try {
      await api.post('/inventory/production', {
        productId: prodProduct,
        quantityKg: qty,
        note: prodNote.trim() || undefined,
      });
      setNotice(`${tons(qty)} تُن تولید ثبت شد.`);
      setProdProduct(null); setProdQty(''); setProdNote('');
      setShowProduction(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ثبت تولید ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };

  const doAdjust = async (row: StockRow) => {
    const input = prompt(
      `موجودی جدید «${row.name}» به کیلوگرم\n` +
        `(موجودی فعلی: ${row.onHandKg.toLocaleString('fa-IR')} کیلو، ` +
        `رزروشده: ${row.reservedKg.toLocaleString('fa-IR')} کیلو)`,
      String(row.onHandKg),
    );
    if (input === null) return;

    const newOnHand = parseRial(input);
    if (newOnHand === null) return setError('مقدار وارد شده معتبر نیست.');

    const reason = prompt('دلیل اصلاح موجودی (اجباری):');
    if (!reason?.trim()) return;

    setError(null);
    try {
      await api.post('/inventory/adjust', {
        productId: row.productId,
        newOnHandKg: newOnHand,
        reason: reason.trim(),
      });
      setNotice('موجودی اصلاح شد.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'اصلاح موجودی ناموفق بود.');
    }
  };

  const inputCls =
    'w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:bg-white focus:outline-amber-500';

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <Loader2 className="w-6 h-6 text-slate-300 mx-auto animate-spin" />
      </div>
    );
  }

  const totalOnHand = stock.reduce((s, r) => s + r.onHandKg, 0);
  const totalReserved = stock.reduce((s, r) => s + r.reservedKg, 0);

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center">
              <Warehouse className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-bold">موجودی کل انبار</div>
              <div className="text-xs font-black text-slate-900">{tons(totalOnHand)} تُن</div>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200 hidden sm:block" />
          <div>
            <div className="text-[11px] text-slate-500 font-bold">رزروشده برای حواله‌ها</div>
            <div className="text-xs font-black text-amber-800">{tons(totalReserved)} تُن</div>
          </div>
          <div className="h-8 w-px bg-slate-200 hidden sm:block" />
          <div>
            <div className="text-[11px] text-slate-500 font-bold">قابل تخصیص</div>
            <div className="text-xs font-black text-emerald-800">{tons(totalOnHand - totalReserved)} تُن</div>
          </div>
        </div>

        {canProduce && (
          <button onClick={() => setShowProduction((v) => !v)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer">
            <PackagePlus className="w-4 h-4" />
            <span>{showProduction ? 'انصراف' : 'ثبت تولید'}</span>
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

      {showProduction && canProduce && (
        <form onSubmit={submitProduction} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">محصول</label>
            <select required value={prodProduct ?? ''} onChange={(e) => setProdProduct(Number(e.target.value) || null)}
              className={`${inputCls} cursor-pointer`}>
              <option value="">— انتخاب کنید —</option>
              {stock.map((r) => (
                <option key={r.productId} value={r.productId}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">مقدار تولید (کیلوگرم)</label>
            <input type="text" required value={prodQty} onChange={(e) => setProdQty(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">توضیحات (شیفت، سیلو…)</label>
            <input type="text" value={prodNote} onChange={(e) => setProdNote(e.target.value)} className={inputCls} />
          </div>
          <button type="submit" disabled={busy}
            className="bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-black px-4 py-2 rounded-xl text-xs transition cursor-pointer">
            {busy ? 'در حال ثبت…' : 'ثبت تولید'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">کد</th>
                <th className="py-3 px-3">محصول</th>
                <th className="py-3 px-3">موجودی انبار</th>
                <th className="py-3 px-3">رزروشده</th>
                <th className="py-3 px-3">قابل تخصیص</th>
                <th className="py-3 px-3">معادل کیسه</th>
                <th className="py-3 px-4 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {stock.map((r) => {
                const low = r.availableKg <= 0;
                return (
                  <tr key={r.productId} className={`hover:bg-amber-50/40 transition ${low ? 'bg-red-50/40' : ''}`}>
                    <td className="py-3 px-4 font-mono font-black text-slate-900">{r.code}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{r.name}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{tons(r.onHandKg)} تُن</td>
                    <td className="py-3 px-3 text-amber-800 font-bold">
                      {r.reservedKg > 0 ? `${tons(r.reservedKg)} تُن` : '—'}
                    </td>
                    <td className={`py-3 px-3 font-black ${low ? 'text-red-700' : 'text-emerald-800'}`}>
                      {tons(r.availableKg)} تُن
                      {low && <span className="block text-[10px] font-bold">موجودی تمام شده</span>}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {Math.floor(r.availableKg / r.bagWeightKg).toLocaleString('fa-IR')} کیسه
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => void openKardex(r)} title="کاردکس انبار"
                          className="text-slate-500 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer">
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                        </button>
                        {canAdjust && (
                          <button onClick={() => void doAdjust(r)} title="اصلاح دستی موجودی"
                            className="text-slate-500 hover:text-blue-700 p-1.5 rounded-lg hover:bg-blue-50 transition cursor-pointer">
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {kardexFor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl my-4">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between rounded-t-2xl">
              <h3 className="font-black text-base">کاردکس انبار — {kardexFor.name}</h3>
              <button onClick={() => setKardexFor(null)} className="text-slate-400 hover:text-white text-xl leading-none px-2 cursor-pointer">×</button>
            </div>

            <div className="p-5 text-xs">
              {!movements ? (
                <div className="py-8 text-center"><Loader2 className="w-6 h-6 text-slate-300 mx-auto animate-spin" /></div>
              ) : movements.length === 0 ? (
                <p className="py-6 text-center text-slate-500 font-bold">گردشی ثبت نشده است.</p>
              ) : (
                <table className="w-full border-collapse border border-slate-300 text-center">
                  <thead className="bg-slate-50 font-bold">
                    <tr>
                      <th className="border border-slate-300 p-1.5">تاریخ</th>
                      <th className="border border-slate-300 p-1.5">نوع</th>
                      <th className="border border-slate-300 p-1.5">مقدار</th>
                      <th className="border border-slate-300 p-1.5">مانده انبار</th>
                      <th className="border border-slate-300 p-1.5">حواله</th>
                      <th className="border border-slate-300 p-1.5">کاربر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => {
                      const meta = MOVEMENT_LABELS[m.type] ?? { label: m.type, cls: 'bg-slate-100' };
                      return (
                        <tr key={m.id}>
                          <td className="border border-slate-300 p-1.5 whitespace-nowrap">{formatJalaliDateTime(m.createdAt)}</td>
                          <td className="border border-slate-300 p-1.5">
                            <span className={`px-2 py-0.5 rounded-lg font-bold border ${meta.cls}`}>{meta.label}</span>
                          </td>
                          <td className={`border border-slate-300 p-1.5 font-bold ${m.quantityKg < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                            {m.quantityKg > 0 ? '+' : '−'}{tons(Math.abs(m.quantityKg))} تُن
                          </td>
                          <td className="border border-slate-300 p-1.5 font-bold">
                            {m.balanceAfter === null ? '—' : `${tons(m.balanceAfter)} تُن`}
                          </td>
                          <td className="border border-slate-300 p-1.5 font-mono">{m.receiptNumber ?? '—'}</td>
                          <td className="border border-slate-300 p-1.5">{m.user}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
