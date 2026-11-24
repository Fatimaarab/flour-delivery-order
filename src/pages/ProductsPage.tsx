import React, { useEffect, useState } from 'react';
import { Package, Plus, AlertCircle, Loader2, Check, Pencil } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { formatRial } from '../../shared/money';
import { parseRial } from '../../shared/money';
import { useAuth } from '../auth/AuthContext';

interface Product {
  id: number;
  code: string;
  name: string;
  description: string | null;
  bagWeightKg: number;
  basePricePerKg: number;
  pricingCategory: 'SUBSIDISED' | 'FREE';
  vatPercent: number;
  isActive: boolean;
  stock: { onHandKg: number; reservedKg: number } | null;
}

const CATEGORY_LABELS = {
  SUBSIDISED: { label: 'یارانه‌ای', cls: 'bg-blue-100 text-blue-900 border-blue-300' },
  FREE: { label: 'آزاد', cls: 'bg-amber-100 text-amber-900 border-amber-300' },
} as const;

const emptyForm = {
  code: '',
  name: '',
  bagWeightKg: '40',
  basePricePerKg: '',
  pricingCategory: 'FREE' as 'SUBSIDISED' | 'FREE',
  vatPercent: '10',
};

export const ProductsPage: React.FC = () => {
  const { can } = useAuth();
  const canWrite = can('product:write');

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = async () => {
    try {
      const { products } = await api.get<{ products: Product[] }>('/products');
      setProducts(products);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'دریافت محصولات ناموفق بود.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      code: p.code,
      name: p.name,
      bagWeightKg: String(p.bagWeightKg),
      basePricePerKg: String(p.basePricePerKg),
      pricingCategory: p.pricingCategory,
      vatPercent: String(p.vatPercent),
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const price = parseRial(form.basePricePerKg);
    const bagWeight = parseRial(form.bagWeightKg);
    const vat = parseRial(form.vatPercent);

    if (price === null) return setError('قیمت وارد شده معتبر نیست.');
    if (bagWeight === null || bagWeight <= 0) return setError('وزن کیسه معتبر نیست.');
    if (vat === null || vat > 100) return setError('درصد مالیات معتبر نیست.');

    setBusy(true);
    setError(null);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        bagWeightKg: bagWeight,
        basePricePerKg: price,
        pricingCategory: form.pricingCategory,
        vatPercent: vat,
      };

      if (editingId) {
        await api.patch(`/products/${editingId}`, payload);
        setNotice(`محصول «${payload.name}» به‌روزرسانی شد.`);
      } else {
        await api.post('/products', payload);
        setNotice(`محصول «${payload.name}» ثبت شد.`);
      }

      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ثبت محصول ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };

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
            <Package className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-bold">محصولات کارخانه</div>
            <div className="text-xs font-black text-slate-900">
              {products.length.toLocaleString('fa-IR')} محصول
            </div>
          </div>
        </div>

        {canWrite && (
          <button
            onClick={() => {
              setShowForm((v) => !v);
              setEditingId(null);
              setForm(emptyForm);
            }}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{showForm ? 'انصراف' : 'محصول جدید'}</span>
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-300 rounded-2xl p-3 flex items-center gap-2 text-xs text-red-800 font-bold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3 flex items-center gap-2 text-xs text-emerald-900 font-bold">
          <Check className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {showForm && canWrite && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">کد</label>
            <input type="text" required dir="ltr" value={form.code} disabled={editingId !== null}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-left disabled:bg-slate-100 disabled:text-slate-400 focus:bg-white focus:outline-amber-500" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">نام محصول</label>
            <input type="text" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:bg-white focus:outline-amber-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">وزن کیسه (kg)</label>
            <input type="text" required value={form.bagWeightKg}
              onChange={(e) => setForm({ ...form, bagWeightKg: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:bg-white focus:outline-amber-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">قیمت هر کیلو (ریال)</label>
            <input type="text" required value={form.basePricePerKg}
              onChange={(e) => setForm({ ...form, basePricePerKg: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:bg-white focus:outline-amber-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">دسته قیمتی</label>
            <select value={form.pricingCategory}
              onChange={(e) => {
                const cat = e.target.value as 'SUBSIDISED' | 'FREE';
                // آرد یارانه‌ای طبق فرض ثبت‌شده معاف از مالیات است
                setForm({ ...form, pricingCategory: cat, vatPercent: cat === 'SUBSIDISED' ? '0' : '10' });
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:bg-white focus:outline-amber-500 cursor-pointer">
              <option value="FREE">آزاد</option>
              <option value="SUBSIDISED">یارانه‌ای</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">مالیات (٪)</label>
            <input type="text" required value={form.vatPercent}
              onChange={(e) => setForm({ ...form, vatPercent: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:bg-white focus:outline-amber-500" />
          </div>
          <button type="submit" disabled={busy}
            className="bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-black px-4 py-2 rounded-xl text-xs transition cursor-pointer sm:col-span-2 lg:col-span-1">
            {busy ? 'در حال ثبت…' : editingId ? 'ذخیره تغییرات' : 'ثبت محصول'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">کد</th>
                <th className="py-3 px-3">نام محصول</th>
                <th className="py-3 px-3">دسته</th>
                <th className="py-3 px-3">کیسه</th>
                <th className="py-3 px-3">قیمت هر کیلو</th>
                <th className="py-3 px-3">مالیات</th>
                {canWrite && <th className="py-3 px-4 text-center">عملیات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {products.map((p) => {
                const cat = CATEGORY_LABELS[p.pricingCategory];
                return (
                  <tr key={p.id} className="hover:bg-amber-50/40 transition">
                    <td className="py-3 px-4 font-mono font-black text-slate-900">{p.code}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{p.name}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-lg font-bold border ${cat.cls}`}>{cat.label}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-700">{p.bagWeightKg.toLocaleString('fa-IR')} کیلو</td>
                    <td className="py-3 px-3 font-black text-slate-900">{formatRial(p.basePricePerKg)} <span className="font-normal text-slate-400">ریال</span></td>
                    <td className="py-3 px-3 text-slate-700">{p.vatPercent.toLocaleString('fa-IR')}٪</td>
                    {canWrite && (
                      <td className="py-3 px-4 text-center">
                        <button onClick={() => startEdit(p)} title="ویرایش"
                          className="text-slate-500 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
