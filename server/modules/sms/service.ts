import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { digitsOnly } from '../../../shared/digits.js';
import { isValidMobile } from '../../../shared/nationalId.js';
import { driverIssuedText, managerIssuedText, type SmsReceiptInfo } from '../../../shared/smsTemplates.js';
import { getSmsProvider, managerNumbers } from './provider.js';

/**
 * صف پیامک.
 *
 * ── قانون اصلی: پیامک هرگز جلوی کار را نمی‌گیرد ──────────────────────────
 * سامانه طوری ساخته شده که بدون اینترنت هم حواله صادر کند. پس پیامک اول
 * در پایگاه داده نوشته می‌شود («در صف») و **جدا از** صدور حواله فرستاده
 * می‌شود. اگر اینترنت قطع باشد یا پنل جواب ندهد، حواله صادر شده و پیامک
 * در صف می‌ماند تا دوباره تلاش شود.
 * ────────────────────────────────────────────────────────────────────────
 */

/** پس از این تعداد تلاش ناموفق، پیامک کنار گذاشته می‌شود. */
export const MAX_ATTEMPTS = 5;

/** وضعیت‌هایی که حواله در آن‌ها «صادرشده و زنده» است. */
const LIVE_STATUSES = ['ISSUED', 'FINANCE_APPROVED', 'READY_FOR_LOADING', 'LOADED'];

export function smsEnabled(): boolean {
  return getSmsProvider() !== null;
}

async function loadReceipt(receiptId: number) {
  const receipt = await prisma.receipt.findFirst({
    where: { id: receiptId, deletedAt: null },
    include: {
      customer: { select: { name: true } },
      issuedBy: { select: { fullName: true } },
      items: { include: { product: { select: { name: true } } } },
      shipment: true,
    },
  });
  if (!receipt) throw notFound('حواله‌ای با این شناسه پیدا نشد.');
  return receipt;
}

type LoadedReceipt = Awaited<ReturnType<typeof loadReceipt>>;

function toInfo(receipt: LoadedReceipt): SmsReceiptInfo {
  return {
    receiptNumber: receipt.receiptNumber,
    customerName: receipt.customer.name,
    totalWeightKg: receipt.totalWeightKg,
    items: receipt.items.map((i) => ({ productName: i.product.name, bagCount: i.bagCount })),
    issuerName: receipt.issuedBy.fullName,
    driverName: receipt.shipment?.driverName ?? null,
  };
}

async function companyName(): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key: 'company_name' } });
  return row?.value ?? 'شرکت آرد';
}

interface QueueOptions {
  event: 'RECEIPT_ISSUED' | 'MANUAL';
  userId?: number;
}

/** پیامک‌های یک حواله را در صف می‌گذارد. تعداد پیامک‌های صف‌شده را برمی‌گرداند. */
async function queueFor(receipt: LoadedReceipt, options: QueueOptions): Promise<number> {
  const info = toInfo(receipt);
  const rows: { recipient: string; recipientKind: 'DRIVER' | 'MANAGER'; text: string }[] = [];

  const driverMobile = digitsOnly(receipt.shipment?.driverMobile ?? '');
  if (driverMobile && isValidMobile(driverMobile)) {
    rows.push({
      recipient: driverMobile,
      recipientKind: 'DRIVER',
      text: driverIssuedText(await companyName(), info),
    });
  }

  for (const raw of managerNumbers()) {
    const number = digitsOnly(raw);
    // شماره غلط در تنظیمات نباید کل ارسال را خراب کند؛ فقط همان رد می‌شود
    if (!isValidMobile(number)) continue;
    rows.push({ recipient: number, recipientKind: 'MANAGER', text: managerIssuedText(info) });
  }

  if (rows.length === 0) return 0;

  await prisma.smsMessage.createMany({
    data: rows.map((r) => ({
      ...r,
      receiptId: receipt.id,
      event: options.event,
      createdById: options.userId ?? null,
    })),
  });
  return rows.length;
}

