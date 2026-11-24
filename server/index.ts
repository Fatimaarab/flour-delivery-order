import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { createApp } from './app.js';
import { loadConfigOrExit } from './lib/config.js';
import { getSmsProvider } from './modules/sms/provider.js';
import { startSmsWorker } from './modules/sms/service.js';
import { startBackupScheduler } from './lib/backup.js';

/**
 * شماره نسخه، روی پنجره اجرا.
 *
 * پنجره سیاه چیزی است که کاربر هنگام مشکل از آن عکس می‌فرستد؛ نوشتن نسخه
 * در آن یعنی در پشتیبانی دیگر لازم نیست حدس بزنیم کدام نسخه اجرا شده.
 */
function appVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? '?';
  } catch {
    return '?';
  }
}

/**
 * تنظیمات **پیش از** بالا آمدن سرور بررسی می‌شوند.
 *
 * اگر چیزی غلط باشد، سامانه همین‌جا با پیام روشن متوقف می‌شود — نه اینکه
 * سالم به نظر برسد و بعد اولین کاربر خطای بی‌معنی بگیرد.
 */
const config = loadConfigOrExit();

// تنظیم غلط پیامک باید همین‌جا معلوم شود، نه وقتی اولین پیامک نمی‌رود
let smsMode = 'off';
try {
  smsMode = getSmsProvider()?.name ?? 'off';
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

createApp().listen(config.port, () => {
  // انگلیسی، چون پنجره cmd ویندوز فارسی را به هم می‌ریزد
  console.log(`Ard Havaleh version ${appVersion()}`);
  console.log(`SMS: ${smsMode}`);
  if (smsMode !== 'off') startSmsWorker();
  startBackupScheduler((m) => console.log(m));
  console.log(`Automatic daily backup: ON (folder: ${process.env.BACKUP_DIR?.trim() || 'backups'})`);
  console.log(`سرور سامانه حواله آرد روی پورت ${config.port} در حال اجراست`);
});
