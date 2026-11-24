import React, { useEffect, useState } from 'react';
import { UserPlus, Users as UsersIcon, KeyRound, Pencil, AlertCircle, Loader2, Check } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { ROLE_LABELS, ROLES, type Role } from '../../shared/permissions';

interface ManagedUser {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'هرگز';
  try {
    return new Date(iso).toLocaleString('fa-IR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
}

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('SALES');

  const load = async () => {
    try {
      const { users } = await api.get<{ users: ManagedUser[] }>('/users');
      setUsers(users);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'دریافت فهرست کاربران ناموفق بود.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      await api.post('/users', { username: username.trim(), fullName: fullName.trim(), password, role });
      setNotice(`کاربر «${fullName}» ساخته شد.`);
      setUsername('');
      setFullName('');
      setPassword('');
      setRole('SALES');
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ساخت کاربر ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (user: ManagedUser) => {
    setError(null);
    try {
      await api.patch(`/users/${user.id}`, { isActive: !user.isActive });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تغییر وضعیت کاربر ناموفق بود.');
    }
  };

  /**
   * نام افراد زیر امضای برگه حواله چاپ می‌شود، پس باید قابل اصلاح باشد.
   * بدون این، نامی که در داده اولیه آمده تا ابد روی اسناد رسمی می‌ماند.
   */
  const renameUser = async (user: ManagedUser) => {
    const next = prompt('نام و نام خانوادگی:', user.fullName);
    if (next === null) return;

    const trimmed = next.trim();
    if (!trimmed) {
      setError('نام و نام خانوادگی نمی‌تواند خالی باشد.');
      return;
    }
    if (trimmed === user.fullName) return;

    setError(null);
    try {
      await api.patch(`/users/${user.id}`, { fullName: trimmed });
      setNotice(`نام کاربر به «${trimmed}» تغییر کرد.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تغییر نام ناموفق بود.');
    }
  };

  const resetPassword = async (user: ManagedUser) => {
    const next = prompt(`رمز عبور تازه برای «${user.fullName}» (دست‌کم ۸ نویسه):`);
    if (!next) return;

    setError(null);
    try {
      await api.patch(`/users/${user.id}`, { password: next });
      setNotice(`رمز عبور «${user.fullName}» تغییر کرد.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تغییر رمز ناموفق بود.');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <Loader2 className="w-6 h-6 text-slate-300 mx-auto animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center">
            <UsersIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-bold">کاربران سامانه</div>
            <div className="text-xs font-black text-slate-900">
              {users.length.toLocaleString('fa-IR')} کاربر
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>{showForm ? 'انصراف' : 'کاربر جدید'}</span>
        </button>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-300 rounded-2xl p-3 flex items-center gap-2 text-xs text-red-800 font-bold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3 flex items-center gap-2 text-xs text-emerald-900 font-bold">
          <Check className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">نام کاربری</label>
            <input type="text" required dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-left focus:bg-white focus:outline-amber-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">نام و نام خانوادگی</label>
            <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:bg-white focus:outline-amber-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">رمز عبور</label>
            <input type="password" required minLength={8} dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-left focus:bg-white focus:outline-amber-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">نقش</label>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:bg-white focus:outline-amber-500 cursor-pointer">
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={busy}
            className="bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-black px-4 py-2 rounded-xl text-xs transition cursor-pointer">
            {busy ? 'در حال ثبت…' : 'ثبت کاربر'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">نام کاربری</th>
                <th className="py-3 px-3">نام و نام خانوادگی</th>
                <th className="py-3 px-3">نقش</th>
                <th className="py-3 px-3">آخرین ورود</th>
                <th className="py-3 px-3">وضعیت</th>
                <th className="py-3 px-4 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-amber-50/40 transition">
                  <td className="py-3 px-4 font-mono font-black text-slate-900" dir="ltr">
                    <span className="block text-right">{u.username}</span>
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900">{u.fullName}</td>
                  <td className="py-3 px-3">
                    <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-lg font-bold">
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600">{formatDate(u.lastLoginAt)}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded-full font-bold border ${
                      u.isActive
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : 'bg-slate-100 text-slate-500 border-slate-300'
                    }`}>
                      {u.isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => void renameUser(u)} title="ویرایش نام و نام خانوادگی"
                        className="text-slate-500 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => void resetPassword(u)} title="تعیین رمز تازه"
                        className="text-slate-500 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer">
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => void toggleActive(u)}
                        className="text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition cursor-pointer">
                        {u.isActive ? 'غیرفعال کن' : 'فعال کن'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
