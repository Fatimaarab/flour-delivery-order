import React from 'react';
import { Logo } from '../Logo';
import { formatRial } from '../../../shared/money';
import { formatJalaliDate } from '../../lib/jalali';
import type { Receipt } from '../../lib/receiptApi';

/**
 * فاکتور فروش — اندازه A5.
 *
 * برخلاف برگه A6 که دست راننده است، این سند مالی است و برای مشتری و
 * حسابداری چاپ می‌شود: قیمت واحد، جمع، تخفیف، مالیات بر ارزش افزوده و
 * مبلغ نهایی.
 */
export interface InvoiceProps {
  receipt: Receipt & {
    customer: {
      id: number;
      code: string;
      name: string;
      nationalId?: string | null;
      economicCode?: string | null;
      address?: string | null;
      phone?: string | null;
    };
  };
  companyName: string;
}

const fa = (n: number) => n.toLocaleString('fa-IR');

export const InvoiceA5: React.FC<InvoiceProps> = ({ receipt, companyName }) => (
  <div className="invoice-a5 border-2 border-black bg-white text-black p-4 flex flex-col">
    <div className="flex items-center justify-center gap-3 border-b-2 border-black pb-2 mb-3">
      <Logo size={52} />
      <div className="text-center">
        <div className="font-black text-base">{companyName}</div>
        <div className="font-bold text-xs mt-0.5">صورتحساب فروش کالا</div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] mb-3">
      <Field label="شماره فاکتور" value={receipt.receiptNumber} mono />
      <Field label="تاریخ" value={formatJalaliDate(receipt.issueDate)} />
      <Field label="خریدار" value={receipt.customer.name} />
      <Field label="کد مشتری" value={receipt.customer.code} mono />
      {receipt.customer.nationalId && (
        <Field label="کد/شناسه ملی" value={receipt.customer.nationalId} mono />
      )}
      {receipt.customer.economicCode && (
        <Field label="کد اقتصادی" value={receipt.customer.economicCode} mono />
      )}
      {receipt.customer.address && (
        <div className="col-span-2">
          <Field label="نشانی" value={receipt.customer.address} />
        </div>
      )}
    </div>

    <table className="w-full border-collapse border border-black text-[9.5px] text-center">
      <thead>
        <tr className="bg-slate-100 font-bold">
          <th className="border border-black p-1">ردیف</th>
          <th className="border border-black p-1">شرح کالا</th>
          <th className="border border-black p-1">تعداد کیسه</th>
          <th className="border border-black p-1">وزن (kg)</th>
          <th className="border border-black p-1">قیمت واحد (ریال)</th>
          <th className="border border-black p-1">مبلغ کل (ریال)</th>
        </tr>
      </thead>
      <tbody>
        {receipt.items.map((item, index) => (
          <tr key={item.id}>
            <td className="border border-black p-1">{fa(index + 1)}</td>
            <td className="border border-black p-1 text-right font-bold">{item.product.name}</td>
            <td className="border border-black p-1">{fa(item.bagCount)}</td>
            <td className="border border-black p-1">{fa(item.weightKg)}</td>
            <td className="border border-black p-1">{formatRial(item.unitPricePerKg)}</td>
            <td className="border border-black p-1 font-bold">{formatRial(item.lineTotal)}</td>
          </tr>
        ))}
      </tbody>
    </table>

    <div className="mt-2 flex justify-end">
      <table className="text-[10px] border-collapse">
        <tbody>
          <Total label="جمع کل" value={receipt.subtotal} />
          {receipt.discount > 0 && <Total label="تخفیف" value={-receipt.discount} />}
          <Total label="مالیات بر ارزش افزوده" value={receipt.vatAmount} />
          <Total label="مبلغ قابل پرداخت" value={receipt.grandTotal} emphasise />
          {receipt.paidAmount > 0 && (
            <>
              <Total label="پرداخت‌شده" value={receipt.paidAmount} />
              <Total label="مانده" value={receipt.grandTotal - receipt.paidAmount} />
            </>
          )}
        </tbody>
      </table>
    </div>

    {receipt.notes && (
      <div className="mt-2 text-[9px] border border-slate-400 rounded p-1.5">
        <span className="font-bold">توضیحات: </span>
        {receipt.notes}
      </div>
    )}

    <div className="flex items-end justify-between mt-auto pt-4 text-[9px] text-center">
      <div className="w-[45%]">
        <div className="font-bold mb-6">مهر و امضاء فروشنده</div>
        <div className="border-t border-dotted border-black pt-0.5 text-[8px]">
          {companyName}
        </div>
      </div>
      <div className="w-[45%]">
        <div className="font-bold mb-6">مهر و امضاء خریدار</div>
        <div className="border-t border-dotted border-black pt-0.5 text-[8px]">
          نام و نام خانوادگی
        </div>
      </div>
    </div>
  </div>
);

const Field: React.FC<{ label: string; value: string; mono?: boolean }> = ({
  label,
  value,
  mono,
}) => (
  <div className="flex gap-1">
    <span className="text-slate-600 shrink-0">{label}:</span>
    <span className={`font-bold ${mono ? 'font-mono' : ''}`}>{value}</span>
  </div>
);

const Total: React.FC<{ label: string; value: number; emphasise?: boolean }> = ({
  label,
  value,
  emphasise,
}) => (
  <tr className={emphasise ? 'font-black text-[11px]' : ''}>
    <td className="border border-black px-2 py-1 bg-slate-50">{label}</td>
    <td className="border border-black px-3 py-1 text-left min-w-[110px]">
      {value < 0 ? `−${formatRial(-value)}` : formatRial(value)}
    </td>
  </tr>
);
