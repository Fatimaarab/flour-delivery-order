import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { unauthorized } from '../../lib/errors.js';
import { asyncRoute } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/authorize.js';
import { clientIp, recordAudit } from '../audit/service.js';
import { permissionsOf, type Role } from '../../../shared/permissions.js';
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyPassword,
} from './service.js';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'نام کاربری را وارد کنید.'),
  password: z.string().min(1, 'رمز عبور را وارد کنید.'),
});

export const authRouter = Router();

authRouter.post(
  '/login',
  asyncRoute(async (req, res) => {
    const { username, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { username } });

    // پیام خطا عمداً یکسان است چه کاربر وجود نداشته باشد و چه رمز غلط باشد،
    // تا نتوان با آزمون‌وخطا فهمید کدام نام‌های کاربری واقعی‌اند.
    const invalid = unauthorized('نام کاربری یا رمز عبور اشتباه است.');

    if (!user || !user.isActive || user.deletedAt) throw invalid;
    if (!(await verifyPassword(password, user.passwordHash))) throw invalid;

    const role = user.role as Role;
    const token = await createSessionToken({
      userId: user.id,
      username: user.username,
      role,
      fullName: user.fullName,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await recordAudit({
      entityType: 'User',
      entityId: user.id,
      action: 'LOGIN',
      userId: user.id,
      ipAddress: clientIp(req),
    });

    res.cookie(SESSION_COOKIE, token, sessionCookieOptions);
    res.json({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role,
      },
      permissions: permissionsOf(role),
    });
  }),
);

authRouter.post(
  '/logout',
  asyncRoute(async (req, res) => {
    if (req.user) {
      await recordAudit({
        entityType: 'User',
        entityId: req.user.userId,
        action: 'LOGOUT',
        userId: req.user.userId,
        ipAddress: clientIp(req),
      });
    }
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  }),
);

/** کاربر فعلی — مرورگر با این می‌فهمد چه کسی وارد است و چه منویی ببیند. */
authRouter.get(
  '/me',
  requireAuth,
  asyncRoute(async (req, res) => {
    const session = req.user!;
    res.json({
      user: {
        id: session.userId,
        username: session.username,
        fullName: session.fullName,
        role: session.role,
      },
      permissions: permissionsOf(session.role),
    });
  }),
);
