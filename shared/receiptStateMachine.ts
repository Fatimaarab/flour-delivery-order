/**
 * جدول متمرکز قوانین چرخه وضعیت حواله.
 *
 * این فایل تنها مرجع تعیین «از هر وضعیت، به کدام وضعیت‌ها و توسط چه کسی
 * می‌توان رفت» است. هر تغییر وضعیت در سامانه اجباراً از اینجا عبور می‌کند؛
 * بنابراین از نظر فنی **ممکن نیست** حواله‌ای از مسیری غیر از همین جدول جلو
 * برود، حتی اگر کسی بخواهد و مستقیماً به سرور درخواست بفرستد.
 *
 * اگر فردا قانون کسب‌وکار عوض شد، فقط همین جدول اصلاح می‌شود.
 */

import { can, type Permission, type Role } from './permissions.js';

export const RECEIPT_STATUSES = [
  'DRAFT',
  'ISSUED',
  'FINANCE_APPROVED',
  'READY_FOR_LOADING',
  'LOADED',
  'DISPATCHED',
  'CLOSED',
  'CANCELLED',
  'RETURNED',
  'EXPIRED',
] as const;

export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];

export const STATUS_LABELS: Record<ReceiptStatus, string> = {
  DRAFT: 'پیش‌نویس',
  ISSUED: 'صادر شده',
  // مرحله حذف‌شده؛ فقط روی حواله‌های پیش از تغییر دیده می‌شود
  FINANCE_APPROVED: 'تأیید مالی (قدیمی)',
  READY_FOR_LOADING: 'آماده بارگیری',
  LOADED: 'بارگیری‌شده',
  DISPATCHED: 'خارج شده',
  CLOSED: 'بسته‌شده',
  CANCELLED: 'ابطال‌شده',
  RETURNED: 'مرجوعی',
  EXPIRED: 'منقضی',
};

/** اثر هر گذار روی موجودی انبار. */
export type StockEffect =
  | 'RESERVE' // رزرو (فقط حواله‌های قدیمی)
  | 'RELEASE_RESERVE' // آزادسازی رزرو (ابطال یا انقضا)
  | 'ISSUE' // کسر واقعی هنگام بارگیری
  | 'RETURN' // بازگشت به انبار
  | null;

export interface Transition {
  to: ReceiptStatus;
  /** اجازه لازم برای این گذار */
  permission: Permission;
  /** متن دکمه‌ای که کاربر می‌بیند */
  action: string;
  /** آیا ثبت دلیل اجباری است؟ */
  requiresReason?: boolean;
  /**
   * آیا این گذار برای حواله‌ای که تاریخ اعتبارش گذشته مسدود است؟
   *
   * گذارهایی که بار را به سمت تحویل می‌برند مسدود می‌شوند؛ اما ابطال و
   * اعلام انقضا همیشه مجازند — وگرنه حواله منقضی در بن‌بست گیر می‌کند.
   */
  blockedWhenExpired?: boolean;
  effect: StockEffect;
}

const TRANSITIONS: Record<ReceiptStatus, readonly Transition[]> = {
  // پیش‌نویس هنوز سند رسمی نیست و آزادانه قابل ویرایش یا دور انداختن است
  DRAFT: [
    { to: 'ISSUED', permission: 'receipt:issue', action: 'صدور نهایی حواله', effect: null },
    {
      to: 'CANCELLED',
      permission: 'receipt:create',
      action: 'دور انداختن پیش‌نویس',
      effect: null,
    },
  ],

  /*
   * «صادر شده» آخرین مرحله است. مراحل آماده‌سازی بارگیری، بارگیری و خروج از
   * گیت به درخواست کارفرما حذف شده‌اند: این سامانه برگه حواله را پس از
   * بارگیری صادر می‌کند و ثبت می‌کند.
   *
   * صدور و ابطال به موجودی انبار دست نمی‌زنند. موجودی در جای دیگری (خارج از
   * این سامانه) نگه داشته می‌شود، و اگر صدور به موجودی وابسته بود، سامانه‌ای
   * که تازه نصب شده و موجودی‌اش صفر است، هیچ حواله‌ای صادر نمی‌کرد. تنها
   * کار ممکن پس از صدور، ابطال یا اعلام انقضاست.
   */
  ISSUED: [
    {
      to: 'CANCELLED',
      permission: 'receipt:cancel',
      action: 'ابطال حواله',
      requiresReason: true,
      effect: null,
    },
    {
      to: 'EXPIRED',
      permission: 'receipt:expire',
      action: 'اعلام انقضا',
      requiresReason: true,
      effect: null,
    },
  ],

  /*
   * وضعیت قدیمی. مرحله تأیید مالی حذف شده و هیچ حواله تازه‌ای دیگر به اینجا
   * نمی‌رسد، اما حواله‌هایی که پیش از این تغییر در این وضعیت مانده‌اند باید
   * راه خروج داشته باشند — وگرنه در بن‌بست گیر می‌کنند.
   */
  FINANCE_APPROVED: [
    {
      to: 'READY_FOR_LOADING',
      permission: 'shipment:load',
      action: 'آماده‌سازی بارگیری',
      blockedWhenExpired: true,
      effect: null,
    },
    {
      to: 'CANCELLED',
      permission: 'receipt:cancel',
      action: 'ابطال حواله',
      requiresReason: true,
      effect: 'RELEASE_RESERVE',
    },
    {
      to: 'EXPIRED',
      permission: 'receipt:expire',
      action: 'اعلام انقضا',
      requiresReason: true,
      effect: 'RELEASE_RESERVE',
    },
  ],

  READY_FOR_LOADING: [
    {
      to: 'LOADED',
      permission: 'shipment:load',
      action: 'ثبت بارگیری',
      blockedWhenExpired: true,
      effect: 'ISSUE',
    },
    {
      to: 'CANCELLED',
      permission: 'receipt:cancel',
      action: 'ابطال حواله',
      requiresReason: true,
      effect: 'RELEASE_RESERVE',
    },
  ],

  // بار فیزیکاً بارگیری شده؛ از اینجا ابطال معنا ندارد، فقط مرجوعی
  LOADED: [
    {
      to: 'DISPATCHED',
      permission: 'gate:dispatch',
      action: 'تأیید خروج بار',
      blockedWhenExpired: true,
      effect: null,
    },
  ],

  DISPATCHED: [
    { to: 'CLOSED', permission: 'finance:approve', action: 'بستن پرونده حواله', effect: null },
    {
      to: 'RETURNED',
      permission: 'receipt:return',
      action: 'ثبت مرجوعی',
      requiresReason: true,
      effect: 'RETURN',
    },
  ],

  CLOSED: [
    {
      to: 'RETURNED',
      permission: 'receipt:return',
      action: 'ثبت مرجوعی',
      requiresReason: true,
      effect: 'RETURN',
    },
  ],

  // وضعیت‌های پایانی — هیچ راه خروجی ندارند
  CANCELLED: [],
  RETURNED: [],
  EXPIRED: [],
};

