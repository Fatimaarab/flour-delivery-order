import React, { useEffect, useState } from 'react';
import { Calendar, X } from 'lucide-react';
import { isoToJalaliText, jalaliTextToIso } from '../../shared/jalaliDate';

/**
 * ورودی تاریخ شمسی.
 *
 * ── چرا ورودی استاندارد مرورگر کافی نبود ─────────────────────────────────
 * `<input type="date">` همیشه تاریخ **میلادی** نشان می‌دهد (`mm/dd/yyyy`).
 * کاربری که با تقویم شمسی کار می‌کند باید هر بار در ذهنش تبدیل کند — که هم
 * کند است و هم جای اشتباه دارد.
 *
 * اینجا کاربر تاریخ را به شمسی می‌نویسد (`۱۴۰۵/۰۷/۱۲`) و مقدار به میلادی
 * تبدیل و به سرور فرستاده می‌شود. ارقام فارسی و لاتین هر دو پذیرفته می‌شوند.
 * ────────────────────────────────────────────────────────────────────────
 */
interface Props {
  /** مقدار به صورت ISO میلادی (`2026-10-04`) یا رشته خالی */
  value: string;
  onChange: (isoDate: string) => void;
  label: string;
  className?: string;
}

export const JalaliDateInput: React.FC<Props> = ({ value, onChange, label, className = '' }) => {
  const [text, setText] = useState(() => (value ? isoToJalaliText(value) : ''));
  const [touched, setTouched] = useState(false);

  // اگر مقدار از بیرون عوض شد (مثلاً دکمه «حذف بازه»)، متن هم همگام شود
  useEffect(() => {
    setText(value ? isoToJalaliText(value) : '');
    if (!value) setTouched(false);
  }, [value]);

  const handleChange = (next: string) => {
    setText(next);
    setTouched(true);

    if (!next.trim()) {
      onChange('');
      return;
    }

    const iso = jalaliTextToIso(next);
    if (iso) onChange(iso);
  };

  const invalid = touched && text.trim().length > 0 && jalaliTextToIso(text) === null;

  return (
    <div className={className}>
      <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
        <Calendar className="w-3 h-3" />
        <span>{label}</span>
      </label>

      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="۱۴۰۵/۰۷/۱۲"
          className={`w-full px-3 py-2 pl-7 bg-slate-50 border rounded-xl text-xs font-bold text-center focus:bg-white focus:outline-amber-500 ${
            invalid ? 'border-red-400 bg-red-50' : 'border-slate-300'
          }`}
        />

        {text && (
          <button
            type="button"
            onClick={() => handleChange('')}
            title="پاک کردن"
            className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {invalid && (
        <p className="text-[10px] text-red-700 font-bold mt-1">
          تاریخ معتبر نیست. نمونه: ۱۴۰۵/۰۷/۱۲
        </p>
      )}
    </div>
  );
};
