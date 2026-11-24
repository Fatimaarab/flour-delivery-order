import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import type { Role } from '../../../shared/permissions.js';

const SESSION_HOURS = 12; // یک شیفت کاری
export const SESSION_COOKIE = 'ard_session';

/**
 * رمز عبور هرگز به‌صورت خام ذخیره نمی‌شود. bcrypt با salt خودکار کار می‌کند،
 * بنابراین دو کاربر با رمز یکسان هم hash متفاوت دارند و حتی مدیر سیستم هم
 * نمی‌تواند رمز کسی را ببیند — فقط می‌تواند رمز تازه تعیین کند.
 */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'متغیر JWT_SECRET تنظیم نشده یا خیلی کوتاه است. سرور بدون آن نباید اجرا شود.',
    );
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userId: number;
  username: string;
  role: Role;
  fullName: string;
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey());
}

export async function readSessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const { userId, username, role, fullName } = payload as unknown as SessionPayload;
    if (typeof userId !== 'number' || typeof role !== 'string') return null;
    return { userId, username, role, fullName };
  } catch {
    // توکن منقضی، دستکاری‌شده یا نامعتبر — در هر صورت یعنی «وارد نشده»
    return null;
  }
}

/**
 * تنظیمات کوکی نشست.
 *
 * `secure` فقط در محیط production روشن می‌شود، چون سامانه روی شبکه داخلی
 * کارخانه و احتمالاً با http سرو می‌شود و کوکی secure روی http اصلاً ارسال
 * نمی‌گردد. اگر روی سرور از https استفاده کردید، NODE_ENV=production کافی است.
 */
export const sessionCookieOptions = {
  httpOnly: true, // جلوی خواندن کوکی با جاوااسکریپت را می‌گیرد (ضد XSS)
  sameSite: 'lax' as const, // ضد CSRF
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_HOURS * 60 * 60 * 1000,
  path: '/',
};