/**
 * ارسال خودکار، هنگام صدور نهایی حواله.
 *
 * هیچ‌وقت خطا پرتاب نمی‌کند: حواله‌ای که صادر شده نباید به خاطر پیامک
 * «ناموفق» دیده شود.
 */
export async function queueReceiptIssued(receiptId: number, userId?: number): Promise<void> {
  try {
    if (!smsEnabled()) return;
    await queueFor(await loadReceipt(receiptId), { event: 'RECEIPT_ISSUED', userId });
  } catch (err) {
    console.error('[sms] صف کردن پیامک صدور حواله ناموفق بود:', err);
  }
}

/** ارسال دستی با دکمه — برای ارسال دوباره یا وقتی خودکار چیزی نفرستاده. */
export async function queueManual(receiptId: number, userId: number): Promise<number> {
  if (!smsEnabled()) {
    throw conflict('پیامک فعال نیست. مقدار SMS_PROVIDER را در فایل تنظیمات (.env) مشخص کنید.');
  }
  const receipt = await loadReceipt(receiptId);
  if (receipt.status === 'DRAFT') {
    throw conflict('پیش‌نویس هنوز سند رسمی نیست؛ اول حواله را صادر کنید.');
  }

  const queued = await queueFor(receipt, { event: 'MANUAL', userId });
  if (queued === 0) {
    throw badRequest(
      'گیرنده‌ای برای پیامک نیست: موبایل راننده ثبت نشده و شماره مدیر هم در تنظیمات نیامده است.',
    );
  }
  return queued;
}

/**
 * فرستادن پیامک‌های در صف.
 *
 * هر پیامک جدا فرستاده می‌شود تا خطای یکی، بقیه را نگه ندارد. پیامک ناموفق
 * در صف می‌ماند و دفعه بعد دوباره تلاش می‌شود؛ پس از MAX_ATTEMPTS تلاش
 * کنار گذاشته می‌شود تا صف برای همیشه روی یک شماره خراب گیر نکند.
 */
export async function processPending(limit = 20): Promise<{ sent: number; failed: number }> {
  const provider = getSmsProvider();
  if (!provider) return { sent: 0, failed: 0 };

  const pending = await prisma.smsMessage.findMany({
    where: { status: 'PENDING' },
    orderBy: { id: 'asc' },
    take: limit,
  });

  let sent = 0;
  let failed = 0;
  for (const message of pending) {
    try {
      const result = await provider.send(message.recipient, message.text);
      await prisma.smsMessage.update({
        where: { id: message.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          attempts: { increment: 1 },
          providerRef: result.providerRef,
          lastError: null,
        },
      });
      sent++;
    } catch (err) {
      const attempts = message.attempts + 1;
      await prisma.smsMessage.update({
        where: { id: message.id },
        data: {
          attempts,
          status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
          lastError: err instanceof Error ? err.message.slice(0, 300) : 'خطای ناشناخته',
        },
      });
      failed++;
    }
  }
  return { sent, failed };
}

/** سابقه پیامک‌های یک حواله، تازه‌ترین اول. */
export function messagesOfReceipt(receiptId: number) {
  return prisma.smsMessage.findMany({
    where: { receiptId },
    orderBy: { id: 'desc' },
    select: {
      id: true,
      recipient: true,
      recipientKind: true,
      event: true,
      text: true,
      status: true,
      attempts: true,
      lastError: true,
      createdAt: true,
      sentAt: true,
    },
  });
}

let timer: NodeJS.Timeout | null = null;

/** هر نیم دقیقه صف را خالی می‌کند. فقط از server/index.ts صدا زده می‌شود. */
export function startSmsWorker(intervalMs = 30_000) {
  if (timer) return;
  timer = setInterval(() => {
    void processPending().catch((err) => console.error('[sms] خطا در پردازش صف:', err));
  }, intervalMs);
  timer.unref();
}
