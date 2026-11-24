import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict } from '../../lib/errors.js';
import { calculateReceipt, CalcError, type CalcItemInput } from '../../../shared/receiptCalc.js';
import {
  checkTransition,
  type ReceiptStatus,
} from '../../../shared/receiptStateMachine.js';
import type { Role } from '../../../shared/permissions.js';
import { nextReceiptNumber } from './serial.js';

/** تعداد روز اعتبار پیش‌فرض حواله، از تنظیمات سامانه. */
async function validityDays(tx: Prisma.TransactionClient): Promise<number> {
  const row = await tx.setting.findUnique({ where: { key: 'receipt_validity_days' } });
  const days = Number(row?.value ?? '7');
  return Number.isFinite(days) && days > 0 ? days : 7;
}

export interface DraftItemInput {
  productId: number;
  bagCount: number;
  /** اگر داده نشود، قیمت پایه محصول استفاده می‌شود */
  unitPricePerKg?: number;
}

export interface CreateDraftInput {
  customerId: number;
  items: DraftItemInput[];
  discount?: number;
  notes?: string;
  /** راننده تعریف‌شده در بخش «رانندگان» — اجباری */
  driverId: number;
  /** حمل با شرکت یا خود مشتری — اجباری */
  haulType: 'COMPANY' | 'SELF';
  carrierCompany?: string;
  idempotencyKey?: string;
}

/**
 * مشخصات راننده را روی حواله می‌نشاند.
 *
 * مشخصات او **کپی** می‌شود، نه فقط به او اشاره شود: اگر بعداً نام یا پلاک
 * راننده در بخش «رانندگان» عوض شد، برگه‌های صادرشده باید همان بمانند که
 * چاپ شده‌اند.
 */
async function attachDriver(tx: Prisma.TransactionClient, receiptId: number, input: CreateDraftInput) {
  const driver = await tx.driver.findFirst({ where: { id: input.driverId, isActive: true } });
  if (!driver) throw badRequest('راننده انتخاب‌شده معتبر یا فعال نیست.');

  const data = {
    driverId: driver.id,
    driverName: driver.fullName,
    driverNationalId: driver.nationalId,
    driverMobile: driver.mobile,
    plateNumber: driver.plateNumber,
    haulType: input.haulType,
    // «خود حمل» یعنی شرکتی در کار نیست
    carrierCompany: input.haulType === 'COMPANY' ? input.carrierCompany?.trim() || null : null,
  };

  await tx.shipment.upsert({
    where: { receiptId },
    update: data,
    create: { receiptId, ...data },
  });
}

/**
 * ساخت پیش‌نویس حواله.
 *
 * تمام محاسبات مالی اینجا و از روی **قیمت واقعی محصول در دیتابیس** انجام
 * می‌شود. مبلغی که مرورگر می‌فرستد هرگز مبنا نیست.
 */
export async function createDraft(
  input: CreateDraftInput,
  userId: number,
): Promise<{ receiptId: number; reused: boolean }> {
  if (input.items.length === 0) {
    throw badRequest('حواله باید دست‌کم یک قلم کالا داشته باشد.');
  }

  // جلوگیری از ثبت تکراری: اگر همین کلید قبلاً ثبت شده، همان حواله برگردانده
  // می‌شود — نه یک حواله دوم. این جلوی دوبار کلیک کردن کاربر را می‌گیرد.
  if (input.idempotencyKey) {
    const existing = await prisma.receipt.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true },
    });
    if (existing) return { receiptId: existing.id, reused: true };
  }

  const receiptId = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: input.customerId, deletedAt: null, isActive: true },
    });
    if (!customer) throw badRequest('مشتری انتخاب‌شده معتبر یا فعال نیست.');

    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, deletedAt: null, isActive: true },
    });

    if (products.length !== productIds.length) {
      throw badRequest('یکی از محصولات انتخاب‌شده معتبر یا فعال نیست.');
    }
    const byId = new Map(products.map((p) => [p.id, p]));

    const calcInput: CalcItemInput[] = input.items.map((item) => {
      const product = byId.get(item.productId)!;
      return {
        bagCount: item.bagCount,
        bagWeightKg: product.bagWeightKg,
        // قیمت از دیتابیس می‌آید؛ قیمت دستی فقط اگر صریحاً داده شود
        unitPricePerKg: item.unitPricePerKg ?? Number(product.basePricePerKg),
        vatPercent: product.vatPercent,
      };
    });

    let calc;
    try {
      calc = calculateReceipt(calcInput, input.discount ?? 0);
    } catch (err) {
      throw err instanceof CalcError ? badRequest(err.message) : err;
    }

    const days = await validityDays(tx);
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + days);

    const receipt = await tx.receipt.create({
      data: {
        receiptNumber: await nextReceiptNumber(tx),
        status: 'DRAFT',
        customerId: customer.id,
        issuedById: userId,
        validUntil,
        subtotal: BigInt(calc.subtotal),
        discount: BigInt(calc.discount),
        vatAmount: BigInt(calc.vatAmount),
        grandTotal: BigInt(calc.grandTotal),
        totalWeightKg: calc.totalWeightKg,
        notes: input.notes?.trim() || null,
        idempotencyKey: input.idempotencyKey ?? null,
        items: {
          create: calc.items.map((ci, index) => ({
            productId: input.items[index]!.productId,
            bagCount: ci.bagCount,
            bagWeightKg: ci.bagWeightKg,
            weightKg: ci.weightKg,
            unitPricePerKg: BigInt(ci.unitPricePerKg),
            lineTotal: BigInt(ci.lineTotal),
            vatPercent: ci.vatPercent,
            vatAmount: BigInt(ci.vatAmount),
          })),
        },
      },
    });

    await attachDriver(tx, receipt.id, input);
    return receipt.id;
  });

  return { receiptId, reused: false };
}

