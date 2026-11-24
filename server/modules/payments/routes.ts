import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { badRequest } from '../../lib/errors.js';
import { asyncRoute } from '../../middleware/errorHandler.js';
import { requirePermission } from '../../middleware/authorize.js';
import { clientIp } from '../audit/service.js';
import { PAYMENT_METHODS } from '../../../shared/finance.js';
import { customerStatement, recordPayment, voidPayment } from './service.js';

const paymentSchema = z.object({
  customerId: z.number().int().positive(),
  receiptId: z.number().int().positive().optional(),
  amount: z.number().int().positive('مبلغ پرداخت باید بزرگ‌تر از صفر باشد.'),
  method: z.enum(PAYMENT_METHODS),
  referenceNumber: z.string().trim().max(60).optional(),
  chequeDueDate: z.string().datetime().optional(),
  note: z.string().trim().max(300).optional(),
});

export const paymentsRouter = Router();

paymentsRouter.get(
  '/',
  requirePermission('payment:read'),
  asyncRoute(async (req, res) => {
    const customerId = Number(req.query.customerId) || undefined;
    const receiptId = Number(req.query.receiptId) || undefined;
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize ?? 25) || 25));

    const where = {
      deletedAt: null,
      ...(customerId && { customerId }),
      ...(receiptId && { receiptId }),
    };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          customer: { select: { id: true, code: true, name: true } },
          receipt: { select: { id: true, receiptNumber: true } },
          user: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({ payments, total, page, pageSize });
  }),
);

paymentsRouter.post(
  '/',
  requirePermission('payment:create'),
  asyncRoute(async (req, res) => {
    const data = paymentSchema.parse(req.body);

    const payment = await recordPayment({
      ...data,
      chequeDueDate: data.chequeDueDate ? new Date(data.chequeDueDate) : undefined,
      userId: req.user!.userId,
      ipAddress: clientIp(req),
    });

    res.status(201).json({ payment });
  }),
);

paymentsRouter.post(
  '/:id/void',
  requirePermission('payment:void'),
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw badRequest('شناسه پرداخت معتبر نیست.');

    const reason = z.object({ reason: z.string().trim().min(1) }).parse(req.body).reason;
    await voidPayment(id, reason, req.user!.userId, clientIp(req));

    res.json({ ok: true });
  }),
);

paymentsRouter.get(
  '/statement/:customerId',
  requirePermission('payment:read'),
  asyncRoute(async (req, res) => {
    const customerId = Number(req.params.customerId);
    if (!Number.isInteger(customerId)) throw badRequest('شناسه مشتری معتبر نیست.');

    res.json(await customerStatement(customerId));
  }),
);
