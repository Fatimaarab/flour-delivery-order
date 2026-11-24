import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';

/**
 * انبار و موجودی.
 *
 * ── قاعده‌ای که همیشه باید برقرار بماند ──────────────────────────────────
 *        موجودی انبار  ≥  مقدار رزروشده  ≥  صفر
 *
 * «موجودی» یعنی آنچه فیزیکاً در انبار است. «رزرو» یعنی بخشی از همان موجودی
 * که به حواله‌های صادرشده و هنوز بارگیری‌نشده تعلق گرفته است. «قابل تخصیص»
 * یعنی تفاوت این دو — تنها چیزی که می‌توان برای حواله جدید کنار گذاشت.
 *
 * هر عملیاتی که این قاعده را بشکند رد می‌شود. مثلاً نمی‌توان موجودی را با
 * اصلاح دستی آن‌قدر کم کرد که از رزروهای موجود کمتر شود — چون آن رزروها
 * تعهد به مشتریانی هستند که حواله‌شان صادر شده.
 * ─────────────────────────────────────────────────────────────────────────
 */

export interface StockRow {
  productId: number;
  code: string;
  name: string;
  bagWeightKg: number;
  onHandKg: number;
  reservedKg: number;
  availableKg: number;
}

export async function listStock(): Promise<StockRow[]> {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    include: { stock: true },
    orderBy: [{ pricingCategory: 'asc' }, { name: 'asc' }],
  });

  return products.map((p) => {
    const onHandKg = p.stock?.onHandKg ?? 0;
    const reservedKg = p.stock?.reservedKg ?? 0;
    return {
      productId: p.id,
      code: p.code,
      name: p.name,
      bagWeightKg: p.bagWeightKg,
      onHandKg,
      reservedKg,
      availableKg: onHandKg - reservedKg,
    };
  });
}

export interface ProductionInput {
  productId: number;
  quantityKg: number;
  note?: string;
  userId: number;
  ipAddress?: string;
}

/** ثبت تولید روزانه — موجودی انبار را افزایش می‌دهد. */
export async function recordProduction(input: ProductionInput) {
  if (!Number.isInteger(input.quantityKg) || input.quantityKg <= 0) {
    throw badRequest('مقدار تولید باید عددی صحیح و بزرگ‌تر از صفر باشد.');
  }

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: input.productId, deletedAt: null },
    });
    if (!product) throw notFound('محصولی با این شناسه پیدا نشد.');

    const stock = await tx.stock.upsert({
      where: { productId: product.id },
      update: { onHandKg: { increment: input.quantityKg } },
      create: { productId: product.id, onHandKg: input.quantityKg, reservedKg: 0 },
    });

    await tx.stockMovement.create({
      data: {
        productId: product.id,
        type: 'PRODUCTION',
        quantityKg: input.quantityKg,
        note: input.note?.trim() || null,
        userId: input.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        entityType: 'Stock',
        entityId: product.id,
        action: 'PRODUCTION',
        changes: JSON.stringify({ quantityKg: input.quantityKg, note: input.note ?? null }),
        userId: input.userId,
        ipAddress: input.ipAddress ?? null,
      },
    });

    return stock;
  });
}

export interface AdjustmentInput {
  productId: number;
  /** مقدار جدید موجودی (نه تفاوت) */
  newOnHandKg: number;
  reason: string;
  userId: number;
  ipAddress?: string;
}

/**
 * اصلاح دستی موجودی — مثلاً پس از انبارگردانی.
 *
 * دلیل اجباری است، چون این تنها راهی است که موجودی بدون یک رویداد واقعی
 * (تولید، بارگیری، مرجوعی) تغییر می‌کند و باید قابل پاسخ‌گویی باشد.
 */
export async function adjustStock(input: AdjustmentInput) {
  if (!Number.isInteger(input.newOnHandKg) || input.newOnHandKg < 0) {
    throw badRequest('موجودی جدید باید عددی صحیح و نامنفی باشد.');
  }
  if (!input.reason.trim()) {
    throw badRequest('برای اصلاح دستی موجودی، ثبت دلیل اجباری است.');
  }

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: input.productId, deletedAt: null },
      include: { stock: true },
    });
    if (!product) throw notFound('محصولی با این شناسه پیدا نشد.');

    const current = product.stock?.onHandKg ?? 0;
    const reserved = product.stock?.reservedKg ?? 0;

    // قاعده اصلی: موجودی نمی‌تواند از تعهدات رزروشده کمتر شود
    if (input.newOnHandKg < reserved) {
      throw conflict(
        `موجودی جدید نمی‌تواند از مقدار رزروشده کمتر باشد. ` +
          `هم‌اکنون ${(reserved / 1000).toFixed(1)} تُن از این محصول به حواله‌های ` +
          `صادرشده تعلق دارد. ابتدا آن حواله‌ها را ابطال یا بارگیری کنید.`,
      );
    }

    const delta = input.newOnHandKg - current;
    if (delta === 0) throw badRequest('موجودی جدید با موجودی فعلی یکسان است.');

    const stock = await tx.stock.upsert({
      where: { productId: product.id },
      update: { onHandKg: input.newOnHandKg },
      create: { productId: product.id, onHandKg: input.newOnHandKg, reservedKg: 0 },
    });

    await tx.stockMovement.create({
      data: {
        productId: product.id,
        type: 'ADJUSTMENT',
        quantityKg: delta,
        note: input.reason.trim(),
        userId: input.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        entityType: 'Stock',
        entityId: product.id,
        action: 'ADJUSTMENT',
        changes: JSON.stringify({ from: current, to: input.newOnHandKg, reason: input.reason }),
        userId: input.userId,
        ipAddress: input.ipAddress ?? null,
      },
    });

    return stock;
  });
}

/**
 * کاردکس انبار: گردش زمانی یک محصول با مانده متحرک.
 *
 * مانده متحرک از آخر به اول حساب می‌شود (از موجودی فعلی به عقب)، چون موجودی
 * فعلی عدد قطعی است و این تضمین می‌کند سطر آخر کاردکس همیشه با آن بخواند.
 */
export async function inventoryKardex(productId: number, limit = 200) {
  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
    include: { stock: true },
  });
  if (!product) throw notFound('محصولی با این شناسه پیدا نشد.');

  const movements = await prisma.stockMovement.findMany({
    where: { productId },
    include: {
      user: { select: { fullName: true } },
      receipt: { select: { receiptNumber: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const onHand = product.stock?.onHandKg ?? 0;

  // حرکت‌های رزرو روی موجودی فیزیکی اثر ندارند، پس در مانده لحظه‌ای نمی‌آیند
  const affectsOnHand = (type: string) =>
    type === 'PRODUCTION' || type === 'ISSUE' || type === 'RETURN' || type === 'ADJUSTMENT';

  let running = onHand;
  const rows = movements.map((m) => {
    const balanceAfter = running;
    if (affectsOnHand(m.type)) running -= m.quantityKg;
    return {
      id: m.id,
      type: m.type,
      quantityKg: m.quantityKg,
      note: m.note,
      createdAt: m.createdAt,
      user: m.user.fullName,
      receiptNumber: m.receipt?.receiptNumber ?? null,
      balanceAfter: affectsOnHand(m.type) ? balanceAfter : null,
    };
  });

  return {
    product: {
      id: product.id,
      code: product.code,
      name: product.name,
      bagWeightKg: product.bagWeightKg,
      onHandKg: onHand,
      reservedKg: product.stock?.reservedKg ?? 0,
      availableKg: onHand - (product.stock?.reservedKg ?? 0),
    },
    movements: rows,
  };
}
