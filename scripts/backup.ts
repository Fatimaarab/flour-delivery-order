/**
 * بکاپ دستی دیتابیس.
 *
 * منطق اصلی در server/lib/backup.ts است و همان را بکاپ خودکار شبانه هم
 * استفاده می‌کند. اجرا:  npm run backup
 */
import 'dotenv/config';
import { runBackup } from '../server/lib/backup.js';
import { prisma } from '../server/lib/prisma.js';

async function main() {
  const r = await runBackup();
  if (r.skipped) {
    console.log(`بکاپ این دقیقه از قبل وجود دارد: ${r.file}`);
    return;
  }
  console.log(`✔ بکاپ ساخته شد: ${r.file} (${r.sizeMb} مگابایت)`);
  if (r.removed > 0) console.log(`  ${r.removed} نسخه قدیمی پاک شد`);
  if (r.copiedTo) console.log(`✔ نسخه دوم: ${r.copiedTo}`);
  if (r.copyError) {
    console.error(`⚠ نسخه دوم ساخته نشد: ${r.copyError}`);
    process.exitCode = 2;
  }
}

main()
  .catch((err) => {
    console.error('✖ بکاپ ناموفق بود:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
