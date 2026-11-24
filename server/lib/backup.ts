import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { prisma } from './prisma.js';

/**
 * بکاپ دیتابیس — هم برای دستور `npm run backup` و هم برای بکاپ خودکار شبانه
 * داخل خود سرور.
 *
 * ── چرا کپی ساده فایل کافی نیست ──────────────────────────────────────────
 * اگر همان لحظه که فایل کپی می‌شود کسی در حال ثبت حواله باشد، کپی ممکن است
 * نیمه‌کاره و خراب شود. به‌جای آن از `VACUUM INTO` خود SQLite استفاده
 * می‌شود که یک نسخه **سالم و یکپارچه** می‌سازد، حتی وقتی سامانه کار می‌کند.
 *
 * ── نسخه دوم (BACKUP_COPY_DIR) ───────────────────────────────────────────
 * بکاپی که روی همان سرور بماند، با خرابی هارد همراه دیتابیس از بین می‌رود.
 * اگر این مسیر تنظیم شود (پوشه اشتراکی کامپیوتر دیگر، فلش، هارد اکسترنال)،
 * هر بکاپ همان لحظه به آنجا هم کپی می‌شود. نرسیدن به آن مسیر، خود بکاپ
 * اصلی را خراب نمی‌کند؛ فقط هشدار می‌دهد.
 * ─────────────────────────────────────────────────────────────────────────
 */

function keepCount(): number {
  const n = Number(process.env.BACKUP_KEEP ?? 30);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export function backupDir(): string {
  const dir = resolve(process.env.BACKUP_DIR?.trim() || 'backups');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function timestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `_${pad(d.getHours())}-${pad(d.getMinutes())}`
  );
}

const isBackupFile = (f: string) => f.startsWith('ard-') && f.endsWith('.db');

/** نسخه‌های قدیمی‌تر از سقف تعیین‌شده را پاک می‌کند. */
function pruneOld(dir: string): number {
  const files = readdirSync(dir)
    .filter(isBackupFile)
    .map((f) => ({ name: f, time: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);

  const stale = files.slice(keepCount());
  for (const f of stale) unlinkSync(join(dir, f.name));
  return stale.length;
}

/** زمان تازه‌ترین بکاپ داخل پوشه (میلی‌ثانیه)، یا null اگر هیچ‌کدام نیست. */
export function newestBackupTime(dir = backupDir()): number | null {
  const times = readdirSync(dir)
    .filter(isBackupFile)
    .map((f) => statSync(join(dir, f)).mtimeMs);
  return times.length ? Math.max(...times) : null;
}

export interface BackupResult {
  file: string;
  sizeMb: string;
  removed: number;
  /** مسیر نسخه دوم، اگر کپی شد */
  copiedTo: string | null;
  /** اگر نسخه دوم تنظیم بود ولی کپی نشد، دلیلش */
  copyError: string | null;
  skipped: boolean;
}

export async function runBackup(now = new Date()): Promise<BackupResult> {
  const dir = backupDir();
  const target = join(dir, `ard-${timestamp(now)}.db`);

  if (existsSync(target)) {
    return { file: target, sizeMb: '0', removed: 0, copiedTo: null, copyError: null, skipped: true };
  }

  // مسیر با اسلش نوشته می‌شود؛ بک‌اسلش ویندوز داخل رشته SQL مشکل‌ساز است
  const sqlPath = target.replace(/\\/g, '/').replace(/'/g, "''");
  await prisma.$executeRawUnsafe(`VACUUM INTO '${sqlPath}'`);

  const sizeMb = (statSync(target).size / 1024 / 1024).toFixed(2);
  const removed = pruneOld(dir);

  let copiedTo: string | null = null;
  let copyError: string | null = null;
  const copyDirRaw = process.env.BACKUP_COPY_DIR?.trim();
  if (copyDirRaw) {
    try {
      const copyDir = resolve(copyDirRaw);
      if (!existsSync(copyDir)) mkdirSync(copyDir, { recursive: true });
      const dest = join(copyDir, target.split(/[\\/]/).pop()!);
      copyFileSync(target, dest);
      pruneOld(copyDir);
      copiedTo = dest;
    } catch (err) {
      copyError = err instanceof Error ? err.message : String(err);
    }
  }

  return { file: target, sizeMb, removed, copiedTo, copyError, skipped: false };
}

const CHECK_EVERY_MS = 30 * 60 * 1000;
/** اگر آخرین بکاپ از این مدت قدیمی‌تر باشد، بکاپ تازه گرفته می‌شود. */
const MAX_AGE_MS = 23 * 60 * 60 * 1000;

/**
 * بکاپ خودکار: هر نیم‌ساعت بررسی می‌شود و اگر آخرین بکاپ از ۲۳ ساعت قدیمی‌تر
 * بود، بکاپ تازه گرفته می‌شود — یعنی روزی یک‌بار، بدون هیچ زمان‌بند بیرونی.
 *
 * مزیت بررسی به‌جای «ساعت ثابت»: اگر سرور ساعت بکاپ خاموش بود، پس از روشن
 * شدن همان اول بکاپ جبرانی گرفته می‌شود و یک شب هم جا نمی‌ماند.
 */
export function startBackupScheduler(log: (msg: string) => void = console.log): () => void {
  const tick = async () => {
    try {
      const newest = newestBackupTime();
      if (newest !== null && Date.now() - newest < MAX_AGE_MS) return;

      const r = await runBackup();
      if (r.skipped) return;
      log(`Backup OK: ${r.file} (${r.sizeMb} MB)`);
      if (r.copiedTo) log(`Backup copied to: ${r.copiedTo}`);
      if (r.copyError) {
        log(`WARNING: backup copy FAILED (${r.copyError}). Check BACKUP_COPY_DIR in .env`);
      }
    } catch (err) {
      log(`WARNING: automatic backup FAILED: ${err instanceof Error ? err.message : err}`);
    }
  };

  const first = setTimeout(() => void tick(), 60_000);
  const timer = setInterval(() => void tick(), CHECK_EVERY_MS);
  // نباید جلوی بسته شدن فرایند را بگیرند
  first.unref();
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
