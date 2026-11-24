import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { asyncRoute } from '../../middleware/errorHandler.js';
import { requirePermission } from '../../middleware/authorize.js';
import { clientIp, recordAudit } from '../audit/service.js';
import { digitsOnly } from '../../../shared/digits.js';
import { isValidMobile, isValidPartyId } from '../../../shared/nationalId.js';

const baseSchema = z.object({
  code: z.string().trim().min(1, 'کد مشتری را وارد کنید.').max(30),
  kind: z.enum(['INDIVIDUAL', 'COMPANY']),
  type: z.enum(['BAKERY', 'GUILD_INDUSTRY', 'WHOLESALER']),
  name: z.string().trim().min(1, 'نام مشتری را وارد کنید.'),
  nationalId: z.string().trim().optional(),
  economicCode: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  creditLimit: z.number().int().nonnegative('سقف اعتبار نمی‌تواند منفی باشد.'),
  monthlyQuotaKg: z.number().int().nonnegative('سهمیه نمی‌تواند منفی باشد.'),
  isActive: z.boolean().optional(),
});

/**
 * اعتبارسنجی سمت سرور — نه فقط سمت مرورگر.
 *
 * کد ملی و شناسه ملی رقم کنترلی دارند، پس غلط تایپی بدون هیچ استعلامی قابل
 * تشخیص است. برای سندی که پای مالیات و حسابرسی در میان است این مهم است.
 */
function validateIdentifiers(data: z.infer<typeof baseSchema>) {
  const issues: { field: string; message: string }[] = [];

  if (data.nationalId) {
    const cleaned = digitsOnly(data.nationalId);
    if (!isValidPartyId(cleaned, data.kind)) {
      issues.push({
        field: 'nationalId',
        message:
          data.kind === 'INDIVIDUAL'
            ? 'کد ملی معتبر نیست (باید ۱۰ رقم با رقم کنترلی درست باشد).'
            : 'شناسه ملی معتبر نیست (باید ۱۱ رقم با رقم کنترلی درست باشد).',
      });
    }
  }

  if (data.phone && data.phone.length > 0) {
    const cleaned = digitsOnly(data.phone);
    // تلفن ثابت هم پذیرفته می‌شود؛ فقط اگر شبیه موبایل باشد سخت‌گیری می‌کنیم
    if (cleaned.startsWith('09') && !isValidMobile(cleaned)) {
      issues.push({ field: 'phone', message: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.' });
    }
  }

  if (issues.length > 0) {
    throw badRequest('اطلاعات وارد شده معتبر نیست.', issues);
  }
}

/** ارقام فارسی را پیش از ذخیره به لاتین تبدیل می‌کند تا جستجو بعداً کار کند. */
function normalize(data: z.infer<typeof baseSchema>) {
  return {
    ...data,
    nationalId: data.nationalId ? digitsOnly(data.nationalId) : null,
    economicCode: data.economicCode ? digitsOnly(data.economicCode) : null,
    phone: data.phone ? digitsOnly(data.phone) : null,
    address: data.address || null,
    description: undefined,
  };
}

export const customersRouter = Router();

customersRouter.get(
  '/',
  requirePermission('customer:read'),
  asyncRoute(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const customers = await prisma.customer.findMany({
      where: {
        deletedAt: null,
        ...(search && {
          OR: [
            { name: { contains: search } },
            { code: { contains: search } },
            // جستجوی عددی روی ارقام لاتینِ ذخیره‌شده انجام می‌شود
            { nationalId: { contains: digitsOnly(search) || search } },
            { phone: { contains: digitsOnly(search) || search } },
          ],
        }),
      },
      orderBy: { name: 'asc' },
    });

    res.json({ customers });
  }),
);

customersRouter.post(
  '/',
  requirePermission('customer:write'),
  asyncRoute(async (req, res) => {
    const data = baseSchema.parse(req.body);
    validateIdentifiers(data);

    const existing = await prisma.customer.findUnique({ where: { code: data.code } });
    if (existing) throw conflict('مشتری‌ای با این کد از قبل وجود دارد.');

    const { description: _drop, ...payload } = normalize(data);
    const customer = await prisma.customer.create({ data: payload });

    await recordAudit({
      entityType: 'Customer',
      entityId: customer.id,
      action: 'CREATE',
      changes: { code: customer.code, name: customer.name },
      userId: req.user!.userId,
      ipAddress: clientIp(req),
    });

    res.status(201).json({ customer });
  }),
);

customersRouter.patch(
  '/:id',
  requirePermission('customer:write'),
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw badRequest('شناسه مشتری معتبر نیست.');

    const existing = await prisma.customer.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound('مشتری‌ای با این شناسه پیدا نشد.');

    // برای اعتبارسنجی شناسه، باید مقادیر تازه و قدیم را با هم ببینیم
    const merged = baseSchema.parse({
      code: existing.code,
      kind: existing.kind,
      type: existing.type,
      name: existing.name,
      nationalId: existing.nationalId ?? undefined,
      economicCode: existing.economicCode ?? undefined,
      phone: existing.phone ?? undefined,
      address: existing.address ?? undefined,
      creditLimit: Number(existing.creditLimit),
      monthlyQuotaKg: existing.monthlyQuotaKg,
      ...(req.body as Record<string, unknown>),
    });
    validateIdentifiers(merged);

    if (merged.code !== existing.code) {
      const clash = await prisma.customer.findUnique({ where: { code: merged.code } });
      if (clash) throw conflict('مشتری دیگری با این کد وجود دارد.');
    }

    const { description: _drop, ...payload } = normalize(merged);
    const customer = await prisma.customer.update({ where: { id }, data: payload });

    await recordAudit({
      entityType: 'Customer',
      entityId: id,
      action: 'UPDATE',
      changes: {
        before: { name: existing.name, creditLimit: String(existing.creditLimit) },
        after: { name: customer.name, creditLimit: String(customer.creditLimit) },
      },
      userId: req.user!.userId,
      ipAddress: clientIp(req),
    });

    res.json({ customer });
  }),
);
