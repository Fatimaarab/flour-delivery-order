import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { asyncRoute } from '../../middleware/errorHandler.js';
import { requirePermission } from '../../middleware/authorize.js';
import { clientIp, recordAudit } from '../audit/service.js';
import {
  allowedTransitions,
  isEditable,
  RECEIPT_STATUSES,
  type ReceiptStatus,
} from '../../../shared/receiptStateMachine.js';
import type { Role } from '../../../shared/permissions.js';
import { createDraft, transitionReceipt, updateDraftItems } from './service.js';
import { processPending, queueReceiptIssued } from '../sms/service.js';

const itemSchema = z.object({
  productId: z.number().int().positive(),
  bagCount: z.number().int().positive('تعداد کیسه باید بیشتر از صفر باشد.'),
  unitPricePerKg: z.number().int().nonnegative().optional(),
});

const draftSchema = z.object({
  customerId: z.number().int().positive('مشتری را انتخاب کنید.'),
  items: z.array(itemSchema).min(1, 'دست‌کم یک قلم کالا لازم است.'),
  discount: z.number().int().nonnegative().optional(),
  notes: z.string().trim().max(500).optional(),
  driverId: z.number({ message: 'راننده را انتخاب کنید.' }).int().positive('راننده را انتخاب کنید.'),
  haulType: z.enum(['COMPANY', 'SELF'], { message: 'نوع حمل را انتخاب کنید.' }),
  carrierCompany: z.string().trim().max(100).optional(),
});

const transitionSchema = z.object({
  to: z.enum(RECEIPT_STATUSES),
  reason: z.string().trim().max(500).optional(),
});

const includeFull = {
  customer: { select: { id: true, code: true, name: true, kind: true, type: true } },
  issuedBy: { select: { id: true, fullName: true, username: true } },
  items: { include: { product: { select: { id: true, code: true, name: true } } } },
} as const;

export const receiptsRouter = Router();

receiptsRouter.get(
  '/',
  requirePermission('receipt:read'),
  asyncRoute(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize ?? 25) || 25));

    const where = {
      deletedAt: null,
      ...(status && RECEIPT_STATUSES.includes(status as ReceiptStatus)
        ? { status: status as ReceiptStatus }
        : {}),
      ...(search && {
        OR: [
          { receiptNumber: { contains: search } },
          { customer: { name: { contains: search } } },
          { customer: { code: { contains: search } } },
        ],
      }),
    };

    // صفحه‌بندی از ابتدا، تا فهرست با هزاران حواله هم سریع بماند
    const [receipts, total] = await Promise.all([
      prisma.receipt.findMany({
        where,
        include: includeFull,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.receipt.count({ where }),
    ]);

    res.json({ receipts, total, page, pageSize });
  }),
);

receiptsRouter.get(
  '/:id',
  requirePermission('receipt:read'),
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw badRequest('شناسه حواله معتبر نیست.');

    const receipt = await prisma.receipt.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...includeFull,
        shipment: true,
        statusLogs: {
          include: { user: { select: { fullName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!receipt) throw notFound('حواله‌ای با این شناسه پیدا نشد.');

    res.json({
      receipt,
      editable: isEditable(receipt.status as ReceiptStatus),
      transitions: allowedTransitions(
        receipt.status as ReceiptStatus,
        req.user!.role as Role,
        receipt.validUntil,
      ),
    });
  }),
);

/**
 * داده لازم برای چاپ برگه حواله و فاکتور.
 *
 * نام کارخانه از تنظیمات می‌آید تا داخل کد هاردکد نباشد و اگر نام رسمی عوض
 * شد، فقط یک تنظیم تغییر کند نه کد.
 */
receiptsRouter.get(
  '/:id/print',
  requirePermission('receipt:read'),
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw badRequest('شناسه حواله معتبر نیست.');

    const [receipt, company] = await Promise.all([
      prisma.receipt.findFirst({
        where: { id, deletedAt: null },
        include: {
          customer: true,
          issuedBy: { select: { id: true, fullName: true, username: true } },
          items: { include: { product: { select: { id: true, code: true, name: true } } } },
          shipment: true,
        },
      }),
      prisma.setting.findUnique({ where: { key: 'company_name' } }),
    ]);

    if (!receipt) throw notFound('حواله‌ای با این شناسه پیدا نشد.');

    res.json({ receipt, companyName: company?.value ?? null });
  }),
);

receiptsRouter.post(
  '/',
  requirePermission('receipt:create'),
  asyncRoute(async (req, res) => {
    const data = draftSchema.parse(req.body);

    // کلید جلوگیری از ثبت تکراری را مرورگر هنگام باز کردن فرم می‌سازد
    const key = req.header('Idempotency-Key')?.trim() || undefined;

    const { receiptId, reused } = await createDraft(
      { ...data, idempotencyKey: key },
      req.user!.userId,
    );

    if (!reused) {
      await recordAudit({
        entityType: 'Receipt',
        entityId: receiptId,
        action: 'CREATE',
        changes: { customerId: data.customerId, itemCount: data.items.length },
        userId: req.user!.userId,
        ipAddress: clientIp(req),
      });
    }

    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId },
      include: includeFull,
    });

    res.status(reused ? 200 : 201).json({ receipt, reused });
  }),
);

/**
 * ویرایش حواله — فقط در وضعیت پیش‌نویس.
 *
 * پس از «صادر شده»، سند رسمی است و تنها راه اصلاح، ابطال و صدور اصلاحیه است.
 */
receiptsRouter.patch(
  '/:id',
  requirePermission('receipt:create'),
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw badRequest('شناسه حواله معتبر نیست.');

    const existing = await prisma.receipt.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('حواله‌ای با این شناسه پیدا نشد.');

    if (!isEditable(existing.status as ReceiptStatus)) {
      throw conflict(
        'این حواله صادر شده و دیگر قابل ویرایش نیست. برای اصلاح، آن را ابطال و حواله اصلاحیه صادر کنید.',
      );
    }

    const data = draftSchema.parse(req.body);

    await updateDraftItems(id, data, req.user!.userId);

    await recordAudit({
      entityType: 'Receipt',
      entityId: id,
      action: 'UPDATE',
      changes: { itemCount: data.items.length },
      userId: req.user!.userId,
      ipAddress: clientIp(req),
    });

    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: includeFull,
    });
    res.json({ receipt });
  }),
);

receiptsRouter.post(
  '/:id/transition',
  requirePermission('receipt:read'),
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw badRequest('شناسه حواله معتبر نیست.');

    const { to, reason } = transitionSchema.parse(req.body);

    const receipt = await transitionReceipt({
      receiptId: id,
      to,
      role: req.user!.role as Role,
      userId: req.user!.userId,
      ipAddress: clientIp(req),
      reason,
    });

    // پس از صدور نهایی، پیامک‌ها در صف می‌روند. این کار عمداً **بعد از**
    // ثبت حواله و بیرون از تراکنش آن است: خرابی پیامک نباید صدور را برگرداند.
    if (to === 'ISSUED') {
      await queueReceiptIssued(receipt.id, req.user!.userId);
      void processPending().catch(() => undefined);
    }


    res.json({
      receipt,
      transitions: allowedTransitions(
        receipt.status as ReceiptStatus,
        req.user!.role as Role,
        receipt.validUntil,
      ),
    });
  }),
);
