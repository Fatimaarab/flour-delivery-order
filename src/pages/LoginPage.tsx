import React, { useState } from 'react';
import { LogIn, AlertCircle, Loader2 } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../lib/api';

export const LoginPage: React.FC = () => {
  const { login, sessionExpired } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return; // جلوگیری از ارسال دوباره با دوبار کلیک

    setError(null);
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'ورود ناموفق بود. دوباره تلاش کنید.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Logo size={92} framed className="mb-3" />
          <h1 className="font-black text-lg text-slate-900">
            شرکت آرد طلای سفید ماهان
          </h1>
          <p className="text-xs text-slate-500 font-bold mt-1">
            سامانه صدور حواله تحویل آرد
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4"
        >
          <div>
            <label htmlFor="username" className="block text-xs font-bold text-slate-700 mb-1">
              نام کاربری
            </label>
            <input
              id="username"
              type="text"
              required
              autoFocus
              autoComplete="username"
              dir="ltr"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-left focus:bg-white focus:outline-amber-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-bold text-slate-700 mb-1">
              رمز عبور
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-left focus:bg-white focus:outline-amber-500"
            />
          </div>

          {sessionExpired && !error && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 flex items-center gap-2 text-xs text-amber-900 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>مدت نشست شما تمام شد. لطفاً دوباره وارد شوید.</span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="bg-red-50 border border-red-300 rounded-xl p-2.5 flex items-center gap-2 text-xs text-red-800 font-bold"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-black py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>در حال ورود…</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>ورود به سامانه</span>
              </>
            )}
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-400 mt-4">
          در صورت فراموشی رمز عبور، با مدیر سامانه تماس بگیرید.
        </p>
        {/* مهر نسخه — توضیحش در AppShell است */}
        <p className="text-center text-[10px] text-slate-300 font-bold mt-1">
          نسخه {__APP_VERSION__} — ساخته‌شده در {__BUILD_STAMP__}
        </p>
      </div>
    </div>
  );
};
