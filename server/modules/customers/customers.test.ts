import { beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../../app.js';

let server: Server;
let baseUrl: string;
let adminCookie: string;

async function login(username: string) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: 'ard@1404' }),
  });
  return res.headers.get('set-cookie') ?? '';
}

function post(path: string, body: unknown, cookie: string) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validCustomer = () => ({
  code: `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  kind: 'INDIVIDUAL' as const,
  type: 'BAKERY' as const,
  name: 'نانوایی آزمایشی',
  nationalId: '0499370899',
  phone: '09123456789',
  creditLimit: 1_000_000_000,
  monthlyQuotaKg: 10_000,
});

beforeAll(async () => {
  process.env.JWT_SECRET ??= 'test-secret-at-least-16-chars';
  server = createApp().listen(0);
  const { port } = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${port}`;
  adminCookie = await login('admin');
  return () => server.close();
});

describe('مشتریان — اعتبارسنجی سمت سرور', () => {
  it('مشتری با اطلاعات درست ثبت می‌شود', async () => {
    const res = await post('/api/customers', validCustomer(), adminCookie);
    expect(res.status).toBe(201);
  });

  it('کد ملی با رقم کنترلی غلط را رد می‌کند', async () => {
    const res = await post(
      '/api/customers',
      { ...validCustomer(), nationalId: '0499370898' },
      adminCookie,
    );
    expect(res.status).toBe(400);

    const body = (await res.json()) as { error: { details?: { field: string }[] } };
    expect(body.error.details?.[0]?.field).toBe('nationalId');
  });

  it('برای شخص حقوقی، کد ملی ۱۰ رقمی را نمی‌پذیرد', async () => {
    const res = await post(
      '/api/customers',
      { ...validCustomer(), kind: 'COMPANY', nationalId: '0499370899' },
      adminCookie,
    );
    expect(res.status).toBe(400);
  });

  it('شناسه ملی معتبر شخص حقوقی را می‌پذیرد', async () => {
    const res = await post(
      '/api/customers',
      { ...validCustomer(), kind: 'COMPANY', nationalId: '10380284655' },
      adminCookie,
    );
    expect(res.status).toBe(201);
  });

  it('کد ملی با ارقام فارسی را می‌پذیرد و لاتین ذخیره می‌کند', async () => {
    const res = await post(
      '/api/customers',
      { ...validCustomer(), nationalId: '۰۴۹۹۳۷۰۸۹۹' },
      adminCookie,
    );
    expect(res.status).toBe(201);

    const body = (await res.json()) as { customer: { nationalId: string } };
    expect(body.customer.nationalId).toBe('0499370899');
  });

  it('شماره موبایل نامعتبر را رد می‌کند', async () => {
    const res = await post(
      '/api/customers',
      { ...validCustomer(), phone: '0912345' },
      adminCookie,
    );
    expect(res.status).toBe(400);
  });

  it('سقف اعتبار منفی را رد می‌کند', async () => {
    const res = await post(
      '/api/customers',
      { ...validCustomer(), creditLimit: -1 },
      adminCookie,
    );
    expect(res.status).toBe(400);
  });

  it('کد تکراری مشتری را رد می‌کند', async () => {
    const customer = validCustomer();
    expect((await post('/api/customers', customer, adminCookie)).status).toBe(201);
    expect((await post('/api/customers', customer, adminCookie)).status).toBe(409);
  });

  it('سقف اعتبار بزرگ‌تر از ۲.۱ میلیارد را درست ذخیره و برمی‌گرداند', async () => {
    // همان اشکالی که در فاز ۱ کشف شد
    const res = await post(
      '/api/customers',
      { ...validCustomer(), creditLimit: 20_000_000_000 },
      adminCookie,
    );
    expect(res.status).toBe(201);

    const body = (await res.json()) as { customer: { creditLimit: number } };
    expect(body.customer.creditLimit).toBe(20_000_000_000);
  });
});

describe('مشتریان — کنترل دسترسی', () => {
  it('انبار نمی‌تواند مشتری بسازد', async () => {
    const cookie = await login('warehouse');
    const res = await post('/api/customers', validCustomer(), cookie);
    expect(res.status).toBe(403);
  });

  it('گزارش‌گیر می‌تواند ببیند ولی نمی‌تواند بسازد', async () => {
    const cookie = await login('viewer');
    expect((await fetch(`${baseUrl}/api/customers`, { headers: { cookie } })).status).toBe(200);
    expect((await post('/api/customers', validCustomer(), cookie)).status).toBe(403);
  });

  it('فروش می‌تواند مشتری بسازد', async () => {
    const cookie = await login('sales');
    const res = await post('/api/customers', validCustomer(), cookie);
    expect(res.status).toBe(201);
  });
});

describe('محصولات', () => {
  it('محصول جدید همراه با رکورد موجودی ساخته می‌شود', async () => {
    const res = await post(
      '/api/products',
      {
        code: `P-${Date.now()}`,
        name: 'آرد آزمایشی',
        bagWeightKg: 40,
        basePricePerKg: 25_000,
        pricingCategory: 'FREE',
        vatPercent: 10,
      },
      adminCookie,
    );
    expect(res.status).toBe(201);

    const list = await fetch(`${baseUrl}/api/products`, { headers: { cookie: adminCookie } });
    const body = (await list.json()) as {
      products: { name: string; stock: unknown }[];
    };
    const created = body.products.find((p) => p.name === 'آرد آزمایشی');
    expect(created?.stock).not.toBeNull();
  });

  it('وزن کیسه صفر یا منفی را رد می‌کند', async () => {
    const res = await post(
      '/api/products',
      {
        code: `P-BAD-${Date.now()}`,
        name: 'نامعتبر',
        bagWeightKg: 0,
        basePricePerKg: 1000,
        pricingCategory: 'FREE',
        vatPercent: 10,
      },
      adminCookie,
    );
    expect(res.status).toBe(400);
  });

  it('فروش نمی‌تواند قیمت محصول را تغییر دهد', async () => {
    const cookie = await login('sales');
    const res = await fetch(`${baseUrl}/api/products/1`, {
      method: 'PATCH',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ basePricePerKg: 1 }),
    });
    expect(res.status).toBe(403);
  });
});
