import { beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { driverFields } from './driverFields.js';

/**
 * آزمون چرخه کامل کسب‌وکار.
 *
 * این تست، یک حواله را از لحظه صدور تا خروج بار و بسته شدن پرونده دنبال
 * می‌کند و در **هر مرحله** بررسی می‌کند که موجودی انبار، حساب مشتری و
 * سوابق، همگی با هم سازگار مانده‌اند.
 *
 * ارزشش این است که خطاهایی را می‌گیرد که تست‌های جداگانه هر بخش نمی‌گیرند:
 * جایی که دو بخشِ هرکدام درست، با هم ناسازگار می‌شوند.
 */

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

function req(path: string, method: string, cookie: string, body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { cookie, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeAll(async () => {
  process.env.JWT_SECRET ??= 'test-secret-at-least-16-chars';
  server = createApp().listen(0);
  const { port } = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${port}`;

  for (const u of ['admin', 'sales', 'finance', 'warehouse']) {
    cookies[u] = await login(u);
  }
  return () => server.close();
});

describe('چرخه کامل: از صدور تا بسته شدن پرونده', () => {
  it('در هر مرحله، انبار و حساب مشتری با هم سازگار می‌مانند', async () => {
    // ── آماده‌سازی ──────────────────────────────────────────────
    const product = await prisma.product.create({
      data: {
        code: `E2E-${Date.now()}`,
        name: 'آرد آزمون چرخه کامل',
        bagWeightKg: 40,
        basePricePerKg: BigInt(20_000),
        pricingCategory: 'FREE',
        vatPercent: 10,
      },
    });
    await prisma.stock.create({
      data: { productId: product.id, onHandKg: 100_000, reservedKg: 0 },
    });

    const customer = await prisma.customer.create({
      data: {
        code: `E2EC-${Date.now()}`,
        kind: 'INDIVIDUAL',
        type: 'BAKERY',
        name: 'نانوایی آزمون چرخه',
        creditLimit: BigInt(10_000_000_000),
        balance: BigInt(0),
      },
    });

    const stock = async () => {
      const s = await prisma.stock.findUnique({ where: { productId: product.id } });
      return { onHand: s!.onHandKg, reserved: s!.reservedKg };
    };
    const balance = async () =>
      Number((await prisma.customer.findUnique({ where: { id: customer.id } }))!.balance);

    // ── ۱. فروش: صدور پیش‌نویس ─────────────────────────────────
    const created = await req('/api/receipts', 'POST', cookies.sales!, {
      ...(await driverFields()),
      customerId: customer.id,
      items: [{ productId: product.id, bagCount: 500 }], // ۲۰ تن
    });
    expect(created.status).toBe(201);
    const { receipt } = (await created.json()) as {
      receipt: { id: number; receiptNumber: string; grandTotal: number; totalWeightKg: number };
    };

    // ۲۰ تن × ۲۰٬۰۰۰ ریال = ۴۰۰ میلیون + ۱۰٪ مالیات
    expect(receipt.totalWeightKg).toBe(20_000);
    expect(receipt.grandTotal).toBe(440_000_000);

    // پیش‌نویس هنوز هیچ اثری ندارد
    expect(await stock()).toEqual({ onHand: 100_000, reserved: 0 });
    expect(await balance()).toBe(0);

    // ── ۲. فروش: صدور نهایی — آخرین مرحله ──────────────────────
    expect((await req(`/api/receipts/${receipt.id}/transition`, 'POST', cookies.sales!, { to: 'ISSUED' })).status).toBe(200);
    // صدور به موجودی انبار دست نمی‌زند
    expect(await stock()).toEqual({ onHand: 100_000, reserved: 0 });
    expect(await balance()).toBe(-440_000_000);

    // راننده با حواله ثبت شده و روی آن نشسته است
    const shipment = await prisma.shipment.findUnique({ where: { receiptId: receipt.id } });
    expect(shipment!.driverName).toBe('اصغر محمدی');
    expect(shipment!.driverNationalId).toBe('0499370899');

    // از اینجا سند رسمی است و ویرایش نمی‌شود
    expect((await req(`/api/receipts/${receipt.id}`, 'PATCH', cookies.sales!, {
      ...(await driverFields()),
      customerId: customer.id,
      items: [{ productId: product.id, bagCount: 1 }],
    })).status).toBe(409);

    // مراحل بارگیری و خروج دیگر وجود ندارند
    for (const to of ['READY_FOR_LOADING', 'LOADED', 'DISPATCHED']) {
      expect((await req(`/api/receipts/${receipt.id}/transition`, 'POST', cookies.admin!, { to })).status, to).toBe(409);
    }

    // ── ۳. مالی: پرداخت‌ها و تسویه ─────────────────────────────
    expect((await req('/api/payments', 'POST', cookies.finance!, {
      customerId: customer.id,
      receiptId: receipt.id,
      amount: 200_000_000,
      method: 'BANK_TRANSFER',
      referenceNumber: '998877',
    })).status).toBe(201);
    expect(await balance()).toBe(-240_000_000);

    expect((await req('/api/payments', 'POST', cookies.finance!, {
      customerId: customer.id,
      receiptId: receipt.id,
      amount: 240_000_000,
      method: 'CASH',
    })).status).toBe(201);
    expect(await balance()).toBe(0); // حساب تسویه شد

    // ── بررسی نهایی سوابق ──────────────────────────────────────
    const logs = await prisma.receiptStatusLog.findMany({
      where: { receiptId: receipt.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(logs.map((l) => l.toStatus)).toEqual(['ISSUED']);
    expect(logs.every((l) => l.userId > 0 && l.ipAddress)).toBe(true);

    // حواله در گزارش فروش دیده می‌شود
    const report = await req('/api/reports/sales-by-customer', 'GET', cookies.admin!);
    const { rows } = (await report.json()) as { rows: { customerId: number; amount: number }[] };
    const row = rows.find((r) => r.customerId === customer.id);
    expect(row?.amount).toBe(440_000_000);
  });
});

describe('تضمین‌های سراسری', () => {
  it('شماره سریال حتی در صدور همزمان هم تکراری نمی‌شود', async () => {
    const product = await prisma.product.findFirst({ where: { isActive: true, deletedAt: null } });
    const customer = await prisma.customer.findFirst({ where: { isActive: true, deletedAt: null } });

    // ده حواله دقیقاً همزمان صادر می‌شوند
    const results = await Promise.all(
      Array.from({ length: 10 }, async () =>
        req('/api/receipts', 'POST', cookies.sales!, {
      ...(await driverFields()),
          customerId: customer!.id,
          items: [{ productId: product!.id, bagCount: 1 }],
        }),
      ),
    );

    const numbers = await Promise.all(
      results.map(async (r) => ((await r.json()) as { receipt: { receiptNumber: string } }).receipt.receiptNumber),
    );

    expect(new Set(numbers).size).toBe(10);
  });

  it('هیچ داده مالی‌ای فیزیکی حذف نمی‌شود', async () => {
    const customer = await prisma.customer.findFirst({ where: { isActive: true, deletedAt: null } });

    const created = await req('/api/payments', 'POST', cookies.finance!, {
      customerId: customer!.id,
      amount: 5_000,
      method: 'CASH',
    });
    const { payment } = (await created.json()) as { payment: { id: number } };

    await req(`/api/payments/${payment.id}/void`, 'POST', cookies.finance!, { reason: 'آزمون' });

    const row = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(row).not.toBeNull();
    expect(row!.deletedAt).not.toBeNull();

    // و در دفتر وقایع هم ردش هست
    const log = await prisma.auditLog.findFirst({
      where: { entityType: 'Payment', entityId: payment.id, action: 'VOID' },
    });
    expect(log).not.toBeNull();
  });

  it('هر عملیات حساس ردی در دفتر وقایع می‌گذارد', async () => {
    const before = await prisma.auditLog.count();

    const product = await prisma.product.findFirst({ where: { isActive: true, deletedAt: null } });
    const customer = await prisma.customer.findFirst({ where: { isActive: true, deletedAt: null } });

    const created = await req('/api/receipts', 'POST', cookies.sales!, {
      ...(await driverFields()),
      customerId: customer!.id,
      items: [{ productId: product!.id, bagCount: 2 }],
    });
    const { receipt } = (await created.json()) as { receipt: { id: number } };
    await req(`/api/receipts/${receipt.id}/transition`, 'POST', cookies.sales!, { to: 'ISSUED' });

    // دست‌کم دو رویداد: ساخت حواله و تغییر وضعیت
    expect(await prisma.auditLog.count()).toBeGreaterThanOrEqual(before + 2);
  });

  it('موجودی انبار هرگز منفی نمی‌شود و رزرو از موجودی جلو نمی‌زند', async () => {
    const rows = await prisma.stock.findMany();
    for (const s of rows) {
      expect(s.onHandKg).toBeGreaterThanOrEqual(0);
      expect(s.reservedKg).toBeGreaterThanOrEqual(0);
      expect(s.onHandKg).toBeGreaterThanOrEqual(s.reservedKg);
    }
  });

  it('مبلغ پرداخت‌شده هیچ حواله‌ای از مبلغ کلش بیشتر نیست', async () => {
    const receipts = await prisma.receipt.findMany({
      where: { deletedAt: null },
      select: { receiptNumber: true, grandTotal: true, paidAmount: true },
    });
    for (const r of receipts) {
      expect(Number(r.paidAmount), r.receiptNumber).toBeLessThanOrEqual(Number(r.grandTotal));
    }
  });
});
