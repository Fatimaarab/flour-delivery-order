import React, { useEffect, useRef, useState } from 'react';
import { toLatinDigits, toPersianDigits } from '../../shared/digits';
import {
  LETTER_MEANING,
  PLATE_LETTERS,
  formatPlate,
  isValidPlate,
  parsePlate,
} from '../../shared/plate';

/**
 * ورودی پلاک انتظامی، به شکل خود پلاک.
 *
 * ── چرا نه یک جعبه متن ساده ──────────────────────────────────────────────
 * قبلاً پلاک یک جعبه متن آزاد بود. انباردار هر چیزی می‌توانست بنویسد و
 * نادرستی‌اش تا لحظه چاپ برگه معلوم نمی‌شد — یعنی وقتی کامیون دم گیت
 * ایستاده و دیگر برای اصلاح دیر است.
 *
 * چهار خانه جدا، هر کدام با تعداد رقم مشخص، خودش قالب را به کاربر یاد
 * می‌دهد؛ لازم نیست کسی به خاطر بسپارد که با فاصله بنویسد یا با خط تیره.
 * مکان‌نما هم با پر شدن هر خانه خودکار می‌رود خانه بعد، چون انباردار این
 * فرم را روزی چند بار پر می‌کند.
 * ────────────────────────────────────────────────────────────────────────
 */
interface Props {
  /** مقدار به شکل ذخیره‌سازی: `42ع317ایران36` */
  value: string;
  onChange: (plate: string) => void;
  label?: string;
  className?: string;
}

const EMPTY = { left: '', letter: 'ع', right: '', zone: '' };

export const IranPlateInput: React.FC<Props> = ({
  value,
  onChange,
  label = 'پلاک خودرو',
  className = '',
}) => {
  const [parts, setParts] = useState(() => parsePlate(value) ?? EMPTY);
  const [touched, setTouched] = useState(false);

  /**
   * آخرین مقداری که خودِ این کادر بیرون فرستاده است.
   *
   * ── چرا لازم است ───────────────────────────────────────────────────────
   * تا وقتی پلاک کامل نشده، این کادر مقدار خالی بیرون می‌فرستد. بدون این
   * نشانه، همان مقدار خالی از بالا برمی‌گشت و افکت پایین، پلاک نیمه‌تمام را
   * پاک می‌کرد. نتیجه در عمل این بود: کاربر پلاک ثبت‌شده‌ای را باز می‌کرد،
   * یک رقم را اصلاح می‌کرد و **کل پلاک پاک می‌شد**.
   * ──────────────────────────────────────────────────────────────────────
   */
  const lastEmitted = useRef(value);

  const leftRef = useRef<HTMLInputElement>(null);
  const rightRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLInputElement>(null);

  // فقط وقتی مقدار از **بیرون** عوض شده باشد (مثلاً انتخاب یک حواله دیگر از
  // صف)، نه وقتی بازتاب چیزی است که همین کادر فرستاده.
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    setParts(parsePlate(value) ?? EMPTY);
    if (!value) setTouched(false);
  }, [value]);

  const update = (next: typeof parts) => {
    setParts(next);
    setTouched(true);
    // تا وقتی پلاک کامل نشده، مقدار خالی بیرون می‌رود تا پلاک نیمه‌کاره
    // ذخیره نشود. ارقام تایپ‌شده اما در خود کادر می‌مانند.
    const emitted = isValidPlate(next) ? formatPlate(next) : '';
    lastEmitted.current = emitted;
    onChange(emitted);
  };

  /** فقط رقم می‌پذیرد و با پر شدن، خودش می‌رود خانه بعد. */
  const digitBox = (
    key: 'left' | 'right' | 'zone',
    maxLen: number,
    ref: React.RefObject<HTMLInputElement | null>,
    nextRef: React.RefObject<HTMLInputElement | null> | null,
    width: string,
  ) => (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      dir="ltr"
      value={toPersianDigits(parts[key])}
      onChange={(e) => {
        const digits = toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, maxLen);
        update({ ...parts, [key]: digits });
        if (digits.length === maxLen) nextRef?.current?.focus();
      }}
      className={`${width} h-10 text-center font-black text-lg bg-white border-0 focus:outline-none focus:bg-amber-50`}
      placeholder={'۰'.repeat(maxLen)}
    />
  );

  const complete = isValidPlate(parts);
  const partiallyFilled = Boolean(parts.left || parts.right || parts.zone);
  const invalid = touched && partiallyFilled && !complete;

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-bold text-slate-700 mb-1">{label}</label>
      )}

      {/* کادر بیرونی، به شکل خود پلاک */}
      <div
        dir="ltr"
        className={`inline-flex items-stretch border-2 rounded-lg overflow-hidden bg-white ${
          invalid ? 'border-red-400' : 'border-slate-900'
        }`}
      >
        {/* نوار آبی ایران */}
        <div className="bg-blue-700 text-white flex flex-col items-center justify-center px-1.5 gap-0.5 shrink-0">
          <div className="flex flex-col gap-0.5 items-center">
            <div className="w-3 h-0.5 bg-green-500" />
            <div className="w-3 h-0.5 bg-white" />
            <div className="w-3 h-0.5 bg-red-500" />
          </div>
          <span className="text-[7px] font-bold tracking-tighter">I.R.</span>
          <span className="text-[6px] tracking-tighter">IRAN</span>
        </div>

        {/*
          از دو رقم چپ مستقیم به سه رقم راست می‌رود و از حرف رد می‌شود:
          حرف یک فهرست است و تایپ رقم داخلش کار نمی‌کند. بیشتر کامیون‌ها
          هم «ع» هستند که پیش‌فرض است.
        */}
        {digitBox('left', 2, leftRef, rightRef, 'w-12')}

        <select
          value={parts.letter}
          onChange={(e) => {
            update({ ...parts, letter: e.target.value });
            rightRef.current?.focus();
          }}
          dir="rtl"
          className="h-10 px-1 text-center font-black text-base bg-slate-50 border-x border-slate-300 focus:outline-none focus:bg-amber-50 cursor-pointer"
        >
          {PLATE_LETTERS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

        {digitBox('right', 3, rightRef, zoneRef, 'w-16')}

        {/* کادر کد استان */}
        <div className="flex flex-col items-center justify-center border-l-2 border-slate-900 bg-white px-1 shrink-0">
          <span className="text-[8px] text-slate-600 font-bold leading-none">ایران</span>
          {digitBox('zone', 2, zoneRef, null, 'w-10 !h-5 !text-sm')}
        </div>
      </div>

      {LETTER_MEANING[parts.letter] && (
        <p className="text-[10px] text-slate-500 font-bold mt-1">
          حرف {parts.letter}: {LETTER_MEANING[parts.letter]}
        </p>
      )}

      {invalid && (
        <p className="text-[10px] text-red-700 font-bold mt-1">
          پلاک کامل نیست. نمونه: ۴۲ ع ۳۱۷ ایران ۳۶ (کد استان از ۱۰ به بالا)
        </p>
      )}
    </div>
  );
};
