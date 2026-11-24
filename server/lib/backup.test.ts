import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newestBackupTime, runBackup } from './backup.js';

const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'ard-backup-'));
  dirs.push(d);
  return d;
};

afterEach(() => {
  delete process.env.BACKUP_DIR;
  delete process.env.BACKUP_COPY_DIR;
  delete process.env.BACKUP_KEEP;
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('بکاپ دیتابیس', () => {
  it('یک فایل سالم SQLite می‌سازد', async () => {
    process.env.BACKUP_DIR = tmp();
    const r = await runBackup();
    expect(existsSync(r.file)).toBe(true);
    expect(readFileSync(r.file).subarray(0, 15).toString()).toBe('SQLite format 3');
    expect(newestBackupTime()).not.toBeNull();
  });

  it('نسخه دوم را هم در مسیر دیگر می‌گذارد', async () => {
    process.env.BACKUP_DIR = tmp();
    const copy = tmp();
    process.env.BACKUP_COPY_DIR = copy;
    const r = await runBackup();
    expect(r.copyError).toBeNull();
    expect(readdirSync(copy)).toHaveLength(1);
    expect(r.copiedTo).toContain(copy);
  });

  // نرسیدن به نسخه دوم نباید بکاپ اصلی را خراب کند
  it('اگر نسخه دوم ممکن نباشد، بکاپ اصلی سر جایش است و خطا گزارش می‌شود', async () => {
    process.env.BACKUP_DIR = tmp();
    const blocker = join(tmp(), 'file-not-folder');
    writeFileSync(blocker, 'x');
    process.env.BACKUP_COPY_DIR = join(blocker, 'sub'); // زیر یک فایل، ساخته نمی‌شود

    const r = await runBackup();
    expect(existsSync(r.file)).toBe(true);
    expect(r.copiedTo).toBeNull();
    expect(r.copyError).toBeTruthy();
  });

  it('فقط به تعداد BACKUP_KEEP نگه می‌دارد', async () => {
    const dir = tmp();
    process.env.BACKUP_DIR = dir;
    process.env.BACKUP_KEEP = '2';
    for (let i = 0; i < 4; i++) {
      await runBackup(new Date(2026, 0, 1, 10, i));
      await new Promise((r) => setTimeout(r, 15));
    }
    expect(readdirSync(dir).filter((f) => f.endsWith('.db'))).toHaveLength(2);
  });

  it('بکاپ دوم در همان دقیقه، رد می‌شود', async () => {
    process.env.BACKUP_DIR = tmp();
    const t = new Date(2026, 5, 1, 12, 30);
    await runBackup(t);
    expect((await runBackup(t)).skipped).toBe(true);
  });
});
