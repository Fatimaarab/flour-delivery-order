/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { UsersPage } from './pages/UsersPage';
import { ReceiptsDbPage } from './pages/ReceiptsDbPage';
import { ProductsPage } from './pages/ProductsPage';
import { CustomersPage } from './pages/CustomersPage';
import { DriversPage } from './pages/DriversPage';
import { ReportsPage } from './pages/ReportsPage';
import { AppShell, PlaceholderPage } from './layout/AppShell';
import { navItemsFor } from '../shared/permissions';

/** صفحاتی که هنوز ساخته نشده‌اند و در کدام فاز می‌آیند. */
const UPCOMING: Record<string, { title: string; phase: string }> = {
};

const Routes: React.FC = () => {
  const { user, loading } = useAuth();
  const [page, setPage] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center space-y-2">
          <Loader2 className="w-6 h-6 text-slate-400 mx-auto animate-spin" />
          <p className="text-xs text-slate-500 font-bold">در حال بررسی نشست…</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  // صفحه پیش‌فرض، اولین بخشی است که نقش کاربر اجازه دیدنش را دارد.
  // برای نگهبانی این یعنی مستقیم رفتن سراغ کار خودش، نه صفحه‌ای که نمی‌بیند.
  const allowed = navItemsFor(user.role);
  const active = page ?? allowed[0]?.key ?? 'receipts';

  const upcoming = UPCOMING[active];

  return (
    <AppShell activeKey={active} onNavigate={setPage}>
      {active === 'receipts' ? (
        <ReceiptsDbPage />
      ) : active === 'users' ? (
        <UsersPage />
      ) : active === 'products' ? (
        <ProductsPage />
      ) : active === 'customers' ? (
        <CustomersPage />
      ) : active === 'drivers' ? (
        <DriversPage />
      ) : active === 'reports' ? (
        <ReportsPage />
      ) : upcoming ? (
        <PlaceholderPage title={upcoming.title} phase={upcoming.phase} />
      ) : (
        <PlaceholderPage title="این بخش" phase="فازهای بعدی" />
      )}
    </AppShell>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  );
}
