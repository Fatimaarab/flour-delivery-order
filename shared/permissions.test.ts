import { describe, expect, it } from 'vitest';
import {
  can,
  navItemsFor,
  permissionsOf,
  PERMISSIONS,
  ROLES,
  type Permission,
  type Role,
} from './permissions.js';

describe('جدول اختیارات نقش‌ها', () => {
  it('مدیر سیستم به همه اختیارات دسترسی دارد', () => {
    for (const permission of PERMISSIONS) {
      expect(can('ADMIN', permission)).toBe(true);
    }
  });

  it('هر نقش دقیقاً اختیارات تعریف‌شده خودش را دارد و نه بیشتر', () => {
    for (const role of ROLES) {
      const granted = permissionsOf(role);
      for (const permission of PERMISSIONS) {
        expect(can(role, permission)).toBe(granted.includes(permission));
      }
    }
  });

  // این‌ها قوانین کسب‌وکاری‌اند که در صورت‌مسئله صریح آمده‌اند.
  describe('قوانین تفکیک وظایف', () => {
    it('فروش نمی‌تواند تایید مالی بدهد', () => {
      expect(can('SALES', 'finance:approve')).toBe(false);
      // ولی راننده حواله‌ای که خودش صادر کرده را ثبت می‌کند
      expect(can('SALES', 'driver:write')).toBe(true);
      expect(can('SALES', 'shipment:load')).toBe(false);
    });

    it('فروش نمی‌تواند پرداخت ثبت کند یا حواله را ابطال کند', () => {
      expect(can('SALES', 'payment:create')).toBe(false);
      expect(can('SALES', 'receipt:cancel')).toBe(false);
    });

    it('مالی نمی‌تواند حواله جدید صادر کند', () => {
      expect(can('FINANCE', 'receipt:create')).toBe(false);
      expect(can('FINANCE', 'receipt:issue')).toBe(false);
    });

    it('انبار نمی‌تواند به پول دست بزند', () => {
      expect(can('WAREHOUSE', 'payment:create')).toBe(false);
      expect(can('WAREHOUSE', 'finance:approve')).toBe(false);
    });

    it('گزارش‌گیر هیچ اجازه نوشتنی ندارد', () => {
      const writeLike = PERMISSIONS.filter(
        (p) => !p.endsWith(':read'),
      ) as Permission[];
      for (const permission of writeLike) {
        expect(can('VIEWER', permission)).toBe(false);
      }
    });

    it('فقط مدیر سیستم می‌تواند کاربران و تنظیمات را مدیریت کند', () => {
      const others = ROLES.filter((r) => r !== 'ADMIN') as Role[];
      for (const role of others) {
        expect(can(role, 'user:manage')).toBe(false);
        expect(can(role, 'settings:write')).toBe(false);
      }
    });
  });

  describe('منوی هر نقش', () => {
    it('نقش نگهبانی دیگر وجود ندارد', () => {
      expect(ROLES).not.toContain('GATE' as never);
    });

    it('فروش بخش کاربران را نمی‌بیند', () => {
      const keys = navItemsFor('SALES').map((i) => i.key);
      expect(keys).not.toContain('users');
      expect(keys).toContain('receipts');
    });

    it('مدیر سیستم همه بخش‌ها را می‌بیند', () => {
      expect(navItemsFor('ADMIN').map((i) => i.key)).toEqual([
        'receipts',
        'customers',
        'drivers',
        'products',
        'reports',
        'users',
      ]);
    });

    it('بخش‌های حذف‌شده در منوی هیچ نقشی نیستند', () => {
      // انبار، بارگیری، خروج بار و مالی از سامانه برداشته شده‌اند
      for (const role of ROLES) {
        const keys = navItemsFor(role).map((i) => i.key);
        for (const gone of ['inventory', 'loading', 'gate', 'payments']) {
          expect(keys, `${role} / ${gone}`).not.toContain(gone);
        }
      }
    });

    it('هیچ نقشی منوی کاملاً خالی ندارد', () => {
      for (const role of ROLES) {
        expect(navItemsFor(role).length).toBeGreaterThan(0);
      }
    });
  });
});
