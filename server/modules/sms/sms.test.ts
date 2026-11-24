import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { setSmsProviderForTests, type SmsProvider } from './provider.js';
import { MAX_ATTEMPTS, processPending } from './service.js';
import { driverFields } from '../../tests/driverFields.js';

let server: Server;
let baseUrl: string;
const cookies: Record<string, string> = {};
let productId: number;
let customerId: number;

/** پنل ساختگی: هرچه «فرستاده شود» اینجا جمع می‌شود. */
class FakeProvider implements SmsProvider {
  readonly name = 'fake';
  sent: { to: string; text: string }[] = [];
  failWith: string | null = null;
  async send(to: string, text: string) {
    if (this.failWith) throw new Error(this.failWith);
    this.sent.push({ to, text });
    return { providerRef: `ref-${this.sent.length}` };
  }
}
let fake: FakeProvider;

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

async function draft() {
  const res = await req('/api/receipts', 'POST', cookies.sales!, {
      ...(await driverFields()),
    customerId,
    items: [{ productId, bagCount: 100 }],
  });
  return ((await res.json()) as { receipt: { id: number; receiptNumber: string } }).receipt;
}

async function draftWithDriverNoMobile() {
  const driver = await prisma.driver.upsert({
    where: { nationalId: '0012345679' },
    update: {},
    create: { fullName: 'راننده بدون موبایل', nationalId: '0012345679' },
  });
  const res = await req('/api/receipts', 'POST', cookies.sales!, {
    customerId,
    items: [{ productId, bagCount: 100 }],
    driverId: driver.id,
    haulType: 'SELF',
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { receipt: { id: number; receiptNumber: string } }).receipt;
}

const issue = (id: number) =>
  req(`/api/receipts/${id}/transition`, 'POST', cookies.sales!, { to: 'ISSUED' });

const messages = (receiptId: number) =>
  prisma.smsMessage.findMany({ where: { receiptId }, orderBy: { id: 'asc' } });

/** صدور، پیامک را در پس‌زمینه می‌فرستد؛ برای قطعیت آزمون، صف را خودمان خالی می‌کنیم. */
const settle = async () => {
  await new Promise((r) => setTimeout(r, 50));
  await processPending(100);
};

beforeAll(async () => {
  process.env.JWT_SECRET ??= 'test-secret-at-least-16-chars';
  server = createApp().listen(0);
  const { port } = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${port}`;
  for (const u of ['admin', 'sales', 'viewer']) cookies[u] = await login(u);

  const product = await prisma.product.create({
    data: {
      code: `SMS-${Date.now()}`, name: 'آرد آزمون پیامک', bagWeightKg: 40,
      basePricePerKg: BigInt(10_000), pricingCategory: 'FREE', vatPercent: 10,
    },
  });
  await prisma.stock.create({ data: { productId: product.id, onHandKg: 10_000_000, reservedKg: 0 } });
  productId = product.id;

  const customer = await prisma.customer.create({
    data: { code: `SMSC-${Date.now()}`, kind: 'INDIVIDUAL', type: 'BAKERY', name: 'مشتری آزمون پیامک' },
  });
  customerId = customer.id;
});

beforeEach(async () => {
  fake = new FakeProvider();
  setSmsProviderForTests(fake);
  process.env.SMS_MANAGER_NUMBERS = '09150000001';
  // پیامک‌های در صفِ آزمون قبلی نباید به این آزمون نشت کنند
  await prisma.smsMessage.updateMany({ where: { status: 'PENDING' }, data: { status: 'FAILED' } });
});

afterAll(() => {
  setSmsProviderForTests(undefined);
  delete process.env.SMS_MANAGER_NUMBERS;
  server.close();
});

describe('پیامک هنگام صدور حواله', () => {
  it('با صدور نهایی، برای راننده و مدیر پیامک می‌رود', async () => {
    const receipt = await draft();
    expect((await issue(receipt.id)).status).toBe(200);
    await settle();

    const rows = await messages(receipt.id);
    expect(rows.map((r) => r.recipientKind).sort()).toEqual(['DRIVER', 'MANAGER']);
    expect(rows.every((r) => r.status === 'SENT')).toBe(true);

    const toDriver = fake.sent.find((m) => m.to === '09123456789');
    expect(toDriver?.text).toContain('آرد آزمون پیامک');
    expect(fake.sent.some((m) => m.to === '09150000001')).toBe(true);
  });

  it('پیش‌نویس هیچ پیامکی نمی‌فرستد', async () => {
    const receipt = await draft();
    await settle();
    expect(await messages(receipt.id)).toHaveLength(0);
  });

  // ⭐ قانون اصلی: پیامک هرگز جلوی صدور حواله را نمی‌گیرد
  it('وقتی پنل پیامک از کار افتاده، حواله همچنان صادر می‌شود', async () => {
    fake.failWith = 'اینترنت قطع است';
    const receipt = await draft();

    expect((await issue(receipt.id)).status).toBe(200);
    await settle();

    const fresh = await prisma.receipt.findUnique({ where: { id: receipt.id } });
    expect(fresh!.status).toBe('ISSUED');

    const rows = await messages(receipt.id);
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.status === 'PENDING')).toBe(true);
    expect(rows[0]!.lastError).toContain('اینترنت قطع است');
  });

  it('پیامک مانده در صف، با برگشتن اینترنت فرستاده می‌شود', async () => {
    fake.failWith = 'قطع';
    const receipt = await draft();
    await issue(receipt.id);
    await settle();

    fake.failWith = null;
    await processPending(100);

    const rows = await messages(receipt.id);
    expect(rows.every((r) => r.status === 'SENT')).toBe(true);
    expect(fake.sent).toHaveLength(2);
  });

  it(`پس از ${MAX_ATTEMPTS} تلاش ناموفق، پیامک کنار گذاشته می‌شود`, async () => {
    fake.failWith = 'شماره نامعتبر';
    const receipt = await draft();
    await issue(receipt.id);
    for (let i = 0; i < MAX_ATTEMPTS + 1; i++) await processPending(100);

    const rows = await messages(receipt.id);
    expect(rows.every((r) => r.status === 'FAILED')).toBe(true);
    expect(rows.every((r) => r.attempts === MAX_ATTEMPTS)).toBe(true);
  });

  it('وقتی پیامک خاموش است، هیچ‌چیز در صف نمی‌رود', async () => {
    setSmsProviderForTests(null);
    const receipt = await draft();
    await issue(receipt.id);
    await settle();
    expect(await messages(receipt.id)).toHaveLength(0);
  });
});

describe('راننده بدون موبایل', () => {
  it('پیامکی نمی‌گیرد و خطایی هم نمی‌دهد؛ مدیر همچنان پیامک می‌گیرد', async () => {
    const receipt = await draftWithDriverNoMobile();

    expect((await issue(receipt.id)).status).toBe(200);
    await settle();
    expect((await messages(receipt.id)).map((r) => r.recipientKind)).toEqual(['MANAGER']);
  });
});

describe('ارسال دستی با دکمه', () => {
  it('پیامک را دوباره برای راننده و مدیر می‌فرستد', async () => {
    const receipt = await draft();
    await issue(receipt.id);
    await settle();

    const res = await req(`/api/sms/receipts/${receipt.id}/send`, 'POST', cookies.sales!);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { queued: number }).queued).toBe(2);
    expect((await messages(receipt.id)).filter((r) => r.event === 'MANUAL')).toHaveLength(2);
  });

  it('برای پیش‌نویس رد می‌شود', async () => {
    const receipt = await draft();
    const res = await req(`/api/sms/receipts/${receipt.id}/send`, 'POST', cookies.sales!);
    expect(res.status).toBe(409);
  });

  it('وقتی هیچ گیرنده‌ای نیست، پیام روشن می‌دهد', async () => {
    process.env.SMS_MANAGER_NUMBERS = '';
    const receipt = await draftWithDriverNoMobile();
    await issue(receipt.id);
    const res = await req(`/api/sms/receipts/${receipt.id}/send`, 'POST', cookies.sales!);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { message: string } }).error.message).toContain('گیرنده');
  });

  it('گزارش‌گیر نمی‌تواند پیامک بفرستد', async () => {
    const receipt = await draft();
    await issue(receipt.id);
    for (const who of ['viewer'] as const) {
      const res = await req(`/api/sms/receipts/${receipt.id}/send`, 'POST', cookies[who]!);
      expect(res.status, who).toBe(403);
    }
  });

  it('شماره غلط مدیر در تنظیمات نادیده گرفته می‌شود و بقیه می‌روند', async () => {
    process.env.SMS_MANAGER_NUMBERS = '09150000001, 12345, 09150000002';
    const receipt = await draft();
    await issue(receipt.id);
    await settle();
    const managers = (await messages(receipt.id)).filter((r) => r.recipientKind === 'MANAGER');
    expect(managers.map((m) => m.recipient).sort()).toEqual(['09150000001', '09150000002']);
  });
});
