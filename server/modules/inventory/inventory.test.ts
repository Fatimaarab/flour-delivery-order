import { beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
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

function req(path: string, method: string, cookie: string, body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { cookie, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** محصول تازه با موجودی مشخص — تا تست‌ها روی هم اثر نگذارند. */
async function freshProduct(onHandKg = 0) {
  const product = await prisma.product.create({
    data: {
      code: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: 'محصول آزمون انبار',
      bagWeightKg: 40,
      basePricePerKg: BigInt(10_000),
      pricingCategory: 'FREE',
      vatPercent: 10,
    },
  });
  await prisma.stock.create({ data: { productId: product.id, onHandKg, reservedKg: 0 } });
  return product;
}

const stockOf = async (productId: number) => {
  const s = await prisma.stock.findUnique({ where: { productId } });
  return { onHand: s!.onHandKg, reserved: s!.reservedKg };
};

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

describe('ثبت تولید روزانه', () => {
  it('تولید، موجودی انبار را افزایش می‌دهد', async () => {
    const product = await freshProduct(10_000);

    const res = await req('/api/inventory/production', 'POST', cookies.warehouse!, {
      productId: product.id,
      quantityKg: 5_000,
      note: 'شیفت صبح',
    });
    expect(res.status).toBe(201);
    expect((await stockOf(product.id)).onHand).toBe(15_000);
  });

  it('هر تولید یک سطر در گردش انبار ثبت می‌کند', async () => {
    const product = await freshProduct();
    await req('/api/inventory/production', 'POST', cookies.warehouse!, {
      productId: product.id,
      quantityKg: 3_000,
    });

    const movements = await prisma.stockMovement.findMany({ where: { productId: product.id } });
    expect(movements).toHaveLength(1);
    expect(movements[0]!.type).toBe('PRODUCTION');
    expect(movements[0]!.quantityKg).toBe(3_000);
  });

  it('مقدار صفر یا منفی رد می‌شود', async () => {
    const product = await freshProduct();
    for (const quantityKg of [0, -100]) {
      const res = await req('/api/inventory/production', 'POST', cookies.warehouse!, {
        productId: product.id,
        quantityKg,
      });
      expect(res.status).toBe(400);
    }
  });

  it('فروش نمی‌تواند تولید ثبت کند', async () => {
    const product = await freshProduct();
    const res = await req('/api/inventory/production', 'POST', cookies.sales!, {
      productId: product.id,
      quantityKg: 1_000,
    });
    expect(res.status).toBe(403);
  });
});

describe('اصلاح دستی موجودی', () => {
  it('موجودی را به مقدار جدید می‌رساند و تفاوت را ثبت می‌کند', async () => {
    const product = await freshProduct(10_000);

    const res = await req('/api/inventory/adjust', 'POST', cookies.warehouse!, {
      productId: product.id,
      newOnHandKg: 9_400,
      reason: 'انبارگردانی — کسری ۶۰۰ کیلو',
    });
    expect(res.status).toBe(200);
    expect((await stockOf(product.id)).onHand).toBe(9_400);

    const movement = await prisma.stockMovement.findFirst({
      where: { productId: product.id, type: 'ADJUSTMENT' },
    });
    expect(movement!.quantityKg).toBe(-600);
    expect(movement!.note).toContain('انبارگردانی');
  });

  it('اصلاح بدون دلیل رد می‌شود', async () => {
    const product = await freshProduct(10_000);
    const res = await req('/api/inventory/adjust', 'POST', cookies.warehouse!, {
      productId: product.id,
      newOnHandKg: 5_000,
      reason: '',
    });
    expect(res.status).toBe(400);
  });

  it('موجودی منفی پذیرفته نمی‌شود', async () => {
    const product = await freshProduct(10_000);
    const res = await req('/api/inventory/adjust', 'POST', cookies.warehouse!, {
      productId: product.id,
      newOnHandKg: -1,
      reason: 'تست',
    });
    expect(res.status).toBe(400);
  });

  // ⭐ قاعده اصلی انبار
  it('نمی‌توان موجودی را کمتر از مقدار رزروشده کرد', async () => {
    const product = await freshProduct(100_000);

    // رزرو دیگر هنگام صدور ساخته نمی‌شود (صدور مستقیم کسر می‌کند)؛ رزرو فقط
    // در حواله‌های قدیمی مانده است. همان را مستقیم می‌سازیم.
    await prisma.stock.update({ where: { productId: product.id }, data: { reservedKg: 40_000 } });

    expect((await stockOf(product.id)).reserved).toBe(40_000);

    // تلاش برای پایین آوردن موجودی زیر رزرو
    const res = await req('/api/inventory/adjust', 'POST', cookies.warehouse!, {
      productId: product.id,
      newOnHandKg: 30_000,
      reason: 'انبارگردانی',
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain('رزرو');

    // هیچ تغییری نباید رخ داده باشد
    expect((await stockOf(product.id)).onHand).toBe(100_000);
  });

  it('کاهش تا دقیقاً سطح رزرو مجاز است', async () => {
    const product = await freshProduct(100_000);
    const customer = await prisma.customer.findFirst({ where: { isActive: true, deletedAt: null } });
    const draft = await req('/api/receipts', 'POST', cookies.sales!, {
      ...(await driverFields()),
      customerId: customer!.id,
      items: [{ productId: product.id, bagCount: 500 }], // ۲۰ تن
    });
    const { receipt } = (await draft.json()) as { receipt: { id: number } };
    await req(`/api/receipts/${receipt.id}/transition`, 'POST', cookies.sales!, { to: 'ISSUED' });

    const res = await req('/api/inventory/adjust', 'POST', cookies.warehouse!, {
      productId: product.id,
      newOnHandKg: 20_000,
      reason: 'انبارگردانی',
    });
    expect(res.status).toBe(200);
  });
});

describe('قاعده همیشگی انبار: موجودی ≥ رزرو ≥ صفر', () => {
  it('در یک چرخه کامل حواله، قاعده هرگز شکسته نمی‌شود', async () => {
    const product = await freshProduct(100_000);
    const customer = await prisma.customer.findFirst({ where: { isActive: true, deletedAt: null } });

    const check = async () => {
      const s = await stockOf(product.id);
      expect(s.onHand).toBeGreaterThanOrEqual(s.reserved);
      expect(s.reserved).toBeGreaterThanOrEqual(0);
      expect(s.onHand).toBeGreaterThanOrEqual(0);
    };

    const draft = await req('/api/receipts', 'POST', cookies.sales!, {
      ...(await driverFields()),
      customerId: customer!.id,
      items: [{ productId: product.id, bagCount: 250 }],
    });
    const { receipt } = (await draft.json()) as { receipt: { id: number } };
    await check();

    const steps: [string, string][] = [
      ['ISSUED', cookies.sales!],
      ['CANCELLED', cookies.finance!],
    ];
    for (const [to, cookie] of steps) {
      await req(`/api/receipts/${receipt.id}/transition`, 'POST', cookie, { to, reason: 'آزمون' });
      await check();
    }

    // پس از صدور و ابطال، موجودی کامل برگشته و رزروی نمانده
    const final = await stockOf(product.id);
    expect(final.reserved).toBe(0);
    expect(final.onHand).toBe(100_000);
  });

  it('موجودی همیشه با جمع گردش‌ها می‌خواند', async () => {
    const product = await freshProduct(0);

    await req('/api/inventory/production', 'POST', cookies.warehouse!, {
      productId: product.id,
      quantityKg: 50_000,
    });
    await req('/api/inventory/adjust', 'POST', cookies.warehouse!, {
      productId: product.id,
      newOnHandKg: 48_000,
      reason: 'کسری انبارگردانی',
    });

    const movements = await prisma.stockMovement.findMany({ where: { productId: product.id } });
    const physical = movements
      .filter((m) => ['PRODUCTION', 'ISSUE', 'RETURN', 'ADJUSTMENT'].includes(m.type))
      .reduce((sum, m) => sum + m.quantityKg, 0);

    expect((await stockOf(product.id)).onHand).toBe(physical);
  });
});

describe('کاردکس انبار', () => {
  it('گردش‌ها را با مانده متحرک برمی‌گرداند', async () => {
    const product = await freshProduct(0);

    await req('/api/inventory/production', 'POST', cookies.warehouse!, {
      productId: product.id,
      quantityKg: 20_000,
    });
    await req('/api/inventory/production', 'POST', cookies.warehouse!, {
      productId: product.id,
      quantityKg: 10_000,
    });

    const res = await req(`/api/inventory/kardex/${product.id}`, 'GET', cookies.warehouse!);
    const body = (await res.json()) as {
      product: { onHandKg: number };
      movements: { quantityKg: number; balanceAfter: number | null }[];
    };

    expect(body.product.onHandKg).toBe(30_000);
    // جدیدترین گردش بالاست؛ مانده پس از آن باید برابر موجودی فعلی باشد
    expect(body.movements[0]!.balanceAfter).toBe(30_000);
    expect(body.movements[1]!.balanceAfter).toBe(20_000);
  });
});

describe('دسترسی به انبار', () => {
  it('گزارش‌گیر می‌تواند ببیند ولی نمی‌تواند تغییر دهد', async () => {
    expect((await req('/api/inventory', 'GET', cookies.viewer!)).status).toBe(200);

    const product = await freshProduct();
    expect(
      (await req('/api/inventory/production', 'POST', cookies.viewer!, {
        productId: product.id,
        quantityKg: 100,
      })).status,
    ).toBe(403);
  });

  it('فروش می‌تواند موجودی را ببیند (برای صدور حواله لازم است)', async () => {
    expect((await req('/api/inventory', 'GET', cookies.sales!)).status).toBe(200);
  });
});