export interface TransitionInput {
  receiptId: number;
  to: ReceiptStatus;
  role: Role;
  userId: number;
  ipAddress?: string;
  reason?: string;
}

/**
 * تغییر وضعیت حواله، همراه با اثرش روی موجودی انبار — همه در یک تراکنش.
 *
 * یا همه‌چیز با هم اتفاق می‌افتد (تغییر وضعیت + حرکت انبار + ثبت تاریخچه) یا
 * هیچ‌کدام. حالت میانی — مثلاً حواله صادر شود ولی موجودی رزرو نشود — ممکن نیست.
 */
export async function transitionReceipt(input: TransitionInput) {
  return prisma.$transaction(async (tx) => {
    const receipt = await tx.receipt.findFirst({
      where: { id: input.receiptId, deletedAt: null },
      include: { items: true },
    });
    if (!receipt) throw badRequest('حواله‌ای با این شناسه پیدا نشد.');

    const from = receipt.status as ReceiptStatus;
    const check = checkTransition(from, input.to, input.role, receipt.validUntil);

    if (!check.allowed) throw conflict(check.reason ?? 'این تغییر وضعیت مجاز نیست.');

    const transition = check.transition!;
    if (transition.requiresReason && !input.reason?.trim()) {
      throw badRequest(`برای «${transition.action}» ثبت دلیل اجباری است.`);
    }

    /**
     * بدهکار شدن مشتری — هنگام **صدور** حواله.
     *
     * ── چرا اینجا و نه در تأیید مالی ─────────────────────────────────────
     * پیش از این، بدهی مشتری در مرحله «تأیید مالی» ثبت می‌شد و همان‌جا هم
     * سقف اعتبار کنترل می‌شد. آن مرحله به درخواست کارفرما حذف شده است.
     *
     * اگر این بخش همان‌جا می‌ماند، هیچ حواله‌ای دیگر بدهی ثبت نمی‌کرد، اما
     * ابطال همان حواله همچنان بستانکاری ثبت می‌کرد — یعنی مانده مشتری با هر
     * ابطال به اشتباه مثبت می‌شد. پس ثبت بدهی به لحظه صدور منتقل شد تا
     * بدهکار و بستانکار همیشه قرینه هم بمانند.
     *
     * کنترل سقف اعتبار همراه خود مرحله تأیید مالی برداشته شد: سقف اعتبار
     * دیگر در فرم مشتری قابل تنظیم نیست و برای مشتری‌های تازه صفر است؛
     * نگه‌داشتن آن یعنی هیچ حواله‌ای صادر نشود.
     * ────────────────────────────────────────────────────────────────────
     */
    if (input.to === 'ISSUED') {
      // حواله بدون راننده (مثلاً پیش‌نویس قدیمی) صادر نمی‌شود؛ کد ملی راننده اجباری است
      const shipment = await tx.shipment.findUnique({ where: { receiptId: receipt.id } });
      if (!shipment?.driverName || !shipment.driverNationalId) {
        throw badRequest('پیش از صدور، راننده را انتخاب کنید (کد ملی راننده اجباری است).');
      }

      const customer = await tx.customer.findUnique({ where: { id: receipt.customerId } });
      if (!customer) throw badRequest('مشتری این حواله پیدا نشد.');

      /**
       * کل مبلغ حواله به حساب مشتری بدهکار می‌شود — نه فقط بخش پرداخت‌نشده.
       *
       * دلیلش این است که پرداخت‌ها جداگانه به حساب بستانکار می‌شوند. اگر
       * اینجا فقط باقی‌مانده بدهکار شود، پرداختی که **پیش از** صدور انجام
       * شده دوبار به سود مشتری حساب می‌شود و مانده‌اش اشتباه مثبت می‌ماند.
       *
       * با این مدل، هر سه حالت درست درمی‌آید:
       *   • پرداخت کامل پیش از صدور: (+کل) سپس (−کل) = صفر
       *   • بدون پرداخت: (−کل) = بدهی کامل
       *   • پرداخت جزئی: (+بخشی) سپس (−کل) = بدهی باقی‌مانده
       */
      await tx.customer.update({
        where: { id: customer.id },
        data: { balance: { decrement: receipt.grandTotal } },
      });
    }

    /**
     * ابطال، مرجوعی یا انقضای حواله‌ای که صادر شده: بدهی ایجادشده باید
     * برگردد، وگرنه مشتری برای حواله‌ای که باطل شده بدهکار می‌ماند.
     *
     * پیش‌نویس هرگز بدهی نساخته، پس تنها همان مستثناست.
     */
    if (
      (input.to === 'CANCELLED' || input.to === 'RETURNED' || input.to === 'EXPIRED') &&
      from !== 'DRAFT'
    ) {
      // قرینه همان بدهکاری که هنگام صدور ثبت شد. اگر مشتری پولی پرداخت
      // کرده باشد، آن مبلغ به‌صورت بستانکاری روی حسابش باقی می‌ماند — که درست
      // است، چون پول او نزد کارخانه است.
      await tx.customer.update({
        where: { id: receipt.customerId },
        data: { balance: { increment: receipt.grandTotal } },
      });
    }

    if (transition.effect) {
      await applyStockEffect(tx, receipt.id, receipt.items, transition.effect, input.userId);
    }

    const updated = await tx.receipt.update({
      where: { id: receipt.id },
      data: { status: input.to },
    });

    // ثبت زمان و نگهبان تأییدکننده خروج
    if (input.to === 'DISPATCHED') {
      await tx.shipment.updateMany({
        where: { receiptId: receipt.id },
        data: { dispatchedAt: new Date(), gateUserId: input.userId },
      });
    }

    await tx.receiptStatusLog.create({
      data: {
        receiptId: receipt.id,
        fromStatus: from,
        toStatus: input.to,
        userId: input.userId,
        ipAddress: input.ipAddress ?? null,
        reason: input.reason?.trim() || null,
      },
    });

    await tx.auditLog.create({
      data: {
        entityType: 'Receipt',
        entityId: receipt.id,
        action: 'STATUS_CHANGE',
        changes: JSON.stringify({ from, to: input.to, reason: input.reason ?? null }),
        userId: input.userId,
        ipAddress: input.ipAddress ?? null,
      },
    });

    return updated;
  });
}

