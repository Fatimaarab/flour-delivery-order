import { Router } from 'express';
import { badRequest } from '../../lib/errors.js';
import { asyncRoute } from '../../middleware/errorHandler.js';
import { requirePermission } from '../../middleware/authorize.js';
import { messagesOfReceipt, processPending, queueManual, smsEnabled } from './service.js';

export const smsRouter = Router();

/** سابقه پیامک‌های یک حواله، و اینکه پیامک اصلاً روشن است یا نه. */
smsRouter.get(
  '/receipts/:receiptId',
  requirePermission('receipt:read'),
  asyncRoute(async (req, res) => {
    const receiptId = Number(req.params.receiptId);
    if (!Number.isInteger(receiptId)) throw badRequest('شناسه حواله معتبر نیست.');

    res.json({ enabled: smsEnabled(), messages: await messagesOfReceipt(receiptId) });
  }),
);

/** ارسال دستی (دکمه «ارسال پیامک»). */
smsRouter.post(
  '/receipts/:receiptId/send',
  requirePermission('sms:send'),
  asyncRoute(async (req, res) => {
    const receiptId = Number(req.params.receiptId);
    if (!Number.isInteger(receiptId)) throw badRequest('شناسه حواله معتبر نیست.');

    const queued = await queueManual(receiptId, req.user!.userId);
    // همان لحظه تلاش می‌کنیم تا کاربر منتظر نوبت بعدی صف نماند؛ اگر نشد،
    // پیامک در صف می‌ماند و خودکار دوباره تلاش می‌شود.
    await processPending().catch(() => undefined);

    res.json({ queued, messages: await messagesOfReceipt(receiptId) });
  }),
);
