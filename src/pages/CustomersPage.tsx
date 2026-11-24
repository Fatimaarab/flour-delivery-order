import React, { useEffect, useState } from 'react';
import { Users, Plus, AlertCircle, Loader2, Check, Pencil, Search } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { parseRial } from '../../shared/money';
import { digitsOnly } from '../../shared/digits';
import { useAuth } from '../auth/AuthContext';

interface Customer {
  id: number;
  code: string;
  kind: 'INDIVIDUAL' | 'COMPANY';
  type: 'BAKERY' | 'GUILD_INDUSTRY' | 'WHOLESALER';
  name: string;
  nationalId: string | null;
  economicCode: string | null;
  phone: string | null;
  address: string | null;
  creditLimit: number;
  balance: number;
  monthlyQuotaKg: number;
  isActive: boolean;
}

const TYPE_LABELS = {
  BAKERY: 'نانوایی',
  GUILD_INDUSTRY: 'صنف و صنعت',
  WHOLESALER: 'عمده‌فروش',
} as const;

const emptyForm = {
  code: '',
  kind: 'INDIVIDUAL' as 'INDIVIDUAL' | 'COMPANY',
  type: 'BAKERY' as Customer['type'],
  name: '',
  economicCode: '',
  phone: '',
  address: '',
  creditLimit: '0',
  monthlyQuotaKg: '0',
};

export const CustomersPage: React.FC = () => {
  const { can } = useAuth();
  const canWrite = can('customer:write');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = async (term = '') => {
    try {
      const { customers } = await api.get<{ customers: Customer[] }>(
        `/customers${term ? `?search=${encodeURIComponent(term)}` : ''}`,
      );
      setCustomers(customers);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'دریافت مشتریان ناموفق بود.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // جستجو با تأخیر، تا هر کلید یک درخواست به سرور نفرستد
  useEffect(() => {
    const t = setTimeout(() => void load(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const startEdit = (c: Customer) => {
    setEditingId(c.id);
    setForm({
      code: c.code,
      kind: c.kind,
      type: c.type,
      name: c.name,
      economicCode: c.economicCode ?? '',
      phone: c.phone ?? '',
      address: c.address ?? '',
      creditLimit: String(c.creditLimit),
      monthlyQuotaKg: String(c.monthlyQuotaKg),
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const creditLimit = parseRial(form.creditLimit);
    const quota = parseRial(form.monthlyQuotaKg);
    if (creditLimit === null) return setError('سقف اعتبار معتبر نیست.');
    if (quota === null) return setError('سهمیه ماهانه معتبر نیست.');

    setBusy(true);
    setError(null);
    try {
      const payload = {
        code: form.code.trim(),
        kind: form.kind,
        type: form.type,
        name: form.name.trim(),
        economicCode: digitsOnly(form.economicCode) || undefined,
        phone: digitsOnly(form.phone) || undefined,
        address: form.address.trim() || undefined,
        creditLimit,
        monthlyQuotaKg: quota,
      };

      if (editingId) {
        await api.patch(`/customers/${editingId}`, payload);
        setNotice(`مشتری «${payload.name}» به‌روزرسانی شد.`);
      } else {
        await api.post('/customers', payload);
        setNotice(`مشتری «${payload.name}» ثبت شد.`);
      }

      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      await load(search);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ثبت مشتری ناموفق بود.');
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

  const inputCls =
    'w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:bg-white focus:outline-amber-500';

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-bold">مشتریان</div>
            <div className="text-xs font-black text-slate-900">
              {customers.length.toLocaleString('fa-IR')} مشتری
            </div>
          </div>
        </div>

        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی نام یا کد مشتری…"
            className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden" />
        </div>

        {canWrite && (
          <button onClick={() => { setShowForm((v) => !v); setEditingId(null); setForm(emptyForm); }}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer">
            <Plus className="w-4 h-4" />
            <span>{showForm ? 'انصراف' : 'مشتری جدید'}</span>
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
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">کد مشتری</label>
            <input type="text" required dir="ltr" value={form.code} disabled={editingId !== null}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className={`${inputCls} text-left disabled:bg-slate-100 disabled:text-slate-400`} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">نوع شخص</label>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as 'INDIVIDUAL' | 'COMPANY' })}
              className={`${inputCls} cursor-pointer`}>
              <option value="INDIVIDUAL">حقیقی</option>
              <option value="COMPANY">حقوقی</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">دسته مشتری</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Customer['type'] })}
              className={`${inputCls} cursor-pointer`}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">نام</label>
            <input type="text" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
          </div>

          {/*
            کد ملی، کد اقتصادی، تلفن، آدرس، سقف اعتبار و سهمیه ماهانه از این
            فرم برداشته شدند؛ در کار روزمره صدور حواله هیچ‌کدام استفاده
            نمی‌شدند و دو تای آخر فقط به کار بخش مالی و انبار می‌آمدند که
            دیگر در سامانه نیستند.

            ستون‌هایشان در پایگاه داده و اعتبارسنجی‌شان در سرور دست‌نخورده
            مانده: داده مشتری‌های قبلی از بین نمی‌رود و اگر روزی کد ملی لازم
            شد، برگرداندن همین کادر کافی است.
          */}
          <div className="flex items-end">
            <button type="submit" disabled={busy}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black px-4 py-2 rounded-xl text-xs transition cursor-pointer">
              {busy ? 'در حال ثبت…' : editingId ? 'ذخیره تغییرات' : 'ثبت مشتری'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">کد</th>
                <th className="py-3 px-3">نام</th>
                <th className="py-3 px-3">دسته</th>
                {canWrite && <th className="py-3 px-4 text-center">عملیات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500 font-bold">
                    مشتری‌ای یافت نشد.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-amber-50/40 transition">
                    <td className="py-3 px-4 font-mono font-black text-slate-900">{c.code}</td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{c.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {c.kind === 'INDIVIDUAL' ? 'حقیقی' : 'حقوقی'}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-700">{TYPE_LABELS[c.type]}</td>
                    {canWrite && (
                      <td className="py-3 px-4 text-center">
                        <button onClick={() => startEdit(c)} title="ویرایش"
                          className="text-slate-500 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