type ReceiptItemRow = { productId: number; weightKg: number };

/**
 * اعمال اثر یک گذار روی موجودی انبار.
 *
 * رزرو هنگام صدور انجام می‌شود (نه هنگام بارگیری) تا موجودی‌ای که برای یک
 * حواله کنار گذاشته شده، توسط حواله بعدی فروخته نشود.
 */
async function applyStockEffect(
  tx: Prisma.TransactionClient,
  receiptId: number,
  items: ReceiptItemRow[],
  effect: NonNullable<import('../../../shared/receiptStateMachine.js').StockEffect>,
  userId: number,
) {
  for (const item of items) {
    const stock = await tx.stock.findUnique({ where: { productId: item.productId } });
    if (!stock) throw badRequest('برای یکی از محصولات، رکورد موجودی وجود ندارد.');

    let onHand = stock.onHandKg;
    let reserved = stock.reservedKg;
    let movement: { type: 'RESERVE' | 'RELEASE_RESERVE' | 'ISSUE' | 'RETURN'; qty: number };

    switch (effect) {
      case 'RESERVE': {
        const available = onHand - reserved;
        if (item.weightKg > available) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          throw conflict(
            `موجودی «${product?.name ?? 'محصول'}» کافی نیست. ` +
              `قابل تخصیص: ${(available / 1000).toFixed(1)} تُن، درخواست: ${(item.weightKg / 1000).toFixed(1)} تُن.`,
          );
        }
        reserved += item.weightKg;
        movement = { type: 'RESERVE', qty: -item.weightKg };
        break;
      }
      case 'RELEASE_RESERVE':
        reserved = Math.max(0, reserved - item.weightKg);
        movement = { type: 'RELEASE_RESERVE', qty: item.weightKg };
        break;
      case 'ISSUE':
        // بار واقعاً از انبار خارج می‌شود: هم از موجودی کم می‌شود هم رزرو آزاد
        onHand -= item.weightKg;
        reserved = Math.max(0, reserved - item.weightKg);
        movement = { type: 'ISSUE', qty: -item.weightKg };
        break;
      case 'RETURN':
        onHand += item.weightKg;
        movement = { type: 'RETURN', qty: item.weightKg };
        break;
    }

    await tx.stock.update({
      where: { productId: item.productId },
      data: { onHandKg: onHand, reservedKg: reserved },
    });

    await tx.stockMovement.create({
      data: {
        productId: item.productId,
        type: movement.type,
        quantityKg: movement.qty,
        receiptId,
        userId,
      },
    });
  }
}

