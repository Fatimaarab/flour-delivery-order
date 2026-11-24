/**
 * جدول متمرکز اختیارات نقش‌ها.
 *
 * این فایل تنها مرجع تعیین «چه کسی اجازه چه کاری دارد» است و هم سرور و هم
 * مرورگر از همین استفاده می‌کنند. دلیل متمرکز بودنش این است که اگر فردا
 * اختیارات یک نقش عوض شود، فقط همین جدول اصلاح می‌شود — نه ده جای پراکنده.
 *
 * ⚠️ نکته امنیتی: نمایش یا پنهان‌کردن دکمه در مرورگر «امنیت» نیست؛ فقط برای
 * سادگی کار کاربر است. امنیت واقعی از بررسی همین جدول در سرور می‌آید.
 */

export const ROLES = [
  'ADMIN',
  'SALES',
  'FINANCE',
  'WAREHOUSE',
  'VIEWER',
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'مدیر سیستم',
  SALES: 'فروش',
  FINANCE: 'مالی / صندوق',
  WAREHOUSE: 'انبار',
  VIEWER: 'گزارش‌گیر',
};

export const PERMISSIONS = [
  // مشتریان
  'customer:read',
  'customer:write',
  // محصولات
  'product:read',
  'product:write',
  // حواله
  'receipt:read',
  'receipt:create', // ساخت پیش‌نویس
  'receipt:issue', // صدور نهایی (پس از آن غیرقابل ویرایش)
  'receipt:cancel', // ابطال
  'receipt:return', // مرجوعی
  'receipt:expire', // اعلام انقضا
  // مالی
  'finance:approve', // تایید مالی — دروازه ورود به بارگیری
  'payment:read',
  'payment:create',
  'payment:void',
  // انبار
  'inventory:read',
  'inventory:produce', // ثبت تولید روزانه
  'inventory:adjust', // اصلاح دستی موجودی
  // رانندگان — تعریف در بخش مستقل «رانندگان»، انتخاب در حواله
  'driver:read',
  'driver:write',
  // بارگیری (فقط برای حواله‌های قدیمی که پیش از حذف این مراحل ساخته شده‌اند)
  'shipment:load',
  'shipment:weigh', // ثبت باسکول
  'shipment:approve_variance', // تایید مغایرت وزنی
  // خروج
  'gate:dispatch', // تایید نهایی خروج
  // گزارش و مدیریت
  'report:read',
  'user:manage',
  'audit:read',
  'settings:write',
  // ارسال دستی پیامک حواله (ارسال خودکار به اجازه نیاز ندارد)
  'sms:send',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** اختیارات هر نقش. ADMIN جداگانه و به‌صورت «همه» مدیریت می‌شود. */
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: PERMISSIONS,

  // فروش: مشتری و حواله می‌سازد، اما هرگز به تایید مالی دست نمی‌زند
  SALES: [
    'customer:read',
    'customer:write',
    'product:read',
    'receipt:read',
    'receipt:create',
    'receipt:issue',
    // فروش حواله را می‌سازد، پس باید راننده را انتخاب و در صورت نبودن تعریف کند
    'driver:read',
    'driver:write',
    'sms:send',
    'inventory:read',
    'report:read',
  ],

  // مالی: پول، ابطال و مرجوعی — اما حواله جدید صادر نمی‌کند
  FINANCE: [
    'customer:read',
    'product:read',
    'receipt:read',
    'receipt:cancel',
    'receipt:return',
    'receipt:expire',
    'finance:approve',
    'payment:read',
    'payment:create',
    'payment:void',
    'report:read',
    'audit:read',
  ],

  // انبار: موجودی و بارگیری
  WAREHOUSE: [
    'product:read',
    'receipt:read',
    'inventory:read',
    'inventory:produce',
    'inventory:adjust',
    'driver:read',
    'shipment:load',
    'shipment:weigh',
    'shipment:approve_variance',
    'report:read',
  ],

  // گزارش‌گیر: فقط خواندن
  VIEWER: [
    'customer:read',
    'product:read',
    'receipt:read',
    'payment:read',
    'inventory:read',
    'report:read',
  ],
};

/** آیا این نقش اجازه این کار را دارد؟ */
export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** آیا این نقش دست‌کم یکی از این اجازه‌ها را دارد؟ */
export function canAny(role: Role, permissions: readonly Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}

export function permissionsOf(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/** بخش‌های منو و اجازه لازم برای دیدن هرکدام. */
/**
 * بخش‌هایی که در منوی بالای سامانه دیده می‌شوند.
 *
 * ── چرا «انبار»، «بارگیری»، «خروج بار» و «مالی» اینجا نیستند ─────────────
 * کار روزمره کارخانه صدور حواله و چاپ آن است. آن چهار بخش یک چرخه کامل
 * انبارداری و حسابداری بودند که در عمل استفاده نمی‌شدند و فقط منو را شلوغ
 * می‌کردند.
 *
 * داده و APIشان حذف نشده — گزارش‌ها همچنان از همان جدول‌ها می‌خوانند و
 * مشخصات راننده حالا داخل خود حواله ثبت می‌شود. اگر روزی لازم شد، برگرداندن
 * یک سطر به این فهرست کافی است.
 * ────────────────────────────────────────────────────────────────────────
 */
export const NAV_ITEMS = [
  { key: 'receipts', label: 'حواله‌ها', permission: 'receipt:read' },
  { key: 'customers', label: 'مشتریان', permission: 'customer:read' },
  { key: 'drivers', label: 'رانندگان', permission: 'driver:read' },
  { key: 'products', label: 'محصولات', permission: 'product:read' },
  { key: 'reports', label: 'گزارش‌ها', permission: 'report:read' },
  { key: 'users', label: 'کاربران', permission: 'user:manage' },
] as const satisfies readonly { key: string; label: string; permission: Permission }[];

export function navItemsFor(role: Role) {
  return NAV_ITEMS.filter((item) => can(role, item.permission));
}
