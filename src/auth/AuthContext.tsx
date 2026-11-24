import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, ApiError, setSessionExpiredHandler } from '../lib/api';
import type { Permission, Role } from '../../shared/permissions';

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: Role;
}

interface SessionResponse {
  user: AuthUser;
  permissions: Permission[];
}

interface AuthState {
  user: AuthUser | null;
  permissions: Permission[];
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** true اگر کاربر به‌خاطر پایان نشست بیرون آمده باشد، نه با زدن دکمه خروج */
  sessionExpired: boolean;
  /**
   * فقط برای ساده کردن رابط کاربری است، نه امنیت.
   * تصمیم نهایی همیشه در سرور گرفته می‌شود.
   */
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expiredNotice, setExpiredNotice] = useState(false);

  // بازیابی نشست هنگام باز شدن صفحه (کوکی ممکن است هنوز معتبر باشد)
  useEffect(() => {
    let cancelled = false;
    api
      .get<SessionResponse>('/auth/me')
      .then((s) => {
        if (cancelled) return;
        setUser(s.user);
        setPermissions(s.permissions);
      })
      .catch((err) => {
        // ۴۰۱ یعنی «هنوز وارد نشده» — این خطا نیست، حالت عادی است
        if (!(err instanceof ApiError) || err.status !== 401) {
          console.error('بازیابی نشست ناموفق بود:', err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * اگر نشست وسط کار منقضی شود، کاربر به صفحه ورود برمی‌گردد و دلیلش را
   * می‌بیند — نه اینکه با خطاهای نامفهوم گیر کند.
   */
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setPermissions([]);
      setExpiredNotice(true);
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const s = await api.post<SessionResponse>('/auth/login', { username, password });
    setUser(s.user);
    setPermissions(s.permissions);
    setExpiredNotice(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
      setPermissions([]);
    }
  }, []);

  const can = useCallback(
    (permission: Permission) => permissions.includes(permission),
    [permissions],
  );

  return (
    <AuthContext.Provider
      value={{ user, permissions, loading, login, logout, can, sessionExpired: expiredNotice }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth باید داخل AuthProvider استفاده شود.');
  return ctx;
}
