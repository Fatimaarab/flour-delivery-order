import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Save, X, Scale, AlertCircle, Loader2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { receiptApi, type Receipt, type ShipmentInfo } from '../lib/receiptApi';
import { DriverPicker, type DriverRow } from './DriverPicker';
import { calculateReceipt, CalcError } from '../../shared/receiptCalc';
import { formatRial, parseRial } from '../../shared/money';

interface Product {
  id: number;
  code: string;
  name: string;
  bagWeightKg: number;
  basePricePerKg: number;
  vatPercent: number;
  pricingCategory: 'SUBSIDISED' | 'FREE';
  isActive: boolean;
}

interface Customer {
  id: number;
  code: string;
  name: string;
  creditLimit: number;
}

interface Row {
  key: string;
  productId: number | null;
  bagCount: string;
}

interface Props {
  editing: (Receipt & { shipment?: ShipmentInfo | null }) | null;
  onClose: () => void;
  onSaved: (receipt: Receipt) => void;
}

const newRow = (): Row => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  productId: null,
  bagCount: '',
});

export const ReceiptDraftForm: React.FC<Props> = ({ editing, onClose, onSaved }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(editing?.customer.id ?? null);
  const [rows, setRows] = useState<Row[]>(
    editing
      ? editing.items.map((i) => ({
          key: String(i.id),
          productId: i.productId,
          bagCount: String(i.bagCount),
        }))
      : [newRow()],
  );
  const [discount, setDiscount] = useState(editing ? String(editing.discount) : '0');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [haulType, setHaulType] = useState<'COMPANY' | 'SELF' | ''>(editing?.shipment?.haulType ?? '');
  const [carrierCompany, setCarrierCompany] = useState(editing?.shipment?.carrierCompany ?? '');
  /** خطای هر کادر، کنار خودش — تا کاربر دقیقاً بداند چه چیزی ناقص است */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  // ویرایش پیش‌نویس: راننده قبلی را از فهرست رانندگان می‌آوریم تا همان انتخاب باشد
  useEffect(() => {
    const id = editing?.shipment?.driverId;
    if (!id) return;
    api
      .get<{ drivers: DriverRow[] }>(`/drivers?all=1&search=${encodeURIComponent(editing?.shipment?.driverNationalId ?? '')}`)
      .then((d) => setDriver(d.drivers.find((x) => x.id === id) ?? null))
      .catch(() => undefined);
  }, [editing]);

  // خطای هر کادر به‌محض درست شدنش محو می‌شود، نه فقط پس از ثبت دوباره
  useEffect(() => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (customerId) delete next.customer;
      if (driver) delete next.driver;
      if (haulType) delete next.haul;
      return next;
    });
  }, [customerId, driver, haulType]);

  /**
   * کلید جلوگیری از ثبت تکراری، یک‌بار هنگام باز شدن فرم ساخته می‌شود و تا
   * بسته شدن فرم ثابت می‌ماند. اگر کاربر دوبار روی «ثبت» بزند، سرور همان
   * حواله اول را برمی‌گرداند نه یک حواله دوم.
   */
  const [idempotencyKey] = useState(
    () => `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  useEffect(() => {
    Promise.all([
      api.get<{ products: Product[] }>('/products'),
      api.get<{ customers: Customer[] }>('/customers'),
    ])
      .then(([p, c]) => {
        setProducts(p.products.filter((x) => x.isActive));
        setCustomers(c.customers);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'دریافت اطلاعات پایه ناموفق بود.'),
      )
      .finally(() => setLoading(false));
  }, []);

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  /**
   * پیش‌نمایش زنده مبالغ، با **همان تابعی** که سرور استفاده می‌کند.
   * عدد نهایی همیشه از سرور می‌آید؛ این فقط برای دیدن لحظه‌ای کاربر است.
   */
  const preview = useMemo(() => {
    const items = rows
      .map((r) => {
        const product = r.productId ? productById.get(r.productId) : null;
        const bagCount = parseRial(r.bagCount);
        if (!product || bagCount === null || bagCount <= 0) return null;
        return {
          bagCount,
          bagWeightKg: product.bagWeightKg,
          unitPricePerKg: product.basePricePerKg,
          vatPercent: product.vatPercent,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (items.length === 0) return null;

    try {
      return calculateReceipt(items, parseRial(discount) ?? 0);
    } catch (err) {
      return err instanceof CalcError ? { error: err.message } : null;
    }
  }, [rows, discount, productById]);

  const calcOk = preview && !('error' in preview);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const items = rows
      .map((r) => ({ productId: r.productId, bagCount: parseRial(r.bagCount) }))
      .filter(
        (r): r is { productId: number; bagCount: number } =>
          r.productId !== null && r.bagCount !== null && r.bagCount > 0,
      );

    /**
     * همه کادرهای الزامی یک‌جا بررسی می‌شوند، نه یکی‌یکی؛ کاربر باید بتواند
     * همه ایرادها را با هم ببیند و اصلاح کند. سرور همین قوانین را دوباره
     * بررسی می‌کند، پس این فقط برای راحتی کاربر است.
     */
    const problems: Record<string, string> = {};
    if (!customerId) problems.customer = 'مشتری را انتخاب کنید.';
    if (rows.some((r) => r.productId !== null || r.bagCount.trim() !== '')) {
      const half = rows.some(
        (r) =>
          (r.productId !== null) !== (parseRial(r.bagCount) !== null && parseRial(r.bagCount)! > 0),
      );
      if (half) problems.items = 'در هر ردیف هم محصول و هم تعداد کیسه (بیشتر از صفر) لازم است.';
    }
    if (items.length === 0 && !problems.items) {
      problems.items = 'دست‌کم یک قلم کالا با تعداد معتبر لازم است.';
    }
    if (!driver) problems.driver = 'راننده را از فهرست رانندگان انتخاب کنید.';
    if (!haulType) problems.haul = 'نوع حمل را مشخص کنید.';

    setFieldErrors(problems);
    if (Object.keys(problems).length > 0) {
      return setError('حواله کامل نیست؛ کادرهای قرمز را تکمیل کنید.');
    }

    setBusy(true);
    setError(null);
    try {
      const payload = {
        customerId: customerId!,
        items,
        discount: parseRial(discount) ?? 0,
        notes: notes.trim() || undefined,
        driverId: driver!.id,
        haulType: haulType as 'COMPANY' | 'SELF',
        carrierCompany: haulType === 'COMPANY' ? carrierCompany.trim() || undefined : undefined,
      };

      const result = editing
        ? await receiptApi.update(editing.id, payload)
        : await receiptApi.create(payload, idempotencyKey);

      onSaved(result.receipt);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ثبت حواله ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:bg-white focus:outline-amber-500';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-3 sm:p-4 overflow-y-auto no-print">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl my-4">
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between rounded-t-2xl">
          <h3 className="font-black text-base">
            {editing ? `ویرایش پیش‌نویس ${editing.receiptNumber}` : 'صدور حواله جدید'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center">
            <Loader2 className="w-6 h-6 text-slate-300 mx-auto animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                مشتری <span className="text-red-500">*</span>
              </label>
              <select
                value={customerId ?? ''}
                onChange={(e) => setCustomerId(Number(e.target.value) || null)}
                className={`${inputCls} cursor-pointer ${fieldErrors.customer ? 'border-red-400 bg-red-50' : ''}`}
              >
                <option value="">— انتخاب کنید —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
              {fieldErrors.customer && <p className="text-[11px] text-red-700 font-bold mt-1">{fieldErrors.customer}</p>}
            </div>

            <DriverPicker value={driver} onChange={setDriver} error={fieldErrors.driver} />

            <div className={`rounded-xl border p-3 space-y-2 ${fieldErrors.haul ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="text-xs font-bold text-slate-700">
                نوع حمل <span className="text-red-500">*</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="haul" checked={haulType === 'SELF'} onChange={() => setHaulType('SELF')} />
                  خود حمل (مشتری با وسیله خودش)
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="haul" checked={haulType === 'COMPANY'} onChange={() => setHaulType('COMPANY')} />
                  شرکت حمل‌ونقل
                </label>
                {haulType === 'COMPANY' && (
                  <input type="text" value={carrierCompany} placeholder="نام شرکت حمل (اختیاری)"
                    onChange={(e) => setCarrierCompany(e.target.value)} className={`${inputCls} max-w-[220px]`} />
                )}
              </div>
              {fieldErrors.haul && <p className="text-[11px] text-red-700 font-bold">{fieldErrors.haul}</p>}
            </div>

            <div className={`bg-slate-50 rounded-xl border p-3 space-y-2 ${fieldErrors.items ? 'border-red-400' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800">اقلام حواله</span>
                <button
                  type="button"
                  onClick={() => setRows((r) => [...r, newRow()])}
                  className="bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold px-2.5 py-1 rounded-lg text-[11px] transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن ردیف</span>
                </button>
              </div>

              {fieldErrors.items && <p className="text-[11px] text-red-700 font-bold">{fieldErrors.items}</p>}

              {rows.map((row, index) => {
                const product = row.productId ? productById.get(row.productId) : null;
                const bagCount = parseRial(row.bagCount);
                const lineWeight = product && bagCount ? product.bagWeightKg * bagCount : 0;
                const lineTotal = lineWeight * (product?.basePricePerKg ?? 0);

                return (
                  <div key={row.key} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <select
                        value={row.productId ?? ''}
                        onChange={(e) =>
                          setRows((rs) =>
                            rs.map((r, i) =>
                              i === index ? { ...r, productId: Number(e.target.value) || null } : r,
                            ),
                          )
                        }
                        className={`${inputCls} cursor-pointer`}
                      >
                        <option value="">— محصول —</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="کیسه"
                        value={row.bagCount}
                        onChange={(e) =>
                          setRows((rs) =>
                            rs.map((r, i) => (i === index ? { ...r, bagCount: e.target.value } : r)),
                          )
                        }
                        className={inputCls}
                      />
                    </div>

                    <div className="col-span-4 text-[11px] text-slate-600 font-bold">
                      {product && bagCount ? (
                        <>
                          <div>{(lineWeight / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 2 })} تُن</div>
                          <div className="text-slate-900">{formatRial(lineTotal)} ریال</div>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>

                    <div className="col-span-1 text-center">
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setRows((rs) => rs.filter((_, i) => i !== index))}
                          className="text-slate-400 hover:text-red-600 p-1 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تخفیف (ریال)</label>
                <input type="text" value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">توضیحات</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
              </div>
            </div>

            {preview && 'error' in preview && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 flex items-center gap-2 text-xs text-amber-900 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{preview.error}</span>
              </div>
            )}

            {calcOk && (
              <div className="bg-amber-100/70 border border-amber-200 rounded-xl p-3 space-y-1.5 text-xs font-bold text-amber-950">
                <div className="flex items-center gap-1 pb-1 border-b border-amber-200">
                  <Scale className="w-3.5 h-3.5" />
                  <span>
                    {(preview.totalWeightKg / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 2 })} تُن
                    {' • '}
                    {preview.totalBagCount.toLocaleString('fa-IR')} کیسه
                  </span>
                </div>
                <div className="flex justify-between"><span>جمع کل:</span><span>{formatRial(preview.subtotal)}</span></div>
                {preview.discount > 0 && (
                  <div className="flex justify-between"><span>تخفیف:</span><span>−{formatRial(preview.discount)}</span></div>
                )}
                <div className="flex justify-between"><span>مالیات بر ارزش افزوده:</span><span>{formatRial(preview.vatAmount)}</span></div>
                <div className="flex justify-between text-sm font-black pt-1 border-t border-amber-200">
                  <span>مبلغ نهایی:</span><span>{formatRial(preview.grandTotal)} ریال</span>
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="bg-red-50 border border-red-300 rounded-xl p-2.5 flex items-center gap-2 text-xs text-red-800 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition cursor-pointer">
                انصراف
              </button>
              <button type="submit" disabled={busy}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-black px-6 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{busy ? 'در حال ثبت…' : editing ? 'ذخیره پیش‌نویس' : 'ثبت پیش‌نویس'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
