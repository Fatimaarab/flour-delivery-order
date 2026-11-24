import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Loader2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { DeliveryNoteA6 } from './DeliveryNoteA6';
import type { Receipt } from '../../lib/receiptApi';

/**
 * دو نسخه چاپ می‌شود: یکی برای انبار و یکی برای راننده.
 *
 * پیش از این چهار نسخه بود (انبار، راننده، باسکول، بایگانی) که هر کدام
 * ربع یک A4 می‌شد و فونت‌ها ناچار ریز می‌ماندند. با دو نسخه، هر برگه نصف
 * A4 است و متن در اندازه خوانا جا می‌شود.
 */
const COPY_LABELS = ['نسخه انبار', 'نسخه راننده'];

interface ShipmentInfo {
  driverName: string | null;
  driverNationalId: string | null;
  plateNumber: string | null;
  haulType?: 'COMPANY' | 'SELF';
  carrierCompany: string | null;
}

export const PrintDialog: React.FC<{ receiptId: number; onClose: () => void }> = ({
  receiptId,
  onClose,
}) => {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [shipment, setShipment] = useState<ShipmentInfo | null>(null);
  const [companyName, setCompanyName] = useState('شرکت آرد طلای سفید ماهان');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await api.get<{
          receipt: Receipt & { shipment?: ShipmentInfo | null };
          companyName?: string;
        }>(`/receipts/${receiptId}/print`);
        setReceipt(data.receipt);
        setShipment(data.receipt.shipment ?? null);
        if (data.companyName) setCompanyName(data.companyName);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'دریافت اطلاعات چاپ ناموفق بود.');
      }
    })();
  }, [receiptId]);

  // اندازه کاغذ با همین صفت روی <html> تعیین می‌شود
  useEffect(() => {
    document.documentElement.dataset.print = 'note-a5';
    return () => {
      delete document.documentElement.dataset.print;
    };
  }, []);

  const handlePrint = () => {
    document.body.classList.add('printing');
    window.print();
    // پس از بسته شدن پنجره چاپ، صفحه به حالت عادی برمی‌گردد
    window.setTimeout(() => document.body.classList.remove('printing'), 500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-3 overflow-y-auto no-print">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl my-4">
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between rounded-t-2xl">
          <h3 className="font-black text-base flex items-center gap-2">
            <Printer className="w-5 h-5" />
            <span>چاپ حواله {receipt?.receiptNumber ?? ''}</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xs font-black text-slate-800">
              ۲ نسخه روی کاغذ A5
              <span className="block text-[10px] font-medium text-slate-500 mt-0.5">
                نسخه انبار و نسخه راننده — هر کدام یک برگ
              </span>
            </div>

            <button onClick={handlePrint} disabled={!receipt}
              className="mr-auto bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-amber-400 font-black px-5 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer">
              <Printer className="w-4 h-4" />
              <span>چاپ</span>
            </button>
          </div>

          <p className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[11px] text-slate-600 font-bold leading-relaxed">
            در پنجره چاپ، اندازه کاغذ باید A5 باشد (خودکار انتخاب می‌شود) و در
            تنظیمات بیشتر «Scale» روی ۱۰۰٪ بماند. برگه حواله عمداً مبلغی ندارد.
          </p>

          {error && (
            <p className="bg-red-50 border border-red-300 rounded-xl p-2.5 text-xs text-red-800 font-bold">{error}</p>
          )}

          <div className="bg-slate-200 rounded-xl p-4 overflow-x-auto">
            {!receipt ? (
              <div className="py-10 text-center"><Loader2 className="w-6 h-6 text-slate-400 mx-auto animate-spin" /></div>
            ) : (
              <div className="space-y-4">
                {COPY_LABELS.map((label) => (
                  /* هر نسخه در ابعاد واقعی چیده و برای نمایش کوچک می‌شود */
                  <div key={label} className="mx-auto relative overflow-hidden" style={{ width: '130mm', height: '92mm' }}>
                    <div className="preview-a5" style={{ position: 'absolute', top: 0, left: 0, transformOrigin: 'top left', transform: 'scale(0.62)' }}>
                      <DeliveryNoteA6 receipt={receipt} shipment={shipment} companyName={companyName} copyLabel={label} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/*
        ناحیه واقعی چاپ.

        با Portal مستقیم زیر <body> گذاشته می‌شود، نه داخل این پنجره.

        دلیلش: قاعده چاپ، همه فرزندان مستقیم body را پنهان می‌کند به‌جز این
        ناحیه. اگر این بخش داخل درخت معمولی می‌ماند، همراه با بقیه پنهان
        می‌شد و برگه کاملاً سفید از چاپگر بیرون می‌آمد.
      */}
      {receipt &&
        createPortal(
          <div className="print-root hidden print:block">
          <div className="print-sheet">
            {COPY_LABELS.map((label) => (
              <div key={label} className="print-cell">
                <DeliveryNoteA6
                  receipt={receipt}
                  shipment={shipment}
                  companyName={companyName}
                  copyLabel={label}
                />
              </div>
            ))}
          </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
