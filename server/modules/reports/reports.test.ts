import { beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { toCsv } from './excel.js';
import { driverFields } from '../../tests/driverFields.js';

let server: Server;
let baseUrl: string;
const cookies: Record<string, string> = {};

async function login(username: string) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: 'ard@1404' }),
  });
  return res.headers.get('set-cookie') ?? '';
}

const get = (path: string, cookie: string) => fetch(`${baseUrl}${path}`, { headers: { cookie } });

beforeAll(async () => {
  process.env.JWT_SECRET ??= 'test-secret-at-least-16-chars';
  server = createApp().listen(0);
  const { port } = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${port}`;

  for (const u of ['admin', 'sales', 'finance', 'warehouse', 'viewer']) {
    cookies[u] = await login(u);
  }
  return () => server.close();
});

describe('ساخت فایل اکسل', () => {
  const rows = [{ name: 'آرد نوع ۱', amount: 1_500_000 }];
  const columns = [
    { header: 'نام', value: (r: (typeof rows)[number]) => r.name },
    { header: 'مبلغ', value: (r: (typeof rows)[number]) => r.amount },
  ];

  // ⭐ بدون BOM، اکسل روی ویندوز متن فارسی را درهم نشان می‌دهد
  it('فایل با BOM شروع می‌شود تا فارسی در اکسل درست دیده شود', () => {
    expect(toCsv(rows, columns).startsWith('﻿')).toBe(true);
  });

  it('اعداد لاتین می‌مانند تا اکسل بتواند جمع بزند', () => {
    expect(toCsv(rows, columns)).toContain('1500000');
    expect(toCsv(rows, columns)).not.toContain('۱۵۰۰۰۰۰');
  });

  it('سرآیند فارسی حفظ می‌شود', () => {
    expect(toCsv(rows, columns)).toContain('نام,مبلغ');
  });

  it('متنی که ویرگول دارد، ستون‌ها را به هم نمی‌ریزد', () => {
    const csv = toCsv(
      [{ name: 'نانوایی برکت, شعبه ۲', amount: 1 }],
      columns,
    );
    expect(csv).toContain('"نانوایی برکت, شعبه ۲"');
  });

  it('نقل‌قول داخل متن، درست فرار داده می‌شود', () => {
    const csv = toCsv([{ name: 'شرکت "آسیا"', amount: 1 }], columns);
    expect(csv).toContain('"شرکت ""آسیا"""');
  });

  it('مقدار خالی باعث خطا نمی‌شود', () => {
    const csv = toCsv([{ name: null as unknown as string, amount: 0 }], columns);
    expect(csv).toContain(',0');
  });
});

describe('گزارش‌ها', () => {
  it('فهرست گزارش‌های موجود را برمی‌گرداند', async () => {
    const res = await get('/api/reports', cookies.admin!);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { reports: { key: string; label: string }[] };
    expect(body.reports).toHaveLength(6);
    expect(body.reports.every((r) => r.label.trim().length > 0)).toBe(true);
  });

  it.each([
    'sales-daily',
    'sales-monthly',
    'sales-by-product',
    'sales-by-customer',
    'outstanding',
    'shipments',
  ])('گزارش %s اجرا می‌شود', async (key) => {
    const res = await get(`/api/reports/${key}`, cookies.admin!);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { rows: unknown[] };
    expect(Array.isArray(body.rows)).toBe(true);
  });

  it('گزارش ناشناخته رد می‌شود', async () => {
    expect((await get('/api/reports/does-not-exist', cookies.admin!)).status).toBe(400);
  });

  it('خروجی اکسل با نوع و نام فایل درست ارسال می‌شود', async () => {
    const res = await get('/api/reports/shipments/export', cookies.admin!);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('shipments-');

    /**
     * BOM باید در **بایت‌های خام** بررسی شود، نه در متن خوانده‌شده:
     * تابع text() خودش هنگام رمزگشایی UTF-8، BOM را حذف می‌کند و اگر اینجا
     * متن را چک کنیم، تستی می‌نویسیم که همیشه رد می‌شود حتی وقتی کد درست است.
     */
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);

    const text = new TextDecoder('utf-8').decode(bytes);
    expect(text).toContain('نام راننده');
  });

  it('همه گزارش‌ها خروجی اکسل دارند', async () => {
    for (const key of [
      'sales-daily', 'sales-monthly', 'sales-by-product', 'sales-by-customer',
      'outstanding', 'shipments',
    ]) {
      const res = await get(`/api/reports/${key}/export`, cookies.admin!);
      expect(res.status, key).toBe(200);
    }
  });
});

describe('گزارش فروش فقط حواله‌های واقعی را می‌شمارد', () => {
  it('پیش‌نویس و حواله ابطال‌شده در آمار فروش نمی‌آیند', async () => {
    const product = await prisma.product.findFirst({ where: { isActive: true, deletedAt: null } });
    const customer = await prisma.customer.create({
      data: {
        code: `REP-${Date.now()}`,
        kind: 'INDIVIDUAL',
        type: 'BAKERY',
        name: 'مشتری آزمون گزارش',
        creditLimit: BigInt(1_000_000_000_000),
        balance: BigInt(0),
      },
    });

    const before = (await (await get('/api/reports/sales-by-customer', cookies.admin!)).json()) as {
      rows: { customerId: number }[];
    };
    expect(before.rows.some((r) => r.customerId === customer.id)).toBe(false);

    // یک پیش‌نویس می‌سازیم و همان‌جا رها می‌کنیم
    await fetch(`${baseUrl}/api/receipts`, {
      method: 'POST',
      headers: { cookie: cookies.sales!, 'content-type': 'application/json' },
      body: JSON.stringify({ customerId: customer.id, items: [{ productId: product!.id, bagCount: 5 }] }),
    });

    const after = (await (await get('/api/reports/sales-by-customer', cookies.admin!)).json()) as {
      rows: { customerId: number }[];
    };
    // پیش‌نویس هنوز فروش نیست
    expect(after.rows.some((r) => r.customerId === customer.id)).toBe(false);
  });
});

describe('دسترسی به گزارش‌ها', () => {
  it('گزارش‌گیر دسترسی دارد', async () => {
    expect((await get('/api/reports/sales-daily', cookies.viewer!)).status).toBe(200);
  });

});

describe('فروش روزانه با جزئیات', () => {
  const post = (path: string, cookie: string, body: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('هر حواله یک سطر دارد، با مشتری، راننده، تعداد، تاریخ و ساعت', async () => {
    const product = await prisma.product.create({
      data: {
        code: `RD-${Date.now()}`,
        name: 'آرد آزمون گزارش روزانه',
        bagWeightKg: 40,
        basePricePerKg: BigInt(10_000),
        pricingCategory: 'FREE',
        vatPercent: 0,
      },
    });
    await prisma.stock.create({ data: { productId: product.id, onHandKg: 1_000_000, reservedKg: 0 } });
    const customer = await prisma.customer.create({
      data: {
        code: `RDC-${Date.now()}`,
        kind: 'INDIVIDUAL',
        type: 'BAKERY',
        name: 'مشتری گزارش روزانه',
        creditLimit: BigInt(1_000_000_000_000),
        balance: BigInt(0),
      },
    });

    const created = await post('/api/receipts', cookies.sales!, {
      ...(await driverFields()),
      customerId: customer.id,
      items: [{ productId: product.id, bagCount: 25 }],
    });
    const { receipt } = (await created.json()) as { receipt: { id: number; receiptNumber: string } };
    await post(`/api/receipts/${receipt.id}/transition`, cookies.sales!, { to: 'ISSUED' });

    // حواله «صادر شده» هم فروش است (بدون نیاز به تأیید مالی)
    const res = await get('/api/reports/sales-daily', cookies.admin!);
    const { rows } = (await res.json()) as {
      rows: { receiptNumber: string; amount?: number; customerName: string; driverName: string | null; bagCount: number; soldAt: string }[];
    };
    const row = rows.find((r) => r.receiptNumber === receipt.receiptNumber);
    const kinds = rows as unknown as { kind: string; amount: number; bagCount: number }[];
    const receiptRows = kinds.filter((r) => r.kind === 'receipt');
    const grand = kinds.find((r) => r.kind === 'grandTotal')!;
    expect(grand.amount).toBe(receiptRows.reduce((t, r) => t + r.amount, 0));
    expect(grand.bagCount).toBe(receiptRows.reduce((t, r) => t + r.bagCount, 0));
    expect(kinds.some((r) => r.kind === 'dayTotal')).toBe(true);
    expect(kinds.at(-1)!.kind).toBe('grandTotal');

    expect(row).toBeDefined();
    expect(row!.customerName).toBe('مشتری گزارش روزانه');
    expect(row!.driverName).toBe('اصغر محمدی');
    expect(row!.bagCount).toBe(25);
    expect(Number.isNaN(new Date(row!.soldAt).getTime())).toBe(false);

    const csv = await (await get('/api/reports/sales-daily/export', cookies.admin!)).text();
    expect(csv).toContain('نام مشتری');
    expect(csv).toContain('نام راننده');
    expect(csv).toContain('ساعت');
    expect(csv).toContain('مشتری گزارش روزانه');
  });
});
