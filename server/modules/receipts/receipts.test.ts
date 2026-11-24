import { beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { driverFields } from '../../tests/driverFields.js';

let server: Server;
let baseUrl: string;
const cookies: Record<string, string> = {};
let customerId: number;
let freeProductId: number;
let subsidisedProductId: number;

async function login(username: string) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: 'ard@1404' }),
  });
  return res.headers.get('set-cookie') ?? '';
}

function req(path: string, method: string, cookie: string, body?: unknown, headers: Record<string, string> = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { cookie, 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function makeDraft(cookie = cookies.sales!, bagCount = 10, productId = freeProductId) {
  const res = await req('/api/receipts', 'POST', cookie, {
      ...(await driverFields()),
    customerId,
    items: [{ productId, bagCount }],
  });
  const body = (await res.json()) as { receipt: { id: number; receiptNumber: string } };
  return body.receipt;
}

function move(id: number, to: string, cookie: string, reason?: string) {
  return req(`/api/receipts/${id}/transition`, 'POST', cookie, { to, reason });
}

beforeAll(async () => {
  process.env.JWT_SECRET ??= 'test-secret-at-least-16-chars';
  server = createApp().listen(0);
  const { port } = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${port}`;

  for (const u of ['admin', 'sales', 'finance', 'warehouse', 'viewer']) {
    cookies[u] = await login(u);
  }

  const customer = await prisma.customer.findFirst({ where: { deletedAt: null, isActive: true } });
  customerId = customer!.id;

  const free = await prisma.product.findFirst({ where: { pricingCategory: 'FREE', isActive: true } });
  const sub = await prisma.product.findFirst({ where: { pricingCategory: 'SUBSIDISED', isActive: true } });
  freeProductId = free!.id;
  subsidisedProductId = sub!.id;

  return () => server.close();
});

describe('صدور حواله', () => {
  it('پیش‌نویس با شماره سریال یکتا ساخته می‌شود', async () => {
    const a = await makeDraft();
    const b = await makeDraft();
    expect(a.receiptNumber).not.toBe(b.receiptNumber);
    expect(a.receiptNumber).toMatch(/^\d{4}-\d{4}$/);
  });

  it('شماره سریال پیوسته و افزایشی است', async () => {
    const a = await makeDraft();
    const b = await makeDraft();
    const seq = (n: string) => Number(n.split('-')[1]);
    expect(seq(b.receiptNumber)).toBe(seq(a.receiptNumber) + 1);
  });

  it('مبالغ در سرور حساب می‌شوند و قیمت ارسالی مرورگر مبنا نیست', async () => {
    const product = await prisma.product.findUnique({ where: { id: freeProductId } });
    const res = await req('/api/receipts', 'POST', cookies.sales!, {
      ...(await driverFields()),
      customerId,
      items: [{ productId: freeProductId, bagCount: 10 }],
    });
    const body = (await res.json()) as {
      receipt: { subtotal: number; vatAmount: number; grandTotal: number; totalWeightKg: number };
    };

    const weight = 10 * product!.bagWeightKg;
    const expectedSub = weight * Number(product!.basePricePerKg);
    expect(body.receipt.totalWeightKg).toBe(weight);
    expect(body.receipt.subtotal).toBe(expectedSub);
    expect(body.receipt.vatAmount).toBe(Math.round((expectedSub * product!.vatPercent) / 100));
    expect(body.receipt.grandTotal).toBe(expectedSub + body.receipt.vatAmount);
  });

  it('آرد یارانه‌ای بدون مالیات صادر می‌شود', async () => {
    const res = await req('/api/receipts', 'POST', cookies.sales!, {
      ...(await driverFields()),
      customerId,
      items: [{ productId: subsidisedProductId, bagCount: 10 }],
    });
    const body = (await res.json()) as { receipt: { vatAmount: number } };
    expect(body.receipt.vatAmount).toBe(0);
  });

  it('حواله بدون قلم کالا رد می‌شود', async () => {
    const res = await req('/api/receipts', 'POST', cookies.sales!, { customerId, items: [] });
    expect(res.status).toBe(400);
  });

  it('تعداد کیسه صفر رد می‌شود', async () => {
    const res = await req('/api/receipts', 'POST', cookies.sales!, {
      ...(await driverFields()),
      customerId,
      items: [{ productId: freeProductId, bagCount: 0 }],
    });
    expect(res.status).toBe(400);
  });

  it('مالی نمی‌تواند حواله صادر کند', async () => {
    const res = await req('/api/receipts', 'POST', cookies.finance!, {
      ...(await driverFields()),
      customerId,
      items: [{ productId: freeProductId, bagCount: 1 }],
    });
    expect(res.status).toBe(403);
  });
});

describe('جلوگیری از ثبت تکراری', () => {
  it('دو بار ارسال با یک کلید، فقط یک حواله می‌سازد', async () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    const payload = { ...(await driverFields()), customerId, items: [{ productId: freeProductId, bagCount: 5 }] };

    const first = await req('/api/receipts', 'POST', cookies.sales!, payload, {
      'Idempotency-Key': key,
    });
    const second = await req('/api/receipts', 'POST', cookies.sales!, payload, {
      'Idempotency-Key': key,
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);

    const a = (await first.json()) as { receipt: { id: number } };
    const b = (await second.json()) as { receipt: { id: number }; reused: boolean };

    expect(b.receipt.id).toBe(a.receipt.id);
    expect(b.reused).toBe(true);
  });
});

describe('قفل ویرایش پس از صدور', () => {
  it('پیش‌نویس قابل ویرایش است', async () => {
    const draft = await makeDraft();
    const res = await req(`/api/receipts/${draft.id}`, 'PATCH', cookies.sales!, {
      ...(await driverFields()),
      customerId,
      items: [{ productId: freeProductId, bagCount: 20 }],
    });
    expect(res.status).toBe(200);
  });

  it('ویرایش، شماره سریال را عوض نمی‌کند', async () => {
    const draft = await makeDraft();
    const res = await req(`/api/receipts/${draft.id}`, 'PATCH', cookies.sales!, {
      ...(await driverFields()),
      customerId,
      items: [{ productId: freeProductId, bagCount: 7 }],
    });
    const body = (await res.json()) as { receipt: { receiptNumber: string } };
    expect(body.receipt.receiptNumber).toBe(draft.receiptNumber);
  });

  // ⭐ قانون سخت‌گیرانه صورت‌مسئله
  it('حواله صادرشده دیگر قابل ویرایش نیست', async () => {
    const draft = await makeDraft();
    expect((await move(draft.id, 'ISSUED', cookies.sales!)).status).toBe(200);

    const res = await req(`/api/receipts/${draft.id}`, 'PATCH', cookies.sales!, {
      ...(await driverFields()),
      customerId,
      items: [{ productId: freeProductId, bagCount: 999 }],
    });
    expect(res.status).toBe(409);

    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain('ابطال');
  });
});

describe('چرخه وضعیت روی سرور', () => {
  it('صدور آخرین مرحله است و بعد از آن مرحله‌ای نیست', async () => {
    const draft = await makeDraft();
    expect((await move(draft.id, 'ISSUED', cookies.sales!)).status).toBe(200);

    for (const to of ['READY_FOR_LOADING', 'LOADED', 'DISPATCHED', 'CLOSED']) {
      for (const who of ['admin', 'warehouse', 'finance'] as const) {
        expect((await move(draft.id, to, cookies[who]!)).status, `${to} / ${who}`).toBe(409);
      }
    }

    const receipt = await prisma.receipt.findUnique({ where: { id: draft.id } });
    expect(receipt!.status).toBe('ISSUED');
  });

  it('حواله بدون راننده (پیش‌نویس قدیمی) صادر نمی‌شود', async () => {
    const draft = await makeDraft();
    await prisma.shipment.delete({ where: { receiptId: draft.id } });

    const res = await move(draft.id, 'ISSUED', cookies.sales!);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { message: string } }).error.message).toContain('راننده');
  });

  it('هیچ‌کس دیگر نمی‌تواند حواله را «تأیید مالی» کند', async () => {
    const draft = await makeDraft();
    await move(draft.id, 'ISSUED', cookies.sales!);

    for (const who of ['sales', 'finance', 'admin'] as const) {
      expect((await move(draft.id, 'FINANCE_APPROVED', cookies[who]!)).status).toBe(409);
    }
  });

  it('ابطال بدون دلیل رد می‌شود', async () => {
    const draft = await makeDraft();
    await move(draft.id, 'ISSUED', cookies.sales!);

    expect((await move(draft.id, 'CANCELLED', cookies.finance!)).status).toBe(400);
    expect((await move(draft.id, 'CANCELLED', cookies.finance!, 'اشتباه در مقصد')).status).toBe(200);
  });

  it('هر تغییر وضعیت در تاریخچه با کاربر و IP ثبت می‌شود', async () => {
    const draft = await makeDraft();
    await move(draft.id, 'ISSUED', cookies.sales!);
    await move(draft.id, 'CANCELLED', cookies.finance!, 'انصراف مشتری');

    const logs = await prisma.receiptStatusLog.findMany({
      where: { receiptId: draft.id },
      orderBy: { createdAt: 'asc' },
    });

    expect(logs).toHaveLength(2);
    expect(logs[0]!.fromStatus).toBe('DRAFT');
    expect(logs[0]!.toStatus).toBe('ISSUED');
    expect(logs[1]!.toStatus).toBe('CANCELLED');
    expect(logs[0]!.ipAddress).toBeTruthy();
    expect(logs[0]!.userId).not.toBe(logs[1]!.userId);
  });
});

describe('موجودی انبار', () => {
  async function stockOf(productId: number) {
    const s = await prisma.stock.findUnique({ where: { productId } });
    return { onHand: s!.onHandKg, reserved: s!.reservedKg };
  }

  // سامانه‌ای که تازه نصب شده موجودی صفر دارد؛ صدور نباید به آن وابسته باشد
  it('صدور و ابطال حواله به موجودی انبار دست نمی‌زنند', async () => {
    const before = await stockOf(freeProductId);
    const draft = await makeDraft(cookies.sales!, 10);

    expect((await move(draft.id, 'ISSUED', cookies.sales!)).status).toBe(200);
    expect(await stockOf(freeProductId)).toEqual(before);

    expect((await move(draft.id, 'CANCELLED', cookies.finance!, 'انصراف مشتری')).status).toBe(200);
    expect(await stockOf(freeProductId)).toEqual(before);
  });

  it('حواله‌ای بیش از موجودی ثبت‌شده هم صادر می‌شود', async () => {
    const stock = await stockOf(freeProductId);
    const product = await prisma.product.findUnique({ where: { id: freeProductId } });
    const tooMany = Math.floor(stock.onHand / product!.bagWeightKg) + 100;

    const draft = await makeDraft(cookies.sales!, tooMany);
    expect((await move(draft.id, 'ISSUED', cookies.sales!)).status).toBe(200);
  });
});

describe('دسترسی به حواله‌ها', () => {
  it('گزارش‌گیر می‌تواند حواله ببیند ولی نمی‌تواند بسازد', async () => {
    expect((await req('/api/receipts', 'GET', cookies.viewer!)).status).toBe(200);
    expect(
      (await req('/api/receipts', 'POST', cookies.viewer!, {
      ...(await driverFields()),
        customerId,
        items: [{ productId: freeProductId, bagCount: 1 }],
      })).status,
    ).toBe(403);
  });

  it('فهرست حواله‌ها صفحه‌بندی دارد', async () => {
    const res = await req('/api/receipts?page=1&pageSize=10', 'GET', cookies.admin!);
    const body = (await res.json()) as { receipts: unknown[]; total: number; pageSize: number };
    expect(body.receipts.length).toBeLessThanOrEqual(10);
    expect(body.pageSize).toBe(10);
    expect(typeof body.total).toBe('number');
  });
});
