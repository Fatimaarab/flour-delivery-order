import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { asyncRoute } from '../../middleware/errorHandler.js';
import { requirePermission } from '../../middleware/authorize.js';
import { clientIp, recordAudit } from '../audit/service.js';
import { ROLES } from '../../../shared/permissions.js';
import { hashPassword } from '../auth/service.js';

const roleSchema = z.enum(ROLES);

const createSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'نام کاربری باید دست‌کم ۳ نویسه باشد.')
    .regex(/^[a-zA-Z0-9._-]+$/, 'نام کاربری فقط می‌تواند حروف انگلیسی، عدد، نقطه و خط تیره باشد.'),
  password: z.string().min(8, 'رمز عبور باید دست‌کم ۸ نویسه باشد.'),
  fullName: z.string().trim().min(1, 'نام و نام خانوادگی را وارد کنید.'),
  role: roleSchema,
});

const updateSchema = z.object({
  fullName: z.string().trim().min(1).optional(),
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8, 'رمز عبور باید دست‌کم ۸ نویسه باشد.').optional(),
});

/** هرگز passwordHash را به بیرون نمی‌دهیم. */
const publicFields = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

export const usersRouter = Router();

usersRouter.use(requirePermission('user:manage'));

usersRouter.get(
  '/',
  asyncRoute(async (_req, res) => {
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: publicFields,
      orderBy: { createdAt: 'asc' },
    });
    res.json({ users });
  }),
);

usersRouter.post(
  '/',
  asyncRoute(async (req, res) => {
    const data = createSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { username: data.username } });
    if (existing) throw conflict('کاربری با این نام کاربری از قبل وجود دارد.');

    const user = await prisma.user.create({
      data: {
        username: data.username,
        fullName: data.fullName,
        role: data.role,
        passwordHash: await hashPassword(data.password),
      },
      select: publicFields,
    });

    await recordAudit({
      entityType: 'User',
      entityId: user.id,
      action: 'CREATE',
      changes: { username: user.username, role: user.role },
      userId: req.user!.userId,
      ipAddress: clientIp(req),
    });

    res.status(201).json({ user });
  }),
);

usersRouter.patch(
  '/:id',
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw badRequest('شناسه کاربر معتبر نیست.');

    const data = updateSchema.parse(req.body);
    const target = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!target) throw notFound('کاربری با این شناسه پیدا نشد.');

    // محافظت: مدیر نباید بتواند نقش یا دسترسی خودش را از خودش بگیرد و
    // سامانه را بدون هیچ مدیری رها کند.
    if (target.id === req.user!.userId) {
      if (data.role && data.role !== target.role) {
        throw badRequest('نمی‌توانید نقش خودتان را تغییر دهید.');
      }
      if (data.isActive === false) {
        throw badRequest('نمی‌توانید حساب خودتان را غیرفعال کنید.');
      }
    }

    if (target.role === 'ADMIN' && (data.role !== undefined || data.isActive === false)) {
      const otherAdmins = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true, deletedAt: null, id: { not: target.id } },
      });
      if (otherAdmins === 0) {
        throw badRequest('این تنها مدیر فعال سامانه است و نمی‌توان آن را تغییر داد.');
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(data.fullName !== undefined && { fullName: data.fullName }),
        ...(data.role !== undefined && { role: data.role }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.password !== undefined && {
          passwordHash: await hashPassword(data.password),
        }),
      },
      select: publicFields,
    });

    await recordAudit({
      entityType: 'User',
      entityId: user.id,
      action: data.password ? 'PASSWORD_RESET' : 'UPDATE',
      // رمز عبور هرگز در دفتر وقایع ثبت نمی‌شود، فقط این واقعه که عوض شده
      changes: { ...data, password: data.password ? '[تغییر کرد]' : undefined },
      userId: req.user!.userId,
      ipAddress: clientIp(req),
    });

    res.json({ user });
  }),
);

export const ROLE_OPTIONS = ROLES;
