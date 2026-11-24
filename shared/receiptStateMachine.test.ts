import { describe, expect, it } from 'vitest';
import {
  allowedTransitions,
  checkTransition,
  isExpired,
  hasPhysicallyShipped,
  isEditable,
  isTerminal,
  RECEIPT_STATUSES,
  transitionsFrom,
  type ReceiptStatus,
} from './receiptStateMachine.js';
import { ROLES, type Role } from './permissions.js';

describe('چرخه وضعیت حواله', () => {
  describe('صدور، آخرین مرحله است', () => {
    it('فروش پیش‌نویس را صادر می‌کند', () => {
      expect(checkTransition('DRAFT', 'ISSUED', 'SALES').allowed).toBe(true);
      expect(checkTransition('DRAFT', 'ISSUED', 'ADMIN').allowed).toBe(true);
    });

    it('از «صادر شده» فقط ابطال یا انقضا ممکن است', () => {
      expect(
        transitionsFrom('ISSUED').map((t) => t.to).sort(),
      ).toEqual(['CANCELLED', 'EXPIRED']);
    });

    it.each<ReceiptStatus>(['READY_FOR_LOADING', 'LOADED', 'DISPATCHED', 'CLOSED'])(
      'هیچ نقشی نمی‌تواند حواله صادرشده را به %s ببرد',
      (target) => {
        for (const role of ROLES) {
          expect(checkTransition('ISSUED', target, role).allowed).toBe(false);
        }
      },
    );
  });

  /*
   * مرحله «تأیید مالی» به درخواست کارفرما حذف شد. این بخش جای همان آزمون
   * قبلی را گرفته و دو چیز را تضمین می‌کند: حواله صادرشده مستقیم آماده
   * بارگیری می‌شود، و با این حال هیچ‌کس نمی‌تواند مرحله بارگیری را از قلم
   * بیندازد و بار را یک‌راست خارج کند.
   */
  describe('مسیر پس از حذف تأیید مالی', () => {
    it('هیچ نقشی دیگر نمی‌تواند حواله را «تأیید مالی» کند', () => {
      for (const role of ROLES) {
        expect(checkTransition('ISSUED', 'FINANCE_APPROVED', role).allowed).toBe(false);
      }
    });

    it('از «صادر شده» نمی‌توان مستقیم به «بارگیری‌شده» پرید', () => {
      for (const role of ROLES) {
        expect(checkTransition('ISSUED', 'LOADED', role).allowed).toBe(false);
      }
    });

    it('از «صادر شده» نمی‌توان مستقیم بار را خارج کرد', () => {
      for (const role of ROLES) {
        expect(checkTransition('ISSUED', 'DISPATCHED', role).allowed).toBe(false);
      }
    });

    // ⭐ حواله‌هایی که پیش از این تغییر در وضعیت تأیید مالی مانده‌اند نباید
    //    در بن‌بست گیر کنند
    it('حواله‌های قدیمیِ «تأیید مالی» همچنان راه خروج دارند', () => {
      expect(checkTransition('FINANCE_APPROVED', 'READY_FOR_LOADING', 'WAREHOUSE').allowed).toBe(
        true,
      );
      expect(checkTransition('FINANCE_APPROVED', 'CANCELLED', 'FINANCE').allowed).toBe(true);
    });
  });

  describe('تفکیک وظایف', () => {
    it('فروش نمی‌تواند حواله‌ای که قدیمی در انتظار بارگیری مانده را آماده بارگیری کند', () => {
      const check = checkTransition('FINANCE_APPROVED', 'READY_FOR_LOADING', 'SALES');
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('اجازه');
    });

    it('فروش نمی‌تواند حواله صادرشده را ابطال کند', () => {
      expect(checkTransition('ISSUED', 'CANCELLED', 'SALES').allowed).toBe(false);
    });

    it('گزارش‌گیر هیچ گذاری نمی‌تواند انجام دهد', () => {
      for (const status of RECEIPT_STATUSES) {
        expect(allowedTransitions(status, 'VIEWER')).toHaveLength(0);
      }
    });
  });

  describe('ابطال — طبق فرض ثبت‌شده', () => {
    it.each<ReceiptStatus>(['ISSUED', 'FINANCE_APPROVED', 'READY_FOR_LOADING'])(
      'مالی می‌تواند حواله در وضعیت %s را ابطال کند',
      (status) => {
        expect(checkTransition(status, 'CANCELLED', 'FINANCE').allowed).toBe(true);
      },
    );

    // پس از بارگیری، بار فیزیکاً جابه‌جا شده و ابطال یعنی انکار یک واقعه
    it.each<ReceiptStatus>(['LOADED', 'DISPATCHED', 'CLOSED'])(
      'پس از %s دیگر ابطال ممکن نیست',
      (status) => {
        for (const role of ROLES) {
          expect(checkTransition(status, 'CANCELLED', role).allowed).toBe(false);
        }
      },
    );

    it('ابطال همیشه نیازمند ثبت دلیل است', () => {
      for (const status of RECEIPT_STATUSES) {
        const t = transitionsFrom(status).find((x) => x.to === 'CANCELLED');
        // دور انداختن پیش‌نویس استثناست چون سند رسمی نیست
        if (t && status !== 'DRAFT') expect(t.requiresReason).toBe(true);
      }
    });
  });

  describe('مرجوعی — فقط پس از خروج بار', () => {
    it.each<ReceiptStatus>(['DISPATCHED', 'CLOSED'])(
      'از وضعیت %s مرجوعی ممکن است',
      (status) => {
        expect(checkTransition(status, 'RETURNED', 'FINANCE').allowed).toBe(true);
      },
    );

    it.each<ReceiptStatus>(['DRAFT', 'ISSUED', 'FINANCE_APPROVED', 'READY_FOR_LOADING'])(
      'پیش از خروج بار، مرجوعی از %s بی‌معناست',
      (status) => {
        for (const role of ROLES) {
          expect(checkTransition(status, 'RETURNED', role).allowed).toBe(false);
        }
      },
    );

    it('مرجوعی موجودی را به انبار برمی‌گرداند', () => {
      const t = transitionsFrom('DISPATCHED').find((x) => x.to === 'RETURNED');
      expect(t?.effect).toBe('RETURN');
    });
  });

  describe('اثر گذارها روی موجودی انبار', () => {
    it('صدور حواله به موجودی انبار دست نمی‌زند', () => {
      const t = transitionsFrom('DRAFT').find((x) => x.to === 'ISSUED');
      expect(t?.effect).toBeNull();
    });

    it('بارگیری، موجودی را واقعاً کسر می‌کند', () => {
      const t = transitionsFrom('READY_FOR_LOADING').find((x) => x.to === 'LOADED');
      expect(t?.effect).toBe('ISSUE');
    });

    it('ابطال و انقضای حواله صادرشده هم به موجودی دست نمی‌زنند', () => {
      expect(transitionsFrom('ISSUED').find((x) => x.to === 'CANCELLED')?.effect).toBeNull();
      expect(transitionsFrom('ISSUED').find((x) => x.to === 'EXPIRED')?.effect).toBeNull();
    });

    it('حواله‌های قدیمیِ رزروشده همچنان رزرو را آزاد می‌کنند', () => {
      for (const status of ['FINANCE_APPROVED', 'READY_FOR_LOADING'] as ReceiptStatus[]) {
        expect(transitionsFrom(status).find((x) => x.to === 'CANCELLED')?.effect)
          .toBe('RELEASE_RESERVE');
      }
    });

    it('دور انداختن پیش‌نویس اثری روی انبار ندارد (هنوز رزروی نشده)', () => {
      expect(transitionsFrom('DRAFT').find((x) => x.to === 'CANCELLED')?.effect).toBeNull();
    });
  });

  describe('وضعیت‌های پایانی', () => {
    it.each<ReceiptStatus>(['CANCELLED', 'RETURNED', 'EXPIRED'])(
      '%s هیچ راه خروجی ندارد',
      (status) => {
        expect(isTerminal(status)).toBe(true);
        for (const target of RECEIPT_STATUSES) {
          for (const role of ROLES) {
            expect(checkTransition(status, target, role).allowed).toBe(false);
          }
        }
      },
    );

    it('«بسته‌شده» پایانی نیست چون هنوز مرجوعی ممکن است', () => {
      expect(isTerminal('CLOSED')).toBe(false);
    });
  });

  describe('قفل ویرایش', () => {
    it('فقط پیش‌نویس قابل ویرایش است', () => {
      expect(isEditable('DRAFT')).toBe(true);
      for (const status of RECEIPT_STATUSES.filter((s) => s !== 'DRAFT')) {
        expect(isEditable(status)).toBe(false);
      }
    });
  });

  // ⭐ این قانون در PLAN نوشته شده بود ولی پیاده نشده بود؛ در تست پذیرش کشف شد
  describe('حواله منقضی', () => {
    const yesterday = () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d;
    };
    const nextWeek = () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d;
    };

    it('تا پایان روز اعتبار، حواله منقضی نیست', () => {
      expect(isExpired(new Date())).toBe(false);
      expect(isExpired(nextWeek())).toBe(false);
      expect(isExpired(yesterday())).toBe(true);
    });

    it('حواله بدون تاریخ اعتبار، منقضی حساب نمی‌شود', () => {
      expect(isExpired(null)).toBe(false);
      expect(isExpired(undefined)).toBe(false);
    });

    it.each<[ReceiptStatus, ReceiptStatus, Role]>([
      ['FINANCE_APPROVED', 'READY_FOR_LOADING', 'WAREHOUSE'],
      ['READY_FOR_LOADING', 'LOADED', 'WAREHOUSE'],
      ['LOADED', 'DISPATCHED', 'ADMIN'],
    ])('گذار %s → %s برای حواله منقضی مسدود است', (from, to, role) => {
      expect(checkTransition(from, to, role, nextWeek()).allowed).toBe(true);

      const check = checkTransition(from, to, role, yesterday());
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('تاریخ اعتبار');
    });

    it('حتی مدیر سیستم هم نمی‌تواند بار منقضی را تحویل دهد', () => {
      expect(
        checkTransition('FINANCE_APPROVED', 'READY_FOR_LOADING', 'ADMIN', yesterday()).allowed,
      ).toBe(false);
    });

    // بدون این، حواله منقضی در بن‌بست گیر می‌کرد
    it('ابطال و اعلام انقضا همیشه مجازند', () => {
      expect(checkTransition('ISSUED', 'CANCELLED', 'FINANCE', yesterday()).allowed).toBe(true);
      expect(checkTransition('ISSUED', 'EXPIRED', 'FINANCE', yesterday()).allowed).toBe(true);
    });

    it('در فهرست اقدام‌ها، گذارهای مسدود نمایش داده نمی‌شوند', () => {
      const fresh = allowedTransitions('FINANCE_APPROVED', 'WAREHOUSE', nextWeek());
      expect(fresh.some((t) => t.to === 'READY_FOR_LOADING')).toBe(true);

      const stale = allowedTransitions('FINANCE_APPROVED', 'WAREHOUSE', yesterday());
      expect(stale.some((t) => t.to === 'READY_FOR_LOADING')).toBe(false);
    });

    it('بدون دادن تاریخ اعتبار، رفتار مثل قبل می‌ماند', () => {
      expect(checkTransition('FINANCE_APPROVED', 'READY_FOR_LOADING', 'WAREHOUSE').allowed).toBe(true);
    });
  });

  describe('یکپارچگی خود جدول', () => {
    it('هیچ گذاری به وضعیت خودش وجود ندارد', () => {
      for (const status of RECEIPT_STATUSES) {
        expect(transitionsFrom(status).some((t) => t.to === status)).toBe(false);
      }
    });

    it('هیچ وضعیت مقصدی خارج از فهرست رسمی نیست', () => {
      for (const status of RECEIPT_STATUSES) {
        for (const t of transitionsFrom(status)) {
          expect(RECEIPT_STATUSES).toContain(t.to);
        }
      }
    });

    it('هر گذار یک متن اقدام فارسی دارد', () => {
      for (const status of RECEIPT_STATUSES) {
        for (const t of transitionsFrom(status)) {
          expect(t.action.trim().length).toBeGreaterThan(0);
        }
      }
    });

    it('هیچ وضعیت غیرپایانی بن‌بست نیست', () => {
      for (const status of RECEIPT_STATUSES) {
        if (!isTerminal(status)) {
          expect(transitionsFrom(status).length).toBeGreaterThan(0);
        }
      }
    });

    it('گذار تکراری در جدول وجود ندارد', () => {
      for (const status of RECEIPT_STATUSES) {
        const targets = transitionsFrom(status).map((t) => t.to);
        expect(new Set(targets).size).toBe(targets.length);
      }
    });
  });

  describe('تشخیص جابه‌جایی فیزیکی بار', () => {
    it.each<ReceiptStatus>(['LOADED', 'DISPATCHED', 'CLOSED'])('%s یعنی بار حرکت کرده', (s) => {
      expect(hasPhysicallyShipped(s)).toBe(true);
    });

    it.each<ReceiptStatus>(['DRAFT', 'ISSUED', 'FINANCE_APPROVED', 'READY_FOR_LOADING'])(
      '%s یعنی بار هنوز در کارخانه است',
      (s) => {
        expect(hasPhysicallyShipped(s)).toBe(false);
      },
    );
  });
});