/**
 * به‌روزرسانی اقلام یک پیش‌نویس، با نگه‌داشتن همان شماره سریال.
 *
 * شماره حواله عمداً دست‌نخورده می‌ماند: سریال یک‌بار مصرف است و نباید با هر
 * ویرایش عوض شود، وگرنه دنباله شماره‌ها سوراخ می‌شود.
 */
export async function updateDraftItems(
  receiptId: number,
  input: Omit<CreateDraftInput, 'idempotencyKey'>,
  _userId: number,
) {
  return prisma.$transaction(async (tx) => {
    const receipt = await tx.receipt.findFirst({
      where: { id: receiptId, deletedAt: null },
    });
    if (!receipt) throw badRequest('حواله‌ای با این شناسه پیدا نشد.');
    if (receipt.status !== 'DRAFT') {
      throw conflict('فقط پیش‌نویس قابل ویرایش است.');
    }

    const customer = await tx.customer.findFirst({
      where: { id: input.customerId, deletedAt: null, isActive: true },
    });
    if (!customer) throw badRequest('مشتری انتخاب‌شده معتبر یا فعال نیست.');

    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, deletedAt: null, isActive: true },
    });
    if (products.length !== productIds.length) {
      throw badRequest('یکی از محصولات انتخاب‌شده معتبر یا فعال نیست.');
    }
    const byId = new Map(products.map((p) => [p.id, p]));

    const calcInput: CalcItemInput[] = input.items.map((item) => {
      const product = byId.get(item.productId)!;
      return {
        bagCount: item.bagCount,
        bagWeightKg: product.bagWeightKg,
        unitPricePerKg: item.unitPricePerKg ?? Number(product.basePricePerKg),
        vatPercent: product.vatPercent,
      };
    });

    let calc;
    try {
      calc = calculateReceipt(calcInput, input.discount ?? 0);
    } catch (err) {
      throw err instanceof CalcError ? badRequest(err.message) : err;
    }

    await tx.receiptItem.deleteMany({ where: { receiptId } });
    await attachDriver(tx, receiptId, { ...input, idempotencyKey: undefined });

    return tx.receipt.update({
      where: { id: receiptId },
      data: {
        customerId: customer.id,
        subtotal: BigInt(calc.subtotal),
        discount: BigInt(calc.discount),
        vatAmount: BigInt(calc.vatAmount),
        grandTotal: BigInt(calc.grandTotal),
        totalWeightKg: calc.totalWeightKg,
        notes: input.notes?.trim() || null,
        items: {
          create: calc.items.map((ci, index) => ({
            productId: input.items[index]!.productId,
            bagCount: ci.bagCount,
            bagWeightKg: ci.bagWeightKg,
            weightKg: ci.weightKg,
            unitPricePerKg: BigInt(ci.unitPricePerKg),
            lineTotal: BigInt(ci.lineTotal),
            vatPercent: ci.vatPercent,
            vatAmount: BigInt(ci.vatAmount),
          })),
        },
      },
    });
  });
}
