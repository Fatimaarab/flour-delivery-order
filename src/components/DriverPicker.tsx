import React, { useEffect, useRef, useState } from 'react';
import { Search, X, User, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { IranPlateBadge } from './IranPlate';

export interface DriverRow {
  id: number;
  fullName: string;
  nationalId: string;
  mobile: string | null;
  plateNumber: string | null;
  isActive: boolean;
}

interface Props {
  /** راننده انتخاب‌شده (یا همان که پیش‌نویس از قبل داشته) */
  value: DriverRow | null;
  onChange: (driver: DriverRow | null) => void;
  error?: string | null;
}

/**
 * انتخاب راننده با جستجو — راننده در حواله **تعریف نمی‌شود**.
 *
 * راننده‌ها یک‌بار در بخش «رانندگان» ثبت می‌شوند و اینجا فقط با نام، کد ملی،
 * موبایل یا بخشی از پلاک پیدا و انتخاب می‌شوند.
 */
export const DriverPicker: React.FC<Props> = ({ value, onChange, error }) => {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<DriverRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setLoading(true);
      api
        .get<{ drivers: DriverRow[] }>(`/drivers?search=${encodeURIComponent(term.trim())}`)
        .then((d) => setResults(d.drivers.slice(0, 20)))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [term, open]);

  // کلیک بیرون از کادر، فهرست را می‌بندد
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const border = error ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-slate-50';

  return (
    <div ref={box} className="relative">
      <label className="block text-xs font-bold text-slate-700 mb-1">
        راننده <span className="text-red-500">*</span>
      </label>

      {value ? (
        <div className={`border ${border} rounded-xl px-3 py-2 flex items-center gap-3`}>
          <User className="w-4 h-4 text-slate-500 shrink-0" />
          <div className="flex-1 min-w-0 text-xs">
            <div className="font-black text-slate-900">{value.fullName}</div>
            <div className="text-slate-500 font-bold">
              کد ملی: <span className="font-mono">{value.nationalId}</span>
              {value.mobile && <> • موبایل: <span className="font-mono">{value.mobile}</span></>}
            </div>
          </div>
          {value.plateNumber && <IranPlateBadge plateString={value.plateNumber} size="sm" />}
          <button
            type="button"
            onClick={() => { onChange(null); setTerm(''); setOpen(true); }}
            title="تغییر راننده"
            className="text-slate-400 hover:text-red-600 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={term}
              placeholder="جستجوی راننده با نام، کد ملی، موبایل یا پلاک…"
              onFocus={() => setOpen(true)}
              onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
              className={`w-full pr-9 pl-3 py-2 border ${border} rounded-xl text-xs font-bold focus:bg-white focus:outline-amber-500`}
            />
          </div>

          {open && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
              {loading && (
                <div className="p-3 text-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400 inline" /></div>
              )}
              {!loading && results.length === 0 && (
                <div className="p-3 text-xs text-slate-600 font-bold leading-relaxed">
                  راننده‌ای پیدا نشد. اگر راننده تازه است، اول از منوی
                  «رانندگان» او را تعریف کنید و دوباره برگردید.
                </div>
              )}
              {results.map((d) => (
                <button
                  type="button"
                  key={d.id}
                  onClick={() => { onChange(d); setOpen(false); }}
                  className="w-full text-right px-3 py-2 hover:bg-amber-50 border-b border-slate-100 last:border-0 flex items-center gap-3 cursor-pointer"
                >
                  <div className="flex-1 min-w-0 text-xs">
                    <div className="font-black text-slate-900">{d.fullName}</div>
                    <div className="text-slate-500 font-bold font-mono">{d.nationalId}</div>
                  </div>
                  {d.plateNumber && <IranPlateBadge plateString={d.plateNumber} size="sm" />}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {error && <p className="text-[11px] text-red-700 font-bold mt-1">{error}</p>}
    </div>
  );
};
