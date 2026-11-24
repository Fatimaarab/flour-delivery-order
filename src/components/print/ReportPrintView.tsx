import React from 'react';
import { Logo } from '../Logo';
import { formatJalaliDate, formatJalaliDateTime } from '../../lib/jalali';

/**
 * نمای چاپی گزارش‌ها — همان چیزی که به PDF تبدیل می‌شود.
 *
 * ── چرا PDF را خود مرورگر می‌سازد ────────────────────────────────────────
 * ساخت PDF روی سرور یا نیاز به دانلود یک مرورگر کامل دارد (صدها مگابایت،
 * روی سرور آفلاین کارخانه دردسرساز)، یا کتابخانه‌هایی که فارسی و راست‌به‌چپ
 * را درست نمی‌چینند.
 *
 * مرورگر همان موتوری است که صفحه را نمایش می‌دهد؛ پس فارسی، راست‌به‌چپ و
 * فونت وزیرمتن دقیقاً همان‌طور در PDF می‌افتند که روی صفحه دیده می‌شوند.
 * کاربر در پنجره چاپ ویندوز، مقصد را «Save as PDF» می‌گذارد.
 * ────────────────────────────────────────────────────────────────────────
 */

export interface PrintColumn<T> {
  header: string;
  render: (row: T) => React.ReactNode;
}

interface Props<T> {
  companyName: string;
  reportLabel: string;
  columns: readonly PrintColumn<T>[];
  rows: readonly T[];
  /** بازه تاریخی گزارش، اگر انتخاب شده باشد */
  from?: string;
  to?: string;
  /** نام کاربری که گزارش را گرفته — برای پاسخ‌گویی */
  generatedBy: string;
}

export function ReportPrintView<T>({
  companyName,
  reportLabel,
  columns,
  rows,
  from,
  to,
  generatedBy,
}: Props<T>) {
  const rangeText =
    from && to
      ? `از ${formatJalaliDate(from)} تا ${formatJalaliDate(to)}`
      : from
        ? `از ${formatJalaliDate(from)}`
        : to
          ? `تا ${formatJalaliDate(to)}`
          : 'همه بازه زمانی';

  return (
    <div className="report-print bg-white text-black">
      {/* سربرگ — روی هر صفحه تکرار نمی‌شود، فقط صفحه اول */}
      <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
        <div className="flex items-center gap-2.5">
          <Logo size={44} />
          <div>
            <div className="font-black text-sm">{companyName}</div>
            <div className="font-bold text-xs mt-0.5">{reportLabel}</div>
          </div>
        </div>

        <div className="text-left text-[10px] leading-relaxed">
          <div className="font-bold">{rangeText}</div>
          <div className="text-slate-600">
            تاریخ گزارش: {formatJalaliDateTime(new Date())}
          </div>
          <div className="text-slate-600">تهیه‌کننده: {generatedBy}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-center text-xs font-bold py-8">
          داده‌ای برای این گزارش وجود ندارد.
        </p>
      ) : (
        <table className="w-full border-collapse border border-black text-[10px] text-center">
          {/*
            thead با display:table-header-group در CSS چاپ تکرار می‌شود،
            پس در گزارش‌های چندصفحه‌ای، سرستون‌ها بالای هر صفحه می‌آیند.
          */}
          <thead>
            <tr className="bg-slate-100 font-bold">
              <th className="border border-black p-1">ردیف</th>
              {columns.map((c) => (
                <th key={c.header} className="border border-black p-1 whitespace-nowrap">
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="report-row">
                <td className="border border-black p-1">
                  {(i + 1).toLocaleString('fa-IR')}
                </td>
                {columns.map((c) => (
                  <td key={c.header} className="border border-black p-1">
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-3 pt-2 border-t border-slate-400 flex items-center justify-between text-[9px] text-slate-600">
        <span>{companyName}</span>
        <span>{rows.length.toLocaleString('fa-IR')} سطر</span>
      </div>
    </div>
  );
}