export function isTerminal(status: ReceiptStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/**
 * آیا محتوای حواله (اقلام، مشتری، مبالغ) قابل ویرایش است؟
 *
 * قانون سخت‌گیرانه: فقط پیش‌نویس. پس از «صادر شده» سند رسمی است و تنها راه
 * اصلاح، ابطال و صدور اصلاحیه است.
 */
export function isEditable(status: ReceiptStatus): boolean {
  return status === 'DRAFT';
}

export interface TransitionCheck {
  allowed: boolean;
  /** دلیل فارسی رد شدن — برای نمایش مستقیم به کاربر */
  reason?: string;
  transition?: Transition;
}

/** آیا این گذار مجاز است؟ هم قانون وضعیت و هم اجازه نقش بررسی می‌شود. */
export function checkTransition(
  from: ReceiptStatus,
  to: ReceiptStatus,
  role: Role,
  /** تاریخ اعتبار حواله — اگر داده شود، گذارهای رو به جلو پس از آن مسدودند */
  validUntil?: Date | null,
): TransitionCheck {
  if (from === to) {
    return { allowed: false, reason: 'حواله از قبل در همین وضعیت است.' };
  }

  if (isTerminal(from)) {
    return {
      allowed: false,
      reason: `حواله «${STATUS_LABELS[from]}» است و وضعیتش دیگر تغییر نمی‌کند.`,
    };
  }

  const transition = TRANSITIONS[from].find((t) => t.to === to);
  if (!transition) {
    return {
      allowed: false,
      reason: `رفتن از «${STATUS_LABELS[from]}» به «${STATUS_LABELS[to]}» مجاز نیست.`,
    };
  }

  if (!can(role, transition.permission)) {
    return {
      allowed: false,
      reason: `شما اجازه «${transition.action}» را ندارید.`,
      transition,
    };
  }

  if (transition.blockedWhenExpired && isExpired(validUntil)) {
    return {
      allowed: false,
      reason:
        'تاریخ اعتبار این حواله گذشته است و بار آن تحویل نمی‌شود. ' +
        'مالی باید ابطالش کند و در صورت نیاز حواله تازه صادر شود.',
      transition,
    };
  }

  return { allowed: true, transition };
}

/** گذارهایی که این نقش، از این وضعیت می‌تواند انجام دهد — برای ساخت دکمه‌ها. */
export function allowedTransitions(
  from: ReceiptStatus,
  role: Role,
  validUntil?: Date | null,
): readonly Transition[] {
  const expired = isExpired(validUntil);
  return TRANSITIONS[from].filter(
    (t) => can(role, t.permission) && !(t.blockedWhenExpired && expired),
  );
}

/** آیا تاریخ اعتبار گذشته است؟ مقایسه بر مبنای روز است، نه ساعت. */
export function isExpired(validUntil?: Date | string | null): boolean {
  if (!validUntil) return false;

  const end = new Date(validUntil);
  if (Number.isNaN(end.getTime())) return false;

  // تا پایان روز اعتبار، حواله معتبر است
  end.setHours(23, 59, 59, 999);
  return Date.now() > end.getTime();
}

/** همه گذارهای ممکن از یک وضعیت، صرف‌نظر از نقش. */
export function transitionsFrom(from: ReceiptStatus): readonly Transition[] {
  return TRANSITIONS[from];
}

/** آیا حواله در این وضعیت، بار فیزیکی‌اش جابه‌جا شده است؟ */
export function hasPhysicallyShipped(status: ReceiptStatus): boolean {
  return status === 'LOADED' || status === 'DISPATCHED' || status === 'CLOSED';
}
