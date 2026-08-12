import React, { useState } from 'react';
import { FlourReceipt } from '../types';
import {
  Printer,
  Copy,
  Check,
  FileCode,
  Edit3,
  ShieldAlert,
  Truck,
  FileText,
  Scissors,
  Warehouse,
  Scale,
  MessageSquareText,
  Layers,
} from 'lucide-react';

interface ReceiptPaperProps {
  receipt: FlourReceipt;
  onEdit?: (receipt: FlourReceipt) => void;
  onViewDjangoCode?: () => void;
}

export const ReceiptPaper: React.FC<ReceiptPaperProps> = ({
  receipt,
  onEdit,
  onViewDjangoCode,
}) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'both' | 'warehouse' | 'scale'>('both');

  const handlePrint = () => {
    window.print();
  };

  const getFullCopyText = () => {
    return `شرکت آرد طلای سفید ماهان
«برگ صدور حواله تحویل آرد»
----------------------------------------
شماره حواله: ${receipt.receipt_number}
تاریخ صدور: ${receipt.issue_date}
نام راننده: ${receipt.driver_name}
شماره کامیون: ${receipt.truck_number}
کد ملی راننده: ${receipt.driver_national_id}
تعداد کیسه آرد: ${receipt.bag_count} کیسه
مقصد: ${receipt.destination}
توضیحات: ${receipt.description || 'بدون توضیحات اضافی'}
----------------------------------------
تعهدات:
• راننده پس از تحویل در مقصد ملزم به دریافت رسید از تحویل گیرنده می باشد.
• ضمانت صحیح و سالم رسیدن بار فوق به عهده راننده می باشد.

نسخه ۱: نسخه انبار | نسخه ۲: نسخه باسکول`;
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(getFullCopyText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Sub-component for rendering a single official copy (either Warehouse or Scale)
  const SingleReceiptCopy = ({ type }: { type: 'warehouse' | 'scale' }) => {
    const isWarehouse = type === 'warehouse';
    const copyTitle = isWarehouse ? 'نسخه انبار' : 'نسخه باسکول';
    const BadgeIcon = isWarehouse ? Warehouse : Scale;
    const badgeBg = isWarehouse
      ? 'bg-amber-100 text-amber-900 border-amber-300'
      : 'bg-blue-100 text-blue-900 border-blue-300';

    return (
      <div className="receipt-paper-box bg-white border-2 border-slate-900 rounded-lg p-6 shadow-xs relative text-slate-900 my-4">
        
        {/* Header Table */}
        <table className="w-full border-collapse mb-6 border-b-2 border-slate-900 pb-3">
          <tbody>
            <tr>
              <td className="w-1/3 align-top text-right text-xs sm:text-sm font-bold text-slate-800">
                <div className="space-y-1">
                  <div className="bg-slate-50 border border-slate-300 px-2.5 py-1 rounded inline-block text-slate-900">
                    شماره حواله:{' '}
                    <span className="text-amber-800 font-extrabold text-base mr-1 underline decoration-dotted decoration-amber-600">
                      {receipt.receipt_number}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    تاریخ: <span className="font-bold">{receipt.issue_date}</span>
                  </div>
                </div>
              </td>

              <td className="w-1/3 align-middle text-center">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 mb-1">
                  شرکت آرد طلای سفید ماهان
                </h1>
                <div className="inline-block bg-slate-100 border border-slate-400 px-3 py-1 rounded text-sm sm:text-base font-bold text-slate-800">
                  «برگ صدور حواله تحویل آرد»
                </div>
              </td>

              <td className="w-1/3 align-top text-left">
                {/* Official Copy Badge Stamp */}
                <div
                  className={`inline-flex items-center gap-1.5 border-2 px-3 py-1.5 rounded-lg font-black text-xs sm:text-sm shadow-2xs ${badgeBg}`}
                >
                  <BadgeIcon className="w-4 h-4 shrink-0" />
                  <span>{copyTitle}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Main Body Text Statement */}
        <div className="text-sm sm:text-base leading-relaxed text-justify space-y-4 my-4">
          <p className="indent-4 leading-loose text-slate-900">
            در تاریخ{' '}
            <strong className="variable-underline text-slate-900 font-bold px-1.5 py-0.5 border-b-2 border-dotted border-amber-700">
              {receipt.issue_date}
            </strong>{' '}
            تعداد{' '}
            <strong className="variable-underline text-slate-900 font-bold px-1.5 py-0.5 border-b-2 border-dotted border-amber-700">
              {receipt.bag_count}
            </strong>{' '}
            کیسه آرد تحویل راننده کامیون آقای{' '}
            <strong className="variable-underline text-slate-900 font-bold px-1.5 py-0.5 border-b-2 border-dotted border-amber-700">
              {receipt.driver_name}
            </strong>{' '}
            به شماره کامیون{' '}
            <strong className="variable-underline text-slate-900 font-bold px-1.5 py-0.5 border-b-2 border-dotted border-amber-700">
              {receipt.truck_number}
            </strong>{' '}
            و کدملی{' '}
            <strong className="variable-underline text-slate-900 font-bold px-1.5 py-0.5 border-b-2 border-dotted border-amber-700">
              {receipt.driver_national_id}
            </strong>{' '}
            جهت حمل به مقصد{' '}
            <strong className="variable-underline text-slate-900 font-bold px-1.5 py-0.5 border-b-2 border-dotted border-amber-700">
              {receipt.destination}
            </strong>{' '}
            تحویل گردید.
          </p>

          {/* User Custom Descriptions / Notes Section */}
          <div className="bg-amber-50/70 border border-amber-300 rounded-lg p-3 text-xs sm:text-sm my-3 space-y-1">
            <div className="font-bold text-amber-950 flex items-center gap-1.5">
              <MessageSquareText className="w-4 h-4 text-amber-700 shrink-0" />
              <span>توضیحات و یادداشت‌های تکمیلی ({copyTitle}):</span>
            </div>
            {receipt.description ? (
              <p className="text-slate-900 font-medium whitespace-pre-wrap leading-relaxed pr-5">
                {receipt.description}
              </p>
            ) : (
              <p className="text-slate-400 italic pr-5 border-b border-dotted border-slate-300 pb-1">
                توضیحات خاصی ثبت نشده است (محل درج یادداشت دستی انباردار یا مسئول باسکول)
              </p>
            )}
          </div>

          {/* Rules & Requirements Box */}
          <div className="bg-slate-50 border-r-4 border-amber-600 p-2.5 rounded text-xs space-y-1 text-slate-800">
            <p className="font-semibold flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-amber-700 shrink-0 inline no-print" />
              <span>• راننده پس از تحویل در مقصد ملزم به دریافت رسید از تحویل گیرنده می باشد.</span>
            </p>
            <p className="font-semibold flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-700 shrink-0 inline no-print" />
              <span>• ضمانت صحیح و سالم رسیدن بار فوق به عهده راننده می باشد.</span>
            </p>
          </div>
        </div>

        {/* Structured Data Summary Table */}
        <div className="my-4">
          <table className="w-full border-collapse border border-slate-400 text-xs text-center">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-400">
                <th className="border border-slate-400 p-1.5">شماره حواله</th>
                <th className="border border-slate-400 p-1.5">تعداد کیسه</th>
                <th className="border border-slate-400 p-1.5">نام راننده</th>
                <th className="border border-slate-400 p-1.5">پلاک کامیون</th>
                <th className="border border-slate-400 p-1.5">کد ملی</th>
                <th className="border border-slate-400 p-1.5">گیرنده / مقصد</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-slate-900 font-medium">
                <td className="border border-slate-400 p-1.5 font-bold">{receipt.receipt_number}</td>
                <td className="border border-slate-400 p-1.5 font-bold text-amber-800">{receipt.bag_count} کیسه</td>
                <td className="border border-slate-400 p-1.5 font-bold">{receipt.driver_name}</td>
                <td className="border border-slate-400 p-1.5">{receipt.truck_number}</td>
                <td className="border border-slate-400 p-1.5">{receipt.driver_national_id}</td>
                <td className="border border-slate-400 p-1.5">{receipt.destination}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Signatures Table */}
        <table className="w-full border-collapse mt-6 pt-4">
          <tbody>
            <tr>
              <td className="w-1/2 text-center align-top p-2">
                <div className="font-bold text-slate-900 text-xs sm:text-sm mb-8">
                  امضاء مسئول {isWarehouse ? 'انبار / صدور' : 'متصدی باسکول'}
                </div>
                <div className="border-t border-dashed border-slate-400 w-3/4 mx-auto pt-1 text-[11px] text-slate-500">
                  محل مهر و امضاء مسئول
                </div>
              </td>
              <td className="w-1/2 text-center align-top p-2">
                <div className="font-bold text-slate-900 text-xs sm:text-sm mb-8">
                  امضاء راننده (نام و نام خانوادگی)
                </div>
                <div className="border-t border-dashed border-slate-400 w-3/4 mx-auto pt-1 text-[11px] text-slate-500">
                  امضاء و اثر انگشت راننده
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Bottom Small Watermark */}
        <div className="mt-4 pt-2 border-t border-slate-200 text-center text-[10px] text-slate-400 flex justify-between items-center">
          <span>شرکت آرد طلای سفید ماهان</span>
          <span className="font-bold text-slate-600">{copyTitle} (ارسال به {isWarehouse ? 'بایگانی انبار' : 'بایگانی باسکول'})</span>
          <span>صفحه رسمی چاپی</span>
        </div>

      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto my-4 space-y-4">
      
      {/* Top Controls Bar - Hidden during printing */}
      <div className="no-print bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
          <FileText className="w-5 h-5 text-amber-600" />
          <span>پیش‌نمایش فرم چاپی حواله شماره {receipt.receipt_number}</span>
        </div>

        {/* Print Copies View Selector */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
          <button
            onClick={() => setViewMode('both')}
            className={`px-2.5 py-1.5 rounded-md font-bold transition cursor-pointer flex items-center gap-1 ${
              viewMode === 'both' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>هر دو نسخه (انبار + باسکول)</span>
          </button>

          <button
            onClick={() => setViewMode('warehouse')}
            className={`px-2.5 py-1.5 rounded-md font-bold transition cursor-pointer flex items-center gap-1 ${
              viewMode === 'warehouse' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Warehouse className="w-3.5 h-3.5" />
            <span>فقط نسخه انبار</span>
          </button>

          <button
            onClick={() => setViewMode('scale')}
            className={`px-2.5 py-1.5 rounded-md font-bold transition cursor-pointer flex items-center gap-1 ${
              viewMode === 'scale' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>فقط نسخه باسکول</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2.5 rounded-lg shadow-sm hover:shadow transition-all cursor-pointer text-sm"
          >
            <Printer className="w-4 h-4" />
            <span>چاپ برگه (Print)</span>
          </button>

          {onEdit && (
            <button
              onClick={() => onEdit(receipt)}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3.5 py-2.5 rounded-lg transition text-sm cursor-pointer"
            >
              <Edit3 className="w-4 h-4 text-slate-600" />
              <span>ویرایش</span>
            </button>
          )}

          <button
            onClick={handleCopyText}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3.5 py-2.5 rounded-lg transition text-sm cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">کپی شد!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-600" />
                <span>کپی متن</span>
              </>
            )}
          </button>

          {onViewDjangoCode && (
            <button
              onClick={onViewDjangoCode}
              className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium px-3.5 py-2.5 rounded-lg transition text-sm cursor-pointer border border-blue-200"
            >
              <FileCode className="w-4 h-4 text-blue-600" />
              <span>کد Django</span>
            </button>
          )}
        </div>
      </div>

      {/* Printable Area containing Copies */}
      <div className="print-area-container space-y-6">
        
        {/* Warehouse Copy */}
        {(viewMode === 'both' || viewMode === 'warehouse') && (
          <SingleReceiptCopy type="warehouse" />
        )}

        {/* Perforated Cut Line Divider when both copies are printed */}
        {viewMode === 'both' && (
          <div className="my-6 border-t-2 border-dashed border-slate-400 relative text-center flex items-center justify-center">
            <span className="bg-slate-100 text-slate-600 px-4 py-1 rounded-full text-xs font-bold border border-slate-300 flex items-center gap-2 shadow-2xs">
              <Scissors className="w-4 h-4 text-slate-500" />
              <span>محل برش و جداسازی برگه (نسخه انبار / نسخه باسکول)</span>
            </span>
          </div>
        )}

        {/* Scale/Weighbridge Copy */}
        {(viewMode === 'both' || viewMode === 'scale') && (
          <SingleReceiptCopy type="scale" />
        )}

      </div>

    </div>
  );
};
