import React, { useCallback, useEffect, useState } from 'react';
import { MessageSquareText, Send, Loader2, Check, Clock, AlertCircle } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { formatJalaliDateTime } from '../lib/jalali';
import { toPersianDigits } from '../../shared/digits';

/**
 * پیامک‌های یک حواله: سابقه، و دکمه ارسال دستی.
 *
 * ارسال اصلی **خودکار** است (هنگام صدور نهایی، و هنگام ثبت راننده روی حواله
 * صادرشده). این کادر دو کار می‌کند: نشان می‌دهد چه چیزی برای چه کسی رفته و
 * به کجا رسیده، و اجازه می‌دهد پیامک دوباره فرستاده شود.
 *
 * اگر پیامک در تنظیمات خاموش باشد، این کادر اصلاً دیده نمی‌شود.
 */
interface SmsRow {
  id: number;
  recipient: string;
  recipientKind: 'DRIVER' | 'MANAGER';
  event: string;
  text: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  attempts: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
}

const KIND_LABELS = { DRIVER: 'راننده', MANAGER: 'مدیر کارخانه' } as const;

const STATUS = {
  SENT: { label: 'ارسال شد', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300', Icon: Check },
  PENDING: { label: 'در صف ارسال', cls: 'bg-amber-100 text-amber-900 border-amber-300', Icon: Clock },
  FAILED: { label: 'ناموفق', cls: 'bg-red-100 text-red-900 border-red-300', Icon: AlertCircle },
} as const;

export const ReceiptSmsPanel: React.FC<{
  receiptId: number;
  /** پیش‌نویس سند رسمی نیست و پیامکی ندارد */
  isDraft: boolean;
  canSend: boolean;
  /** با عوض شدن این مقدار، سابقه دوباره خوانده می‌شود */
  reloadToken: string;
}> = ({ receiptId, isDraft, canSend, reloadToken }) => {
  const [enabled, setEnabled] = useState(false);
  const [rows, setRows] = useState<SmsRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ enabled: boolean; messages: SmsRow[] }>(
        `/sms/receipts/${receiptId}`,
      );
      setEnabled(data.enabled);
      setRows(data.messages);
    } catch {
      // نبودن سابقه پیامک نباید صفحه حواله را خراب کند
      setEnabled(false);
    }
  }, [receiptId]);

  useEffect(() => {
    void load();
    // ارسال خودکار در پس‌زمینه انجام می‌شود؛ کمی بعد دوباره نگاه می‌کنیم تا
    // «در صف» به «ارسال شد» تبدیل شود بدون اینکه کاربر صفحه را تازه کند.
    const timer = setTimeout(() => void load(), 2500);
    return () => clearTimeout(timer);
  }, [load, reloadToken]);

  const send = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api.post<{ messages: SmsRow[] }>(`/sms/receipts/${receiptId}/send`);
      setRows(data.messages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ارسال پیامک ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };

  if (!enabled) return null;

  return (
    <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/60">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
          <MessageSquareText className="w-4 h-4 text-indigo-700" />
          <span>پیامک‌ها</span>
        </h4>
        {canSend && !isDraft && (
          <button onClick={() => void send()} disabled={busy}
            className="bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-black px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>{rows.length > 0 ? 'ارسال دوباره پیامک' : 'ارسال پیامک'}</span>
          </button>
        )}
      </div>

      {error && (
        <p className="bg-red-50 border border-red-300 rounded-xl p-2.5 text-[11px] text-red-800 font-bold flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-[11px] text-slate-500 font-bold">
          {isDraft
            ? 'پس از صدور نهایی، پیامک خودکار برای راننده و مدیر کارخانه فرستاده می‌شود.'
            : 'هنوز پیامکی برای این حواله فرستاده نشده است.'}
        </p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((m) => {
            const st = STATUS[m.status];
            return (
              <div key={m.id} className="bg-white border border-slate-200 rounded-lg">
                <button type="button" onClick={() => setOpenId(openId === m.id ? null : m.id)}
                  className="w-full flex flex-wrap items-center gap-x-2 gap-y-1 px-2.5 py-1.5 text-[11px] text-right cursor-pointer">
                  <span className={`inline-flex items-center gap-1 border rounded-full px-2 py-0.5 font-bold ${st.cls}`}>
                    <st.Icon className="w-3 h-3" />
                    {st.label}
                  </span>
                  <span className="font-black text-slate-900">{KIND_LABELS[m.recipientKind]}</span>
                  <span className="font-mono text-slate-600" dir="ltr">{toPersianDigits(m.recipient)}</span>
                  <span className="text-slate-400 font-mono mr-auto">{formatJalaliDateTime(m.sentAt ?? m.createdAt)}</span>
                </button>
                {openId === m.id && (
                  <div className="px-2.5 pb-2 space-y-1">
                    <p className="whitespace-pre-line text-[11px] text-slate-700 bg-slate-50 rounded p-2 leading-relaxed">{m.text}</p>
                    {m.lastError && (
                      <p className="text-[10px] text-red-700 font-bold">
                        آخرین خطا (تلاش {toPersianDigits(m.attempts)}): {m.lastError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
