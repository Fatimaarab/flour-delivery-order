import { beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../../app.js';

/**
 * تست‌های امنیتی لایه احراز هویت و دسترسی.
 *
 * این تست‌ها به دیتابیس واقعی توسعه وصل می‌شوند و فرض می‌کنند `npm run db:seed`
 * اجرا شده است.
 */

let server: Server;
let baseUrl: string;

beforeAll(() => {
  process.env.JWT_SECRET ??= 'test-secret-at-least-16-chars';
  server = createApp().listen(0);
  const { port } = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${port}`;
  return () => server.close();
});

async function login(username: string, password = 'ard@1404') {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return { res, cookie: res.headers.get('set-cookie') ?? '' };
}

describe('ورود به سامانه', () => {
  it('با نام کاربری و رمز درست، نشست می‌سازد', async () => {
    const { res, cookie } = await login('admin');
    expect(res.status).toBe(200);
    expect(cookie).toContain('ard_session=');

    const body = (await res.json()) as {
      user: { username: string; role: string };
      permissions: string[];
    };
    expect(body.user.username).toBe('admin');
    expect(body.user.role).toBe('ADMIN');
    expect(body.permissions).toContain('user:manage');
  });

  it('کوکی نشست با httpOnly محافظت می‌شود', async () => {
    const { cookie } = await login('admin');
    expect(cookie.toLowerCase()).toContain('httponly');
    expect(cookie.toLowerCase()).toContain('samesite=lax');
  });

  it('با رمز اشتباه وارد نمی‌شود', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong-password' }),
    });
    expect(res.status).toBe(401);
  });

  it('پیام خطای کاربر ناموجود و رمز غلط یکسان است (تا نام کاربری لو نرود)', async () => {
    const missing = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ghost-user', password: 'x'.repeat(10) }),
    });
    const wrongPass = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'x'.repeat(10) }),
    });

    expect(missing.status).toBe(wrongPass.status);
    const a = (await missing.json()) as { error: { message: string } };
    const b = (await wrongPass.json()) as { error: { message: string } };
    expect(a.error.message).toBe(b.error.message);
  });

  it('رمز عبور هرگز در پاسخ برنمی‌گردد', async () => {
    const { res } = await login('admin');
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain('passwordHash');
    expect(text).not.toContain('ard@1404');
  });
});

describe('کنترل دسترسی سمت سرور', () => {
  it('بدون ورود، به مسیرهای محافظت‌شده اجازه نمی‌دهد', async () => {
    const res = await fetch(`${baseUrl}/api/users`);
    expect(res.status).toBe(401);
  });

  it('با نشست جعلی اجازه نمی‌دهد', async () => {
    const res = await fetch(`${baseUrl}/api/users`, {
      headers: { cookie: 'ard_session=not-a-real-token' },
    });
    expect(res.status).toBe(401);
  });

  // ⭐ مهم‌ترین تست این فاز: نقش‌های دیگر نباید بتوانند کاربر بسازند،
  // حتی اگر مستقیماً به سرور درخواست بفرستند و رابط کاربری را دور بزنند.
  it.each([
    ['sales', 'فروش'],
    ['finance', 'مالی'],
    ['warehouse', 'انبار'],
    ['viewer', 'گزارش‌گیر'],
  ])('نقش %s نمی‌تواند به مدیریت کاربران دسترسی پیدا کند', async (username) => {
    const { cookie } = await login(username);
    const res = await fetch(`${baseUrl}/api/users`, { headers: { cookie } });
    expect(res.status).toBe(403);
  });

  it('مدیر سیستم به مدیریت کاربران دسترسی دارد', async () => {
    const { cookie } = await login('admin');
    const res = await fetch(`${baseUrl}/api/users`, { headers: { cookie } });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { users: { username: string }[] };
    expect(body.users.length).toBeGreaterThanOrEqual(5);
  });

  it('فهرست کاربران هرگز hash رمز را فاش نمی‌کند', async () => {
    const { cookie } = await login('admin');
    const res = await fetch(`${baseUrl}/api/users`, { headers: { cookie } });
    expect(JSON.stringify(await res.json())).not.toContain('passwordHash');
  });

  it('کاربر وارد شده می‌تواند مشخصات خودش را بخواند', async () => {
    const { cookie } = await login('sales');
    const res = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { permissions: string[] };
    expect(body.permissions).toContain('receipt:issue');
    expect(body.permissions).not.toContain('user:manage');
  });
});

describe('محافظت از آخرین مدیر سامانه', () => {
  it('مدیر نمی‌تواند نقش خودش را عوض کند', async () => {
    const { cookie, res: loginRes } = await login('admin');
    const { user } = (await loginRes.json()) as { user: { id: number } };

    const res = await fetch(`${baseUrl}/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'VIEWER' }),
    });
    expect(res.status).toBe(400);
  });

  it('مدیر نمی‌تواند حساب خودش را غیرفعال کند', async () => {
    const { cookie, res: loginRes } = await login('admin');
    const { user } = (await loginRes.json()) as { user: { id: number } };

    const res = await fetch(`${baseUrl}/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    });
    expect(res.status).toBe(400);
  });
});
