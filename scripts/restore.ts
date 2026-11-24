/**
 * بازیابی دیتابیس از فایل بکاپ.
 *
 * ⚠️ پیش از اجرا، سامانه باید **متوقف** باشد. اگر سرور در حال اجرا باشد،
 * بازیابی می‌تواند دیتابیس را خراب کند.
 *
 * اجرا:  npm run restore -- backups\ard-2026-09-21_08-00.db
 *
 * این اسکریپت سه کار می‌کند:
 *   ۱. سالم بودن فایل بکاپ را بررسی می‌کند (فایل خراب هرگز جایگزین نمی‌شود)
 *   ۲. از دیتابیس فعلی یک نسخه احتیاطی می‌گیرد
 *   ۳. بکاپ را جایگزین می‌کند
 */
import 'dotenv/config';
import { copyFileSync, existsSync, renameSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

function currentDbPath(): string {
  const url = process.env.DATABASE_URL ?? '';
  const match = url.match(/^file:(.+)$/);
  if (!match) {
    throw new Error('متغیر DATABASE_URL تنظیم نشده یا فرمتش شناخته نشد.');
  }
  // مسیر نسبی در schema، نسبت به پوشه prisma معنا دارد
  const raw = match[1]!.trim();
  return resolve(raw.startsWith('.') ? resolve('prisma', raw) : raw);
}

/** بررسی می‌کند فایل بکاپ واقعاً یک دیتابیس سالم است. */
async function verifyBackup(path: string): Promise<number> {
  const prisma = new PrismaClient({ datasources: { db: { url: `file:${path}` } } });
  try {
    const check = await prisma.$queryRawUnsafe<{ integrity_check: string }[]>(
      'PRAGMA integrity_check',
    );
    const result = check[0]?.integrity_check;
    if (result !== 'ok') {
      throw new Error(`فایل بکاپ سالم نیست (نتیجه بررسی: ${result ?? 'نامشخص'}).`);
    }

    const receipts = await prisma.receipt.count();
    return receipts;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const source = process.argv[2];
  if (!source) {
    console.error('مسیر فایل بکاپ را بدهید. مثال:');
    console.error('  npm run restore -- backups\\ard-2026-09-21_08-00.db');
    process.exit(1);
  }

  const backupPath = resolve(source);
  if (!existsSync(backupPath)) {
    console.error(`✖ فایل پیدا نشد: ${backupPath}`);
    process.exit(1);
  }

  console.log('در حال بررسی سلامت فایل بکاپ…');
  const receiptCount = await verifyBackup(backupPath);
  console.log(`✔ فایل سالم است و شامل ${receiptCount.toLocaleString('fa-IR')} حواله است.`);

  const target = currentDbPath();

  // نسخه احتیاطی از وضعیت فعلی — تا اگر بازیابی اشتباه بود، راه برگشت باشد
  if (existsSync(target)) {
    const safety = `${target}.before-restore-${Date.now()}`;
    renameSync(target, safety);
    console.log(`نسخه احتیاطی از دیتابیس فعلی: ${safety}`);
  }

  copyFileSync(backupPath, target);
  const sizeMb = (statSync(target).size / 1024 / 1024).toFixed(2);

  console.log(`✔ بازیابی انجام شد: ${target} (${sizeMb} مگابایت)`);
  console.log('حالا می‌توانید سامانه را دوباره راه‌اندازی کنید.');
}

main().catch((err) => {
  console.error('✖ بازیابی ناموفق بود:', err);
  process.exit(1);
});
