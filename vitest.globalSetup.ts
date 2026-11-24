import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';

/**
 * آماده‌سازی یک دیتابیس جداگانه برای تست‌ها.
 *
 * تا پیش از این، تست‌ها روی همان دیتابیس دمو اجرا می‌شدند و ده‌ها مشتری و
 * حواله آزمایشی در آن می‌ساختند. حالا هر بار تست‌ها روی یک دیتابیس تازه و
 * خالی اجرا می‌شوند و دیتابیس دمو دست‌نخورده می‌ماند.
 */
export default function setup() {
  const dir = 'prisma/data';
  const dbPath = `${dir}/test.db`;

  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const file = `${dbPath}${suffix}`;
    if (existsSync(file)) rmSync(file);
  }

  const env = { ...process.env, DATABASE_URL: 'file:./data/test.db' };
  execSync('npx prisma migrate deploy', { env, stdio: 'pipe' });
  execSync('npx tsx prisma/seed.ts', { env, stdio: 'pipe' });
}
