import type { NextFunction, Request, Response } from 'express';
import { can, type Permission } from '../../shared/permissions.js';
import { forbidden, unauthorized } from '../lib/errors.js';

/**
 * دروازه امنیتی واقعی سامانه.
 *
 * هر مسیری که داده حساس می‌خواند یا تغییر می‌دهد باید از این عبور کند.
 * پنهان کردن دکمه در مرورگر امنیت نیست — کسی که بخواهد می‌تواند مستقیماً
 * به سرور درخواست بفرستد. اینجا جایی است که واقعاً جلویش گرفته می‌شود.
 */
export function requirePermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());

    const allowed = permissions.every((p) => can(req.user!.role, p));
    if (!allowed) return next(forbidden());

    next();
  };
}

/** فقط بررسی می‌کند که کاربر وارد شده باشد، بدون اجازه خاص. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  next();
}
