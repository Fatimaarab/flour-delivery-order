import React, { useEffect, useState } from 'react';
import { Truck, Plus, AlertCircle, Loader2, Check, Pencil, Search } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { digitsOnly } from '../../shared/digits';
import { isValidMobile, isValidNationalId } from '../../shared/nationalId';
import { useAuth } from '../auth/AuthContext';
import { IranPlateInput } from '../components/IranPlateInput';
import { IranPlateBadge } from '../components/IranPlate';
import type { DriverRow } from '../components/DriverPicker';

const emptyForm = { fullName: '', nationalId: '', mobile: '', plateNumber: '' };

/**
 * رانندگان — تنها جایی که راننده تعریف یا ویرایش می‌شود.
 *
 * در حواله راننده فقط با جستجو انتخاب می‌شود. کد ملی اجباری و یکتاست.
 */
export const DriversPage: React.FC = () => {
  const { can } = useAuth();
  const canWrite = can('driver:write');

  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<DriverRow | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const load = async (term = '') => {
    try {
      const { drivers } = await api.get<{ drivers: DriverRow[] }>(
        `/drivers?all=1${term ? `&search=${encodeURIComponent(term)}` : ''}`,
      );
      setDrivers(drivers);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'دریافت رانندگان ناموفق بود.');
    } finally {
      setLoading(false);
    }
  };

  // جستجو با تأخیر، تا هر کلید یک درخواست به سرور نفرستد
  useEffect(() => {
    const t = setTimeout(() => void load(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const startEdit = (d: DriverRow) => {
    setEditing(d);
    setForm({
      fullName: d.fullName,
      nationalId: d.nationalId,
      mobile: d.mobile ?? '',
      plateNumber: d.plateNumber ?? '',
    });
    setFieldErrors({});
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
    setFieldErrors({});
  };

  /** همان بررسی‌های سرور، تا خطا کنار خود کادر دیده شود. */
  const validate = () => {
    const e: Record<string, string> = {};
    if (form.fullName.trim().length < 2) e.fullName = 'نام راننده را وارد کنید.';
    const nid = digitsOnly(form.nationalId);
    if (!nid) e.nationalId = 'کد ملی راننده اجباری است.';
    else if (!isValidNationalId(nid)) e.nationalId = 'کد ملی معتبر نیست (۱۰ رقم با رقم کنترلی درست).';
    const mobile = digitsOnly(form.mobile);
    if (mobile && !isValidMobile(mobile)) e.mobile = 'موبایل باید ۱۱ رقم و با ۰۹ شروع شود.';
    return e;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (busy) return;

    const problems = validate();
    setFieldErrors(problems);
    if (Object.keys(problems).length > 0) {
      setError('اطلاعات راننده کامل یا درست نیست؛ کادرهای قرمز را اصلاح کنید.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        nationalId: digitsOnly(form.nationalId),
        mobile: digitsOnly(form.mobile) || undefined,
        plateNumber: form.plateNumber || undefined,
      };
      if (editing) {
        await api.patch(`/drivers/${editing.id}`, payload);
        setNotice(`راننده «${payload.fullName}» به‌روزرسانی شد.`);
      } else {
        await api.post('/drivers', payload);
        setNotice(`راننده «${payload.fullName}» ثبت شد؛ حالا در حواله قابل انتخاب است.`);
      }
      closeForm();
      await load(search);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ثبت راننده ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (d: DriverRow) => {
    try {
      await api.patch(`/drivers/${d.id}`, {
        fullName: d.fullName,
        nationalId: d.nationalId,
        mobile: d.mobile ?? undefined,
        plateNumber: d.plateNumber ?? undefined,
        isActive: !d.isActive,
      });
      setNotice(d.isActive ? `«${d.fullName}» غیرفعال شد و در حواله دیده نمی‌شود.` : `«${d.fullName}» دوباره فعال شد.`);
      await load(search);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تغییر وضعیت ناموفق بود.');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <Loader2 className="w-6 h-6 text-slate-300 mx-auto animate-spin" />
      </div>
    );
  }

  const inputCls = (bad?: string) =>
    `w-full px-3 py-2 border rounded-xl text-xs font-bold focus:bg-white focus:outline-amber-500 ${
      bad ? 'border-red-400 bg-red-50' : 'bg-slate-50 border-slate-300'
    }`;

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-bold">رانندگان</div>
            <div className="text-xs font-black text-slate-900">
              {drivers.length.toLocaleString('fa-IR')} راننده
            </div>
          </div>
        </div>

        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو با نام، کد ملی، موبایل یا پلاک…"
            className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden" />
        </div>

        {canWrite && (
          <button onClick={() => (showForm ? closeForm() : setShowForm(true))}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer">
            <Plus className="w-4 h-4" />
            <span>{showForm ? 'انصراف' : 'راننده جدید'}</span>
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
        <form onSubmit={handleSubmit} noValidate className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 text-xs font-black text-slate-800">
            {editing ? `ویرایش ${editing.fullName}` : 'تعریف راننده جدید'}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">نام و نام خانوادگی <span className="text-red-500">*</span></label>
            <input type="text" value={form.fullName} className={inputCls(fieldErrors.fullName)}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            {fieldErrors.fullName && <p className="text-[11px] text-red-700 font-bold mt-1">{fieldErrors.fullName}</p>}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">کد ملی <span className="text-red-500">*</span></label>
            <input type="text" dir="ltr" inputMode="numeric" value={form.nationalId} className={`${inputCls(fieldErrors.nationalId)} text-left font-mono`}
              onChange={(e) => setForm({ ...form, nationalId: e.target.value })} />
            {fieldErrors.nationalId && <p className="text-[11px] text-red-700 font-bold mt-1">{fieldErrors.nationalId}</p>}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">موبایل (اختیاری — پیامک حواله به این شماره می‌رود)</label>
            <input type="text" dir="ltr" inputMode="numeric" value={form.mobile} className={`${inputCls(fieldErrors.mobile)} text-left font-mono`}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            {fieldErrors.mobile && <p className="text-[11px] text-red-700 font-bold mt-1">{fieldErrors.mobile}</p>}
          </div>
          <div>
            <IranPlateInput label="پلاک خودرو (اختیاری)" value={form.plateNumber}
              onChange={(plate) => setForm((f) => ({ ...f, plateNumber: plate }))} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={busy}
              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black px-6 py-2 rounded-xl text-xs transition cursor-pointer">
              {busy ? 'در حال ثبت…' : editing ? 'ذخیره تغییرات' : 'ثبت راننده'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">نام</th>
                <th className="py-3 px-3">کد ملی</th>
                <th className="py-3 px-3">موبایل</th>
                <th className="py-3 px-3">پلاک</th>
                {canWrite && <th className="py-3 px-4 text-center">عملیات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {drivers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-bold">
                    راننده‌ای یافت نشد.
                  </td>
                </tr>
              ) : (
                drivers.map((d) => (
                  <tr key={d.id} className={`hover:bg-amber-50/40 transition ${d.isActive ? '' : 'opacity-50'}`}>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {d.fullName}
                      {!d.isActive && <span className="mr-2 text-[10px] text-slate-500">(غیرفعال)</span>}
                    </td>
                    <td className="py-3 px-3 font-mono">{d.nationalId}</td>
                    <td className="py-3 px-3 font-mono">{d.mobile ?? '—'}</td>
                    <td className="py-3 px-3">{d.plateNumber ? <IranPlateBadge plateString={d.plateNumber} size="sm" /> : '—'}</td>
                    {canWrite && (
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button onClick={() => startEdit(d)} title="ویرایش"
                          className="text-slate-500 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => void toggleActive(d)}
                          className="text-[11px] font-bold text-slate-600 hover:text-slate-900 px-2 py-1 rounded-lg hover:bg-slate-100 cursor-pointer">
                          {d.isActive ? 'غیرفعال' : 'فعال'}
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
