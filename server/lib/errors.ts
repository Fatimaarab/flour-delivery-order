/**
 * خطاهای شناخته‌شده سامانه.
 *
 * هر خطایی که به کاربر نشان داده می‌شود باید پیام فارسی روشن داشته باشد.
 * خطاهای پیش‌بینی‌نشده هرگز با جزئیات فنی به کاربر نمی‌رسند (ریسک افشای
 * اطلاعات)، بلکه در لاگ سرور ثبت می‌شوند.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
    readonly code: string = 'BAD_REQUEST',
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (msg: string, details?: unknown) =>
  new AppError(msg, 400, 'BAD_REQUEST', details);

export const unauthorized = (msg = 'برای این کار باید وارد سامانه شوید.') =>
  new AppError(msg, 401, 'UNAUTHORIZED');

export const forbidden = (msg = 'شما اجازه انجام این کار را ندارید.') =>
  new AppError(msg, 403, 'FORBIDDEN');

export const notFound = (msg = 'موردی با این مشخصات پیدا نشد.') =>
  new AppError(msg, 404, 'NOT_FOUND');

export const conflict = (msg: string, details?: unknown) =>
  new AppError(msg, 409, 'CONFLICT', details);
