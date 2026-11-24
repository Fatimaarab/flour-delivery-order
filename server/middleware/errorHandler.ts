import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';

/** پوشش خطاهای async تا نیازی به try/catch در هر مسیر نباشد. */
export function asyncRoute<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req as T, res, next).catch(next);
  };
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'اطلاعات ارسالی معتبر نیست.',
        details: err.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      },
    });
    return;
  }

  // خطای پیش‌بینی‌نشده: جزئیات فقط در لاگ سرور، نه در پاسخ به کاربر
  console.error('[unhandled]', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'خطای غیرمنتظره‌ای در سرور رخ داد. با پشتیبانی تماس بگیرید.',
    },
  });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'این آدرس در سامانه وجود ندارد.' },
  });
}
