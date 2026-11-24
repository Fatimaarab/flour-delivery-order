import { beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { driverFields } from '../../tests/driverFields.js';

let server: Server;
let baseUrl: string;
const cookies: Record<string, string> = {};
let productId: number;

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

/** یک مشتری تازه با سقف اعتبار دلخواه — تا تست‌ها روی هم اثر نگذارند. */
async function freshCustomer(creditLimit: number) {
  return prisma.customer.create({
    data: {
      code: `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind: 'INDIVIDUAL',
      type: 'BAKERY',
      name: 'مشتری آزمون مالی',
      creditLimit: BigInt(creditLimit),
      balance: BigInt(0),
    },
  });
}

async function makeReceipt(customerId: number, bagCount = 10) {
  const res = await req('/api/receipts', 'POST', cookies.sales!, {
      ...(await driverFields()),
    customerId,
    items: [{ productId, bagCount }],
  });
  const body = (await res.json()) as { receipt: { id: number; grandTotal: number } };
  return body.receipt;
}

const move = (id: number, to: string, cookie: string, reason?: string) =>
  req(`/api/receipts/${id}/transition`, 'POST', cookie, { to, reason });

const balanceOf = async (id: number) =>
  Number((await prisma.customer.findUnique({ where: { id } }))!.balance);

beforeAll(async () => {
  process.env.JWT_SECRET ??= 'test-secret-at-least-16-chars';
  server = createApp().listen(0);
  const { port } = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${port}`;

  for (const u of ['admin', 'sales', 'finance', 'warehouse', 'viewer']) {
    cookies[u] = await login(u);
  }

  const product = await prisma.product.findFirst({
    where: { pricingCategory: 'FREE', isActive: true },
  });
  productId = product!.id;

  return () => server.close();
});

/*
 * مرحله «تأیید مالی» و کنترل سقف اعتبار به درخواست کارفرما حذف شدند. این
 * بخش جای آزمون‌های آن دروازه را گرفته و همان چیزی را که جایش آمده تثبیت
 * می‌کند: بدهی از لحظه صدور ثبت می‌شود و هیچ سقفی جلوی صدور را نمی‌گیرد.
 */
describe('بدهی مشتری پس از حذف تأیید مالی', () => {
  it('صدور حواله، مشتری را بدهکار می‌کند', async () => {
    const customer = await freshCustomer(100_000_000_000);
    const receipt = await makeReceipt(customer.id);

    expect(await balanceOf(customer.id)).toBe(0);
    expect((await move(receipt.id, 'ISSUED', cookies.sales!)).status).toBe(200);
    expect(await balanceOf(customer.id)).toBe(-receipt.grandTotal);
  });

  it('سقف اعتبار دیگر جلوی صدور را نمی‌گیرد', async () => {
    const customer = await freshCustomer(1_000); // سقف عملاً صفر
    const receipt = await makeReceipt(customer.id);

    expect((await move(receipt.id, 'ISSUED', cookies.sales!)).status).toBe(200);
    expect(await balanceOf(customer.id)).toBe(-receipt.grandTotal);
  });

  it('وضعیت «تأیید مالی» دیگر در دسترس نیست', async () => {
    const customer = await freshCustomer(100_000_000_000);
    const receipt = await makeReceipt(customer.id);
    await move(receipt.id, 'ISSUED', cookies.sales!);

    expect((await move(receipt.id, 'FINANCE_APPROVED', cookies.finance!)).status).toBe(409);
  });

  // ⭐ بدهکار و بستانکار باید همیشه قرینه هم بمانند
  it('ابطال حواله صادرشده، بدهی را دقیقاً برمی‌گرداند', async () => {
    const customer = await freshCustomer(100_000_000_000);
    const receipt = await makeReceipt(customer.id);

    await move(receipt.id, 'ISSUED', cookies.sales!);
    await move(receipt.id, 'CANCELLED', cookies.finance!, 'انصراف مشتری');

    expect(await balanceOf(customer.id)).toBe(0);
  });

  it('دور انداختن پیش‌نویس هیچ اثری روی مانده ندارد', async () => {
    const customer = await freshCustomer(100_000_000_000);
    const receipt = await makeReceipt(customer.id);

    await move(receipt.id, 'CANCELLED', cookies.sales!);
    expect(await balanceOf(customer.id)).toBe(0);
  });
});

describe('مانده حساب مشتری', () => {
  it('حواله تأییدشده و پرداخت‌نشده، مشتری را بدهکار می‌کند', async () => {
    const customer = await freshCustomer(100_000_000_000);
    const receipt = await makeReceipt(customer.id);

    await move(receipt.id, 'ISSUED', cookies.sales!);

    expect(await balanceOf(customer.id)).toBe(-receipt.grandTotal);
  });

  it('پرداخت، بدهی را دقیقاً کم می‌کند', async () => {
    const customer = await freshCustomer(100_000_000_000);
    const receipt = await makeReceipt(customer.id);

    await move(receipt.id, 'ISSUED', cookies.sales!);

    await req('/api/payments', 'POST', cookies.finance!, {
      customerId: customer.id,
      receiptId: receipt.id,
      amount: receipt.grandTotal,
      method: 'BANK_TRANSFER',
      referenceNumber: '123456',
    });

    expect(await balanceOf(customer.id)).toBe(0);
  });

  it('ابطال حواله تأییدشده، بدهی را برمی‌گرداند', async () => {
    const customer = await freshCustomer(100_000_000_000);
    const receipt = await makeReceipt(customer.id);

    await move(receipt.id, 'ISSUED', cookies.sales!);
    expect(await balanceOf(customer.id)).toBe(-receipt.grandTotal);

    await move(receipt.id, 'CANCELLED', cookies.finance!, 'انصراف مشتری');
    expect(await balanceOf(customer.id)).toBe(0);
  });

  it('چند پرداخت جزئی پشت سر هم، مانده را درست نگه می‌دارند', async () => {
    const customer = await freshCustomer(100_000_000_000);
    const receipt = await makeReceipt(customer.id);
    await move(receipt.id, 'ISSUED', cookies.sales!);

    const third = Math.floor(receipt.grandTotal / 3);
    for (let i = 0; i < 3; i++) {
      await req('/api/payments', 'POST', cookies.finance!, {
        customerId: customer.id,
        receiptId: receipt.id,
        amount: third,
        method: 'CASH',
      });
    }

    expect(await balanceOf(customer.id)).toBe(-(receipt.grandTotal - third * 3));

    const fresh = await prisma.receipt.findUnique({ where: { id: receipt.id } });
    expect(Number(fresh!.paidAmount)).toBe(third * 3);
  });
});

describe('اعتبارسنجی پرداخت', () => {
  it('پرداخت بیش از مانده حواله رد می‌شود', async () => {
    const customer = await freshCustomer(100_000_000_000);
    const receipt = await makeReceipt(customer.id);

    const res = await req('/api/payments', 'POST', cookies.finance!, {
      customerId: customer.id,
      receiptId: receipt.id,
      amount: receipt.grandTotal + 1,
      method: 'CASH',
    });
    expect(res.status).toBe(400);
  });

  it('واریز بانکی بدون شماره فیش رد می‌شود', async () => {
    const customer = await freshCustomer(100_000_000_000);
    const receipt = await makeReceipt(customer.id);

    const res = await req('/api/payments', 'POST', cookies.finance!, {
      customerId: customer.id,
      receiptId: receipt.id,
      amount: 1_000,
      method: 'BANK_TRANSFER',
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { message: string } }).error.message).toContain('فیش');
  });

  it('چک بدون تاریخ سررسید رد می‌شود', async () => {
    const customer = await freshCustomer(100_000_000_000);
    const receipt = await makeReceipt(customer.id);

    const res = await req('/api/payments', 'POST', cookies.finance!, {
      customerId: customer.id,
      receiptId: receipt.id,
      amount: 1_000,
      method: 'CHEQUE',
      referenceNumber: '55',
    });
    expect(res.status).toBe(400);
  });

  it('پرداخت برای حواله ابطال‌شده ممکن نیست', async () => {
    const customer = await freshCustomer(100_000_000_000);
    const receipt = await makeReceipt(customer.id);
    await move(receipt.id, 'ISSUED', cookies.sales!);
    await move(receipt.id, 'CANCELLED', cookies.finance!, 'دلیل');

    const res = await req('/api/payments', 'POST', cookies.finance!, {
      customerId: customer.id,
      receiptId: receipt.id,
      amount: 1_000,
      method: 'CASH',
    });
    expect(res.status).toBe(409);
  });

  it('پرداخت برای حواله مشتری دیگر رد می‌شود', async () => {
    const a = await freshCustomer(100_000_000_000);
    const b = await freshCustomer(100_000_000_000);
    const receipt = await makeReceipt(a.id);

    const res = await req('/api/payments', 'POST', cookies.finance!, {
      customerId: b.id,
      receiptId: receipt.id,
      amount: 1_000,
      method: 'CASH',
    });
    expect(res.status).toBe(400);
  });
});

describe('ابطال پرداخت — بدون حذف فیزیکی', () => {
  it('پرداخت باطل‌شده از دیتابیس پاک نمی‌شود، فقط علامت می‌خورد', async () => {
    const customer = await freshCustomer(100_000_000_000);
    const receipt = await makeReceipt(customer.id);

    const created = await req('/api/payments', 'POST', cookies.finance!, {
      customerId: customer.id,
      receiptId: receipt.id,
      amount: 1_000_000,
      method: 'CASH',
    });
    const { payment } = (await created.json()) as { payment: { id: number } };

    expect(
      (await req(`/api/payments/${payment.id}/void`, 'POST', cookies.finance!, {
        reason: 'ثبت اشتباه',
      })).status,
    ).toBe(200);

    // رکورد هنوز در دیتابیس هست
    const row = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(row).not.toBeNull();
    expect(row!.deletedAt).not.toBeNull();

    // ولی از محاسبات کنار رفته
    expect(await balanceOf(customer.id)).toBe(0);
    const fresh = await prisma.receipt.findUnique({ where: { id: receipt.id } });
    expect(Number(fresh!.paidAmount)).toBe(0);
  });

  it('ابطال پرداخت بدون دلیل رد می‌شود', async () => {
    const customer = await freshCustomer(100_000_000_000);
    const receipt = await makeReceipt(customer.id);
    const created = await req('/api/payments', 'POST', cookies.finance!, {
      customerId: customer.id,
      receiptId: receipt.id,
      amount: 1_000,
      method: 'CASH',
    });
    const { payment } = (await created.json()) as { payment: { id: number } };

    const res = await req(`/api/payments/${payment.id}/void`, 'POST', cookies.finance!, {
      reason: '',
    });
    expect(res.status).toBe(400);
  });
});

describe('صورتحساب مشتری', () => {
  it('بدهکاری و بستانکاری را با مانده متحرک نشان می‌دهد', async () => {
    const customer = await freshCustomer(100_000_000_000);
    const receipt = await makeReceipt(customer.id);

    await move(receipt.id, 'ISSUED', cookies.sales!);
    await req('/api/payments', 'POST', cookies.finance!, {
      customerId: customer.id,
      receiptId: receipt.id,
      amount: receipt.grandTotal,
      method: 'POS',
    });

    const res = await req(`/api/payments/statement/${customer.id}`, 'GET', cookies.finance!);
    const body = (await res.json()) as {
      ledger: { debit: number; credit: number; balance: number }[];
      totals: { debit: number; credit: number };
      customer: { balance: number };
    };

    expect(body.ledger).toHaveLength(2);
    expect(body.totals.debit).toBe(receipt.grandTotal);
    expect(body.totals.credit).toBe(receipt.grandTotal);
    // مانده پایانی صورتحساب باید با مانده ثبت‌شده مشتری یکی باشد
    expect(body.ledger.at(-1)!.balance).toBe(body.customer.balance);
  });
});

describe('کنترل دسترسی مالی', () => {
  it('فروش نمی‌تواند پرداخت ثبت کند', async () => {
    const customer = await freshCustomer(100_000_000_000);
    const res = await req('/api/payments', 'POST', cookies.sales!, {
      customerId: customer.id,
      amount: 1_000,
      method: 'CASH',
    });
    expect(res.status).toBe(403);
  });

  it('انبار نمی‌تواند فهرست پرداخت‌ها را ببیند', async () => {
    expect((await req('/api/payments', 'GET', cookies.warehouse!)).status).toBe(403);
  });

  it('گزارش‌گیر می‌تواند ببیند ولی نمی‌تواند ثبت کند', async () => {
    expect((await req('/api/payments', 'GET', cookies.viewer!)).status).toBe(200);
    const customer = await freshCustomer(1_000_000);
    expect(
      (await req('/api/payments', 'POST', cookies.viewer!, {
        customerId: customer.id,
        amount: 1_000,
        method: 'CASH',
      })).status,
    ).toBe(403);
  });

  it('فقط مالی و مدیر می‌توانند پرداخت را باطل کنند', async () => {
    const customer = await freshCustomer(100_000_000_000);
    const created = await req('/api/payments', 'POST', cookies.finance!, {
      customerId: customer.id,
      amount: 1_000,
      method: 'CASH',
    });
    const { payment } = (await created.json()) as { payment: { id: number } };

    expect(
      (await req(`/api/payments/${payment.id}/void`, 'POST', cookies.sales!, { reason: 'x' }))
        .status,
    ).toBe(403);
  });
});
