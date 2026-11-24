import React from 'react';
import { toPersianDigits } from '../../shared/digits';
import { parsePlate } from '../../shared/plate';

/**
 * نمایش پلاک انتظامی در قالب خود پلاک ایرانی.
 *
 * تجزیه پلاک اینجا انجام نمی‌شود؛ همان `shared/plate.ts` که فرم ورود و سرور
 * از آن استفاده می‌کنند، اینجا هم استفاده می‌شود. پیش از این این فایل تجزیه
 * جداگانه خودش را داشت و همان نسخه بود که برای پلاک خالی، پلاک نمونه
 * می‌ساخت.
 */
interface IranPlateProps {
  plateString: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZES = {
  sm: {
    container: 'h-6 text-[10px] px-1 rounded-sm gap-1',
    left: 'text-xs font-black',
    letter: 'text-[11px] font-bold px-0.5',
    right: 'text-xs font-black',
    zone: 'text-[10px] font-black',
    iranText: 'text-[7px]',
  },
  md: {
    container: 'h-8 text-xs px-1.5 rounded-md gap-1.5 shadow-2xs',
    left: 'text-sm font-black',
    letter: 'text-xs font-extrabold px-1',
    right: 'text-sm font-black',
    zone: 'text-xs font-black',
    iranText: 'text-[8px]',
  },
  lg: {
    container: 'h-10 text-sm px-2.5 rounded-lg gap-2 shadow-xs',
    left: 'text-base font-black',
    letter: 'text-sm font-extrabold px-1.5',
    right: 'text-base font-black',
    zone: 'text-sm font-black',
    iranText: 'text-[9px]',
  },
  // اندازه برگه چاپی. نگهبان گیت باید پلاک را از فاصله و در نور کارگاه با
  // خود کامیون تطبیق دهد، پس اینجا عمداً از همه بزرگ‌تر است.
  xl: {
    container: 'h-14 text-base px-3 rounded-lg gap-2.5',
    left: 'text-2xl font-black',
    letter: 'text-xl font-extrabold px-2',
    right: 'text-2xl font-black',
    zone: 'text-lg font-black',
    iranText: 'text-[11px]',
  },
} as const;

export const IranPlateBadge: React.FC<IranPlateProps> = ({
  plateString,
  size = 'md',
  className = '',
}) => {
  const parsed = parsePlate(plateString);
  const s = SIZES[size];

  // پلاکی که با قالب ایران نخواند، عیناً و بیرون از قالب پلاک نشان داده
  // می‌شود تا معلوم باشد سامانه آن را تأیید نکرده است.
  if (!parsed) {
    return (
      <span
        className={`inline-flex items-center border border-slate-400 bg-amber-200/80 text-slate-900 font-bold px-2 py-0.5 rounded text-xs ${className}`}
      >
        {plateString?.trim() || 'بدون پلاک'}
      </span>
    );
  }

  // پلاک بار و تاکسی زمینه زرد دارد، شخصی سفید
  const isPublicTransport = parsed.letter === 'ع' || parsed.letter === 'ت';

  return (
    <div
      dir="ltr"
      className={`inline-flex items-center border-2 border-slate-900 text-slate-950 font-mono select-none ${
        isPublicTransport ? 'bg-amber-400' : 'bg-white'
      } ${s.container} ${className}`}
      title={`پلاک انتظامی: ${plateString}`}
    >
      {/* نوار آبی سمت چپ، مثل خود پلاک */}
      <div className="bg-blue-700 text-white flex flex-col items-center justify-between py-0.5 px-1 h-full rounded-l-xs font-sans -ml-1">
        <div className="flex flex-col gap-0.5 items-center">
          <div className="w-2.5 h-0.5 bg-green-500" />
          <div className="w-2.5 h-0.5 bg-white" />
          <div className="w-2.5 h-0.5 bg-red-500" />
        </div>
        <span className="text-[7px] font-bold tracking-tighter">I.R.</span>
        <span className="text-[6px] tracking-tighter">IRAN</span>
      </div>

      <div className="flex items-center gap-1 font-bold">
        <span className={s.left}>{toPersianDigits(parsed.left)}</span>
        <span className={`bg-slate-900/10 rounded ${s.letter}`}>{parsed.letter}</span>
        <span className={s.right}>{toPersianDigits(parsed.right)}</span>
      </div>

      {/* کد استان، در کادر سمت راست */}
      <div className="border-l-2 border-slate-900 pl-1 ml-0.5 flex flex-col items-center justify-center leading-none">
        <span className={`text-slate-700 font-bold ${s.iranText}`}>ایران</span>
        <span className={s.zone}>{toPersianDigits(parsed.zone)}</span>
      </div>
    </div>
  );
};
