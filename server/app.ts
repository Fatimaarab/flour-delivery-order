import express from 'express';
import cookieParser from 'cookie-parser';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authenticate } from './middleware/authenticate.js';
import { authRouter } from './modules/auth/routes.js';
import { usersRouter } from './modules/users/routes.js';
import { productsRouter } from './modules/products/routes.js';
import { customersRouter } from './modules/customers/routes.js';
import { receiptsRouter } from './modules/receipts/routes.js';
import { paymentsRouter } from './modules/payments/routes.js';
import { inventoryRouter } from './modules/inventory/routes.js';
import { driversRouter } from './modules/drivers/routes.js';
import { reportsRouter } from './modules/reports/routes.js';
import { smsRouter } from './modules/sms/routes.js';
import { prisma } from './lib/prisma.js';
import { serializeBigInt } from './lib/json.js';

export function createApp() {
  const app = express();

  // سامانه پشت شبکه داخلی کارخانه است و از طریق پراکسی سرو می‌شود؛
  // این تنظیم لازم است تا IP واقعی کاربر در audit log ثبت شود نه IP پراکسی.
  app.set('trust proxy', true);

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // مبالغ ریالی در دیتابیس BigInt هستند و JSON آن را نمی‌شناسد؛ این لایه
  // همه پاسخ‌ها را پیش از ارسال تبدیل می‌کند تا هر مسیر مجبور نباشد خودش
  // این کار را یادش بماند.
  app.use((_req, res, next) => {
    const original = res.json.bind(res);
    res.json = (body: unknown) => original(serializeBigInt(body));
    next();
  });

  // هویت کاربر روی هر درخواست تشخیص داده می‌شود؛ مسدودسازی کار authorize است
  app.use(authenticate);

  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, db: 'connected', time: new Date().toISOString() });
    } catch {
      res.status(503).json({ ok: false, db: 'unreachable' });
    }
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/customers', customersRouter);
  app.use('/api/receipts', receiptsRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/drivers', driversRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/sms', smsRouter);

  app.use('/api', notFoundHandler);

  /**
   * در محیط عملیاتی، همین سرور فایل‌های ساخته‌شده فرانت‌اند را هم سرو می‌کند.
   *
   * نتیجه: روی سرور کارخانه فقط **یک فرایند و یک پورت** اجرا می‌شود، نه دو
   * تا. راه‌اندازی، نگه‌داری و تنظیم فایروال همگی ساده‌تر می‌شوند.
   *
   * در حالت توسعه این بخش غیرفعال است و Vite خودش فرانت‌اند را سرو می‌کند.
   */
  const distDir = join(process.cwd(), 'dist');
  if (existsSync(join(distDir, 'index.html'))) {
    /*
     * ── چرا این دو سیاست کش متفاوت‌اند ──────────────────────────────────
     * نام فایل‌های داخل assets شامل اثر انگشت محتواست (مثل
     * `index-D0EkrLqM.js`). هر تغییری در کد، نام فایل را عوض می‌کند، پس
     * نگه‌داشتن طولانی‌مدتشان در مرورگر بی‌خطر است.
     *
     * اما `index.html` همیشه یک نام دارد و هم اوست که می‌گوید کدام فایل
     * assets را باید گرفت. اگر مرورگر نسخه کهنه‌اش را از کش بخواند، کاربر
     * پس از به‌روزرسانی هم **همان رابط کاربری قدیمی** را می‌بیند — بدون
     * هیچ خطایی. پس عمداً هرگز کش نمی‌شود.
     * ────────────────────────────────────────────────────────────────────
     */
    app.use(
      express.static(distDir, {
        index: false,
        maxAge: '365d',
        setHeaders(res, filePath) {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-store');
          }
        },
      }),
    );

    // هر مسیری که API نباشد به برنامه تک‌صفحه‌ای سپرده می‌شود
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(join(distDir, 'index.html'));
    });
  }

  app.use(errorHandler);

  return app;
}
