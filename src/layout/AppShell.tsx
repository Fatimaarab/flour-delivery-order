import React from 'react';
import { LogOut, ChevronDown } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuth } from '../auth/AuthContext';
import { navItemsFor, ROLE_LABELS } from '../../shared/permissions';

interface AppShellProps {
  activeKey: string;
  onNavigate: (key: string) => void;
  children: React.ReactNode;
}

/**
 * پوسته مشترک همه صفحات.
 *
 * منو بر اساس نقش کاربر ساخته می‌شود؛ هر نقش فقط بخش‌های مجاز خودش را
 * می‌بیند. این کار برای سادگی کار پرسنل است — امنیت واقعی در سرور اعمال
 * می‌شود، نه با پنهان کردن دکمه.
 */
export const AppShell: React.FC<AppShellProps> = ({ activeKey, onNavigate, children }) => {
  const { user, logout } = useAuth();
  if (!user) return null;

  const items = navItemsFor(user.role);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col selection:bg-amber-200">
      <header className="no-print bg-slate-950 text-white border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <Logo size={34} framed />
            <div className="hidden sm:block">
              <h1 className="font-black text-sm text-white">شرکت آرد طلای سفید ماهان</h1>
              <p className="text-[10px] text-slate-400 font-medium">سامانه حواله تحویل آرد</p>
            </div>
          </div>

          <nav className="flex items-center gap-1 overflow-x-auto flex-1 justify-center">
            {items.map((item) => (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                  activeKey === item.key
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {/*
              نام کاربر همیشه دیده می‌شود، نه فقط روی نمایشگر بزرگ.
              در سامانه‌ای که هر اقدام به نام کاربر ثبت می‌شود، باید در هر
              لحظه روشن باشد که چه کسی وارد است.
            */}
            <div className="text-left">
              <div className="text-xs font-bold text-white leading-tight whitespace-nowrap">
                {user.fullName}
              </div>
              <div className="text-[10px] text-amber-400 font-bold">
                {ROLE_LABELS[user.role]}
              </div>
            </div>
            <button
              onClick={() => void logout()}
              title="خروج از سامانه"
              className="text-slate-400 hover:text-red-400 p-2 rounded-xl hover:bg-slate-800 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-3 sm:p-5 max-w-7xl mx-auto w-full">{children}</main>

      {/*
        مهر نسخه.

        به نظر تزئینی می‌آید، ولی نبودش یک‌بار واقعاً وقت تلف کرد: نسخه تازه
        روی پوشه قبلی کپی شده بود اما رابط کاربری همان قدیمی مانده بود، و از
        روی ظاهر صفحه هیچ راهی برای فهمیدنش نبود.
      */}
      <footer className="no-print text-center text-[10px] text-slate-400 font-bold py-2">
        نسخه {__APP_VERSION__} — ساخته‌شده در {__BUILD_STAMP__}
      </footer>
    </div>
  );
};

/** نمایش‌دهنده صفحه‌هایی که هنوز ساخته نشده‌اند. */
export const PlaceholderPage: React.FC<{ title: string; phase: string }> = ({
  title,
  phase,
}) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2 shadow-xs">
    <ChevronDown className="w-6 h-6 text-slate-300 mx-auto" />
    <h2 className="font-black text-slate-900 text-sm">{title}</h2>
    <p className="text-xs text-slate-500 font-bold">
      این بخش در {phase} ساخته می‌شود.
    </p>
  </div>
);
