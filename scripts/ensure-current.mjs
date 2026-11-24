/**
 * بررسی پیش از اجرا: آیا آنچه اجرا می‌شود، همان چیزی است که روی دیسک است؟
 *
 * ── چرا این فایل وجود دارد ───────────────────────────────────────────────
 * سامانه از پوشه `dist` سرو می‌شود: یک نسخه **ساخته‌شده** از رابط کاربری.
 * سرور از روی کد اصلی اجرا می‌شود، ولی مرورگر همان `dist` را می‌گیرد.
 *
 * نتیجه‌اش دامی بود که کاربر واقعاً در آن افتاد: فایل‌های نسخه تازه را روی
 * پوشه قبلی کپی کرد و `2-START.bat` را زد. سرور تازه بود، اما `dist`
 * قدیمی سر جایش مانده بود — پس **رابط کاربری دقیقاً همان نسخه قبلی ماند**
 * و هیچ‌کدام از اصلاح‌ها دیده نشد. هیچ پیام خطایی هم در کار نبود.
 *
 * حالا پیش از هر اجرا دو چیز بررسی می‌شود:
 *   ۱. مهاجرت‌های پایگاه داده اعمال شده باشند (بی‌ضرر است اگر قبلاً باشند)
 *   ۲. اگر کد از `dist` تازه‌تر است، رابط کاربری دوباره ساخته شود
 *
 * خروجی کامل در `update-log.txt` می‌ماند؛ روی صفحه فقط یک خط.
 * متن‌ها انگلیسی‌اند چون پنجره cmd ویندوز فارسی را درست نشان نمی‌دهد.
 * ────────────────────────────────────────────────────────────────────────
 */

import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOG = join(ROOT, 'update-log.txt');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

/** پوشه‌هایی که رابط کاربری از آن‌ها ساخته می‌شود. */
const SOURCE_PATHS = ['src', 'shared', 'public', 'index.html', 'package.json'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'data', 'backups']);

function log(text) {
  try {
    appendFileSync(LOG, text + '\n', 'utf8');
  } catch {
    // نبودن اجازه نوشتن لاگ نباید جلوی اجرای سامانه را بگیرد
  }
}

function say(text) {
  console.log(text);
  log(text);
}

function run(label, args) {
  log(`\n=== ${label}  (${NPM} ${args.join(' ')})`);
  const res = spawnSync(NPM, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (res.stdout) log(res.stdout);
  if (res.stderr) log(res.stderr);
  return res.status === 0;
}

/** تازه‌ترین زمان تغییر در میان فایل‌های کد. */
function newestSourceTime(path, depth = 0) {
  if (depth > 8) return 0;
  let newest = 0;
  let info;
  try {
    info = statSync(path);
  } catch {
    return 0;
  }
  if (info.isFile()) return info.mtimeMs;
  for (const entry of readdirSync(path)) {
    if (SKIP_DIRS.has(entry) || entry.startsWith('.')) continue;
    newest = Math.max(newest, newestSourceTime(join(path, entry), depth + 1));
  }
  return newest;
}

log(`\n${'='.repeat(60)}\n${new Date().toISOString()}  —  pre-start check`);

// ---- ۰) بسته‌های تازه ----
// اگر نسخه تازه بسته‌ای اضافه کرده باشد، بدون این مرحله سرور سر اولین
// import خطا می‌دهد. مقایسه با فایلی که خود npm پس از نصب می‌نویسد.
const lockStamp = join(ROOT, 'node_modules', '.package-lock.json');
if (existsSync(lockStamp)) {
  const installedAt = statSync(lockStamp).mtimeMs;
  const manifestAt = Math.max(
    ...['package.json', 'package-lock.json']
      .map((f) => join(ROOT, f))
      .filter((f) => existsSync(f))
      .map((f) => statSync(f).mtimeMs),
  );
  if (manifestAt > installedAt) {
    say('   New components are needed. Downloading, please wait...');
    if (!run('npm install', ['install', '--no-audit', '--no-fund'])) {
      say('[warn] Download failed (internet?). See update-log.txt');
    }
  }
}

// ---- ۱) مهاجرت‌های پایگاه داده ----
// اگر نسخه تازه ستون تازه‌ای خواسته باشد و این اجرا نشود، سامانه بالا
// می‌آید ولی سر اولین ذخیره خطا می‌دهد.
if (!run('prisma migrate deploy', ['exec', '--', 'prisma', 'migrate', 'deploy'])) {
  say('[warn] Database update failed. See update-log.txt');
}

// ---- ۲) ساخت دوباره رابط کاربری، فقط اگر لازم باشد ----
const builtAt = existsSync(join(ROOT, 'dist', 'index.html'))
  ? statSync(join(ROOT, 'dist', 'index.html')).mtimeMs
  : 0;
const sourceAt = Math.max(...SOURCE_PATHS.map((p) => newestSourceTime(join(ROOT, p))));

log(`dist built at ${new Date(builtAt).toISOString()}`);
log(`newest source  ${new Date(sourceAt).toISOString()}`);

if (sourceAt > builtAt) {
  say('');
  say('   A newer version was found. Rebuilding the app, please wait...');
  if (run('vite build', ['run', 'build'])) {
    say('   Done. Starting...');
    say('');
  } else {
    say('[warn] Rebuild failed. See update-log.txt');
    say('       The system will start with the previous version.');
  }
}
