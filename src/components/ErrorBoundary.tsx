import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

/**
 * تور ایمنی کل برنامه.
 *
 * ── چرا لازم است ─────────────────────────────────────────────────────────
 * اگر یک بخش کوچک از صفحه خطا بدهد، React به‌صورت پیش‌فرض **کل صفحه را سفید
 * می‌کند** — بدون هیچ پیامی. کاربر فقط یک صفحه خالی می‌بیند و نمی‌داند چه
 * شده یا چه کار کند.
 *
 * با این تور، خطا گرفته می‌شود و یک پیام قابل فهم با راه خروج نمایش داده
 * می‌شود. جزئیات فنی هم برای پشتیبانی نگه داشته می‌شود.
 * ─────────────────────────────────────────────────────────────────────────
 */
interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // در کنسول مرورگر می‌ماند تا پشتیبانی بتواند ببیند
    console.error('[خطای غیرمنتظره در رابط کاربری]', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border-2 border-red-300 shadow-xs p-6 max-w-lg w-full space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-black text-slate-900 text-sm">
                خطای غیرمنتظره‌ای رخ داد
              </h1>
              <p className="text-[11px] text-slate-500 font-bold">
                این صفحه به‌درستی بارگذاری نشد
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 font-bold leading-relaxed space-y-1">
            <p>۱. دکمه زیر را بزنید تا صفحه دوباره بارگذاری شود.</p>
            <p>۲. اگر باز هم تکرار شد، به مدیر سامانه اطلاع دهید.</p>
            <p className="text-slate-500 font-medium">
              نگران داده‌های ثبت‌شده نباشید؛ هر چیزی که قبلاً ذخیره شده سالم است.
            </p>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full bg-slate-900 hover:bg-slate-800 text-amber-400 font-black py-3 rounded-xl text-sm transition cursor-pointer flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>بارگذاری دوباره صفحه</span>
          </button>

          {/* جزئیات فنی — برای پشتیبانی، نه کاربر عادی */}
          <details className="text-[11px] text-slate-500">
            <summary className="cursor-pointer font-bold hover:text-slate-700">
              جزئیات فنی (برای پشتیبانی)
            </summary>
            <pre className="mt-2 bg-slate-900 text-slate-200 rounded-lg p-2.5 overflow-x-auto text-[10px] whitespace-pre-wrap" dir="ltr">
              {error.message}
              {error.stack ? `\n\n${error.stack.split('\n').slice(0, 6).join('\n')}` : ''}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
