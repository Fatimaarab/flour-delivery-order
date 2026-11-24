import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { asyncRoute } from '../../middleware/errorHandler.js';
import { requirePermission } from '../../middleware/authorize.js';
import { clientIp, recordAudit } from '../audit/service.js';

const productSchema = z.object({
  code: z.string().trim().min(1, 'کد محصول را وارد کنید.').max(20),
  name: z.string().trim().min(1, 'نام محصول را وارد کنید.'),
  description: z.string().trim().optional(),
  bagWeightKg: z
    .number()
    .int('وزن کیسه باید عدد صحیح باشد.')
    .positive('وزن کیسه باید بیشتر از صفر باشد.')
    .max(200, 'وزن کیسه غیرمنطقی است.'),
  basePricePerKg: z
    .number()
    .int('قیمت باید عدد صحیح ریال باشد.')
    .nonnegative('قیمت نمی‌تواند منفی باشد.'),
  pricingCategory: z.enum(['SUBSIDISED', 'FREE']),
  vatPercent: z.number().int().min(0).max(100),
  isActive: z.boolean().optional(),
});

export const productsRouter = Router();

productsRouter.get(
  '/',
  requirePermission('product:read'),
  asyncRoute(async (_req, res) => {
    const products = await prisma.product.findMany({
      where: { deletedAt: null },
      include: { stock: true },
      orderBy: [{ pricingCategory: 'asc' }, { name: 'asc' }],
    });
    res.json({ products });
  }),
);

productsRouter.post(
  '/',
  requirePermission('product:write'),
  asyncRoute(async (req, res) => {
    const data = productSchema.parse(req.body);

    const existing = await prisma.product.findUnique({ where: { code: data.code } });
    if (existing) throw conflict('محصولی با این کد از قبل وجود دارد.');

    // محصول و موجودی اولیه‌اش باید با هم ساخته شوند، وگرنه محصولی بدون
    // رکورد موجودی می‌ماند و بعداً در بارگیری خطا می‌دهد.
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({ data });
      await tx.stock.create({ data: { productId: created.id, onHandKg: 0, reservedKg: 0 } });
      return created;
    });

    await recordAudit({
      entityType: 'Product',
      entityId: product.id,
      action: 'CREATE',
      changes: data,
      userId: req.user!.userId,
      ipAddress: clientIp(req),
    });

    res.status(201).json({ product });
  }),
);

productsRouter.patch(
  '/:id',
  requirePermission('product:write'),
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw badRequest('شناسه محصول معتبر نیست.');

    const data = productSchema.partial().parse(req.body);
    const existing = await prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('محصولی با این شناسه پیدا نشد.');

    if (data.code && data.code !== existing.code) {
      const clash = await prisma.product.findUnique({ where: { code: data.code } });
      if (clash) throw conflict('محصول دیگری با این کد وجود دارد.');
    }

    const product = await prisma.product.update({ where: { id }, data });

    await recordAudit({
      entityType: 'Product',
      entityId: id,
      action: 'UPDATE',
      changes: {
        before: {
          name: existing.name,
          basePricePerKg: String(existing.basePricePerKg),
          vatPercent: existing.vatPercent,
        },
        after: data,
      },
      userId: req.user!.userId,
      ipAddress: clientIp(req),
    });

    res.json({ product });
  }),
);
