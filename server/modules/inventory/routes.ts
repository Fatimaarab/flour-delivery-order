import { Router } from 'express';
import { z } from 'zod';
import { badRequest } from '../../lib/errors.js';
import { asyncRoute } from '../../middleware/errorHandler.js';
import { requirePermission } from '../../middleware/authorize.js';
import { clientIp } from '../audit/service.js';
import { adjustStock, inventoryKardex, listStock, recordProduction } from './service.js';

export const inventoryRouter = Router();

inventoryRouter.get(
  '/',
  requirePermission('inventory:read'),
  asyncRoute(async (_req, res) => {
    res.json({ stock: await listStock() });
  }),
);

inventoryRouter.get(
  '/kardex/:productId',
  requirePermission('inventory:read'),
  asyncRoute(async (req, res) => {
    const productId = Number(req.params.productId);
    if (!Number.isInteger(productId)) throw badRequest('شناسه محصول معتبر نیست.');

    res.json(await inventoryKardex(productId));
  }),
);

inventoryRouter.post(
  '/production',
  requirePermission('inventory:produce'),
  asyncRoute(async (req, res) => {
    const data = z
      .object({
        productId: z.number().int().positive(),
        quantityKg: z.number().int().positive('مقدار تولید باید بزرگ‌تر از صفر باشد.'),
        note: z.string().trim().max(300).optional(),
      })
      .parse(req.body);

    const stock = await recordProduction({
      ...data,
      userId: req.user!.userId,
      ipAddress: clientIp(req),
    });

    res.status(201).json({ stock });
  }),
);

inventoryRouter.post(
  '/adjust',
  requirePermission('inventory:adjust'),
  asyncRoute(async (req, res) => {
    const data = z
      .object({
        productId: z.number().int().positive(),
        newOnHandKg: z.number().int().nonnegative(),
        reason: z.string().trim().min(1, 'ثبت دلیل اجباری است.'),
      })
      .parse(req.body);

    const stock = await adjustStock({
      ...data,
      userId: req.user!.userId,
      ipAddress: clientIp(req),
    });

    res.json({ stock });
  }),
);
