import type { NextFunction, Request, Response } from 'express';
import {
  readSessionToken,
  SESSION_COOKIE,
  type SessionPayload,
} from '../modules/auth/service.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionPayload;
    }
  }
}

/**
 * نشست کاربر را از کوکی می‌خواند و روی req می‌گذارد.
 * این میان‌افزار هیچ‌چیز را مسدود نمی‌کند؛ فقط هویت را تشخیص می‌دهد.
 * مسدودسازی کار authorize.ts است.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
  if (token) {
    const session = await readSessionToken(token);
    if (session) req.user = session;
  }
  next();
}
