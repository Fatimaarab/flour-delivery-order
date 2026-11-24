import { beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';

let server: Server;
let baseUrl: string;
const cookies: Record<string, string> = {};
let customerId: number;
let productId: number;

async function login(username: string) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: 'ard@1404' }),
  });
  return res.headers.get('set-cookie') ?? '';
}

const req = (path: string, method: string, cookie: string, body?: unknown) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: { cookie, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const uniqueId = (() => {
  // کد ملی معتبر و یکتا برای هر اجرا: ۹ رقم + رقم کنترلی
  let n = Math.floor(Math.random() * 90_000_000) + 10_000_000;
  return () => {
    n += 1;
    const base = `0${n}`.slice(-9);
    const sum = base.split('').reduce((acc, d, i) => acc + Number(d) * (10 - i), 0) % 11;
    return base + String(sum < 2 ? sum : 11 - sum);
  };
})();

beforeAll(async () => {
  process.env.JWT_SECRET ??= 'test-secret-at-least-16-chars';
  server = createApp().listen(0);
  const { port } = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${port}`;
  for (const u of ['admin', 'sales', 'finance', 'warehouse', 'viewer']) {
    cookies[u] = await login(u);
  }

  const product = await prisma.product.create({
    data: {
      code: `DRV-${Date.now()}`,
      name: 'آرد آزمون راننده',
      bagWeightKg: 40,
      basePricePerKg: BigInt(10_000),
      pricingCategory: 'FREE',
      vatPercent: 0,
    },
  });
  await prisma.stock.create({ data: { productId: product.id, onHandKg: 1_000_000, reservedKg: 0 } });
  productId = product.id;
  const customer = await prisma.customer.create({
    data: {
      code: `DRVC-${Date.now()}`,
      kind: 'INDIVIDUAL',
      type: 'BAKERY',
      name: 'مشتری آزمون راننده',
      creditLimit: BigInt(1_000_000_000_000),
      balance: BigInt(0),
    },
  });
  customerId = customer.id;

  return () => server.close();
});

describe('تعریف راننده', () => {
  it('با نام و کد ملی ثبت می‌شود و کد ملی لاتین ذخیره می‌شود', async () => {
    const id = uniqueId();
    const faId = id.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);
    const res = await req('/api/drivers', 'POST', cookies.sales!, { fullName: 'علی رضایی', nationalId: faId });
    expect(res.status).toBe(201);
    const { driver } = (await res.json()) as { driver: { nationalId: string } };
    expect(driver.nationalId).toBe(id);
  });

  it('بدون کد ملی ثبت نمی‌شود', async () => {
    const res = await req('/api/drivers', 'POST', cookies.sales!, { fullName: 'بدون کد ملی' });
    expect(res.status).toBe(400);
    const res2 = await req('/api/drivers', 'POST', cookies.sales!, { fullName: 'کد خالی', nationalId: '  ' });
    expect(res2.status).toBe(400);
  });

  it('کد ملی با رقم کنترلی غلط رد می‌شود', async () => {
    const res = await req('/api/drivers', 'POST', cookies.sales!, { fullName: 'غلط', nationalId: '0499370898' });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { message: string } }).error.message).toContain('کد ملی');
  });

  it('بدون نام ثبت نمی‌شود', async () => {
    const res = await req('/api/drivers', 'POST', cookies.sales!, { fullName: '', nationalId: uniqueId() });
    expect(res.status).toBe(400);
  });

  it('کد ملی تکراری رد می‌شود و نام راننده قبلی گفته می‌شود', async () => {
    const id = uniqueId();
    await req('/api/drivers', 'POST', cookies.sales!, { fullName: 'راننده اول', nationalId: id });
    const res = await req('/api/drivers', 'POST', cookies.sales!, { fullName: 'راننده دوم', nationalId: id });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: { message: string } }).error.message).toContain('راننده اول');
  });

  it('موبایل و پلاک اگر پر شوند اعتبارسنجی می‌شوند', async () => {
    const bad = await req('/api/drivers', 'POST', cookies.sales!, { fullName: 'الف', nationalId: uniqueId(), mobile: '123' });
    expect(bad.status).toBe(400);
    const badPlate = await req('/api/drivers', 'POST', cookies.sales!, { fullName: 'بابک', nationalId: uniqueId(), plateNumber: 'abc' });
    expect(badPlate.status).toBe(400);
    const ok = await req('/api/drivers', 'POST', cookies.sales!, {
      fullName: 'جمشید', nationalId: uniqueId(), mobile: '۰۹۱۲۳۴۵۶۷۸۹', plateNumber: '۴۴ع۷۸۹-ایران۷۷',
    });
    expect(ok.status).toBe(201);
    const { driver } = (await ok.json()) as { driver: { mobile: string; plateNumber: string } };
    expect(driver.mobile).toBe('09123456789');
    expect(driver.plateNumber).toBe('44ع789ایران77');
  });

  it('گزارش‌گیر و مالی نمی‌توانند راننده تعریف کنند', async () => {
    for (const who of ['viewer', 'finance'] as const) {
      const res = await req('/api/drivers', 'POST', cookies[who]!, { fullName: 'ممنوع', nationalId: uniqueId() });
      expect(res.status, who).toBe(403);
    }
  });
});

describe('جستجوی راننده', () => {
  it('با نام و با کد ملی پیدا می‌شود و غیرفعال‌ها نمی‌آیند', async () => {
    const id = uniqueId();
    const created = await req('/api/drivers', 'POST', cookies.sales!, { fullName: 'جویبار سرچ‌پذیر', nationalId: id });
    const { driver } = (await created.json()) as { driver: { id: number } };

    const byName = (await (await req('/api/drivers?search=' + encodeURIComponent('جویبار'), 'GET', cookies.sales!)).json()) as { drivers: { id: number }[] };
    expect(byName.drivers.some((d) => d.id === driver.id)).toBe(true);

    const byId = (await (await req(`/api/drivers?search=${id}`, 'GET', cookies.warehouse!)).json()) as { drivers: { id: number }[] };
    expect(byId.drivers.map((d) => d.id)).toEqual([driver.id]);

    await req(`/api/drivers/${driver.id}`, 'PATCH', cookies.sales!, { fullName: 'جویبار سرچ‌پذیر', nationalId: id, isActive: false });
    const after = (await (await req(`/api/drivers?search=${id}`, 'GET', cookies.sales!)).json()) as { drivers: unknown[] };
    expect(after.drivers).toHaveLength(0);
  });
});

describe('انتخاب راننده در حواله', () => {
  const body = (extra: Record<string, unknown>) => ({
    customerId,
    items: [{ productId, bagCount: 10 }],
    ...extra,
  });

  async function newDriver() {
    const res = await req('/api/drivers', 'POST', cookies.sales!, {
      fullName: 'راننده انتخابی', nationalId: uniqueId(), mobile: '09121112233', plateNumber: '12ب345ایران10',
    });
    return ((await res.json()) as { driver: { id: number; nationalId: string } }).driver;
  }

  it('بدون راننده، حواله ثبت نمی‌شود', async () => {
    const res = await req('/api/receipts', 'POST', cookies.sales!, body({ haulType: 'SELF' }));
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain('راننده');
  });

  it('بدون نوع حمل، حواله ثبت نمی‌شود', async () => {
    const driver = await newDriver();
    const res = await req('/api/receipts', 'POST', cookies.sales!, body({ driverId: driver.id }));
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain('حمل');
  });

  it('راننده ناموجود یا غیرفعال پذیرفته نمی‌شود', async () => {
    const missing = await req('/api/receipts', 'POST', cookies.sales!, body({ driverId: 999_999, haulType: 'SELF' }));
    expect(missing.status).toBe(400);

    const driver = await newDriver();
    await req(`/api/drivers/${driver.id}`, 'PATCH', cookies.sales!, { fullName: 'راننده انتخابی', nationalId: driver.nationalId, isActive: false });
    const inactive = await req('/api/receipts', 'POST', cookies.sales!, body({ driverId: driver.id, haulType: 'SELF' }));
    expect(inactive.status).toBe(400);
  });

  it('مشخصات راننده روی حواله کپی می‌شود و با ویرایش بعدی راننده عوض نمی‌شود', async () => {
    const driver = await newDriver();
    const created = await req('/api/receipts', 'POST', cookies.sales!, body({ driverId: driver.id, haulType: 'COMPANY', carrierCompany: 'باربری آسیا' }));
    expect(created.status).toBe(201);
    const { receipt } = (await created.json()) as { receipt: { id: number } };
    expect((await req(`/api/receipts/${receipt.id}/transition`, 'POST', cookies.sales!, { to: 'ISSUED' })).status).toBe(200);

    await req(`/api/drivers/${driver.id}`, 'PATCH', cookies.sales!, {
      fullName: 'نام عوض‌شده', nationalId: driver.nationalId, plateNumber: '99ص999ایران99',
    });

    const shipment = await prisma.shipment.findUnique({ where: { receiptId: receipt.id } });
    expect(shipment!.driverName).toBe('راننده انتخابی');
    expect(shipment!.plateNumber).toBe('12ب345ایران10');
    expect(shipment!.driverNationalId).toBe(driver.nationalId);
    expect(shipment!.carrierCompany).toBe('باربری آسیا');
    expect(shipment!.driverId).toBe(driver.id);
  });

  it('خود حمل، نام شرکت حمل را ذخیره نمی‌کند', async () => {
    const driver = await newDriver();
    const created = await req('/api/receipts', 'POST', cookies.sales!, body({ driverId: driver.id, haulType: 'SELF', carrierCompany: 'نباید بماند' }));
    const { receipt } = (await created.json()) as { receipt: { id: number } };
    const shipment = await prisma.shipment.findUnique({ where: { receiptId: receipt.id } });
    expect(shipment!.carrierCompany).toBeNull();
  });

  it('در ویرایش پیش‌نویس هم می‌شود راننده را عوض کرد', async () => {
    const a = await newDriver();
    const b = await newDriver();
    const created = await req('/api/receipts', 'POST', cookies.sales!, body({ driverId: a.id, haulType: 'SELF' }));
    const { receipt } = (await created.json()) as { receipt: { id: number } };

    const patched = await req(`/api/receipts/${receipt.id}`, 'PATCH', cookies.sales!, body({ driverId: b.id, haulType: 'SELF' }));
    expect(patched.status).toBe(200);
    const shipment = await prisma.shipment.findUnique({ where: { receiptId: receipt.id } });
    expect(shipment!.driverId).toBe(b.id);

    // و ویرایش بدون راننده رد می‌شود
    expect((await req(`/api/receipts/${receipt.id}`, 'PATCH', cookies.sales!, body({ haulType: 'SELF' }))).status).toBe(400);
  });
});
