import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { asyncRoute } from '../../middleware/errorHandler.js';
import { requirePermission } from '../../middleware/authorize.js';
import { clientIp, recordAudit } from '../audit/service.js';
import { digitsOnly } from '../../../shared/digits.js';
import { isValidMobile, isValidNationalId } from '../../../shared/nationalId.js';
import { formatPlate, parsePlate } from '../../../shared/plate.js';

/**
 * رانندگان.
 *
 * راننده یک‌بار اینجا تعریف می‌شود و در حواله فقط با جستجو انتخاب می‌شود؛
 * در خود حواله هیچ راننده‌ای تعریف نمی‌شود. کد ملی اجباری و یکتاست، پس یک
 * راننده دوبار با دو نام مختلف ثبت نمی‌شود.
 */

const driverSchema = z.object({
  fullName: z.string().trim().min(2, 'نام راننده را وارد کنید.').max(100),
  nationalId: z.string().trim().min(1, 'کد ملی راننده اجباری است.'),
  mobile: z.string().trim().optional(),
  plateNumber: z.string().trim().optional(),
});

/** ورودی را اعتبارسنجی و یکدست می‌کند (ارقام لاتین، پلاک استاندارد). */
function normalize(input: z.infer<typeof driverSchema>) {
  const nationalId = digitsOnly(input.nationalId);
  if (!isValidNationalId(nationalId)) {
    throw badRequest('کد ملی راننده معتبر نیست (باید ۱۰ رقم با رقم کنترلی درست باشد).');
  }

  const mobile = input.mobile ? digitsOnly(input.mobile) : '';
  if (mobile && !isValidMobile(mobile)) {
    throw badRequest('شماره موبایل راننده باید ۱۱ رقم و با ۰۹ شروع شود.');
  }

  const plateInput = input.plateNumber?.trim() ?? '';
  const plate = plateInput ? parsePlate(plateInput) : null;
  if (plateInput && !plate) {
    throw badRequest('پلاک خودرو معتبر نیست. قالب درست: ۴۲ ع ۳۱۷ ایران ۳۶');
  }

  return {
    fullName: input.fullName.trim(),
    nationalId,
    mobile: mobile || null,
    plateNumber: plate ? formatPlate(plate) : null,
  };
}

export const driversRouter = Router();

/** فهرست و جستجو (نام، کد ملی، موبایل یا بخشی از پلاک). */
driversRouter.get(
  '/',
  requirePermission('driver:read'),
  asyncRoute(async (req, res) => {
    const q = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const digits = q ? digitsOnly(q) : '';
    const includeInactive = req.query.all === '1';

    const drivers = await prisma.driver.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        ...(q && {
          OR: [
            { fullName: { contains: q } },
            ...(digits
              ? [{ nationalId: { contains: digits } }, { mobile: { contains: digits } }, { plateNumber: { contains: digits } }]
              : []),
          ],
        }),
      },
      orderBy: { fullName: 'asc' },
      take: 100,
    });

    res.json({ drivers });
  }),
);

driversRouter.post(
  '/',
  requirePermission('driver:write'),
  asyncRoute(async (req, res) => {
    const data = normalize(driverSchema.parse(req.body));

    const existing = await prisma.driver.findUnique({ where: { nationalId: data.nationalId } });
    if (existing) {
      throw conflict(`راننده‌ای با این کد ملی قبلاً ثبت شده است: ${existing.fullName}.`);
    }

    const driver = await prisma.driver.create({ data });
    await recordAudit({
      entityType: 'Driver',
      entityId: driver.id,
      action: 'CREATE',
      changes: data,
      userId: req.user!.userId,
      ipAddress: clientIp(req),
    });
    res.status(201).json({ driver });
  }),
);

driversRouter.patch(
  '/:id',
  requirePermission('driver:write'),
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw badRequest('شناسه راننده معتبر نیست.');

    const body = driverSchema.extend({ isActive: z.boolean().optional() }).parse(req.body);
    const data = normalize(body);

    const current = await prisma.driver.findUnique({ where: { id } });
    if (!current) throw notFound('راننده‌ای با این شناسه پیدا نشد.');

    const clash = await prisma.driver.findUnique({ where: { nationalId: data.nationalId } });
    if (clash && clash.id !== id) {
      throw conflict(`راننده دیگری با این کد ملی ثبت شده است: ${clash.fullName}.`);
    }

    // حواله‌های صادرشده نسخه خودشان را دارند و با این ویرایش تغییر نمی‌کنند
    const driver = await prisma.driver.update({
      where: { id },
      data: { ...data, ...(body.isActive !== undefined && { isActive: body.isActive }) },
    });
    await recordAudit({
      entityType: 'Driver',
      entityId: id,
      action: 'UPDATE',
      changes: { ...data, isActive: driver.isActive },
      userId: req.user!.userId,
      ipAddress: clientIp(req),
    });
    res.json({ driver });
  }),
);
