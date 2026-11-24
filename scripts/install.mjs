/**
 * نصب‌کننده سامانه.
 *
 * ── چرا اینجا و نه داخل فایل .bat ────────────────────────────────────────
 * منطق نصب قبلاً تماماً در `1-INSTALL.bat` بود. مشکلش این نبود که batch بد
 * است؛ مشکل این بود که **قابل آزمایش نبود** — روی مک اجرا نمی‌شود، پس هر
 * تغییری در آن تا وقتی روی ویندوز اجرا نمی‌شد، آزمایش‌نشده می‌ماند.
 *
 * حالا فایل .bat فقط یک کار می‌کند: مطمئن می‌شود Node نصب است. بقیه کارها
 * اینجاست که هم روی ویندوز اجرا می‌شود و هم پیش از تحویل آزمایش می‌شود.
 *
 * متن‌ها انگلیسی‌اند چون پنجره cmd فارسی را درست نشان نمی‌دهد. راهنمای
 * فارسی در START-HERE.md است.
 * ────────────────────────────────────────────────────────────────────────
 */

import { spawnSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { appendFileSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOG = join(ROOT, 'install-log.txt');

const MIN_NODE_MAJOR = 20;

/**
 * `--production`: نصب روی سرور واقعی کارخانه — بدون داده نمونه، با یک کاربر
 * مدیر که رمزش تصادفی ساخته می‌شود.
 */
const PRODUCTION = process.argv.includes('--production');

/** رمز تصادفی ۱۲ نویسه‌ای، بدون نویسه‌های شبیه هم (0/O و 1/l/I). */
function randomPassword(len = 12) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: len }, () => chars[randomInt(chars.length)]).join('');
}
const ADMIN_PASSWORD = PRODUCTION ? randomPassword() : null;
const PASSWORD_FILE = join(ROOT, 'admin-password.txt');

/**
 * مسیر فایل پایگاه داده.
 *
 * `DATABASE_URL` در .env به شکل `file:./data/ard.db` است و Prisma آن را
 * نسبت به پوشه‌ای که schema در آن است حساب می‌کند — یعنی `prisma/`.
 */
const DB_FILE = join(ROOT, 'prisma', 'data', 'ard.db');

/*
 * این را باید **پیش از** هر کاری خواند: مرحله setup خودش فایل پایگاه داده
 * را می‌سازد، پس بررسی بعد از آن همیشه «وجود دارد» می‌دهد.
 */
const IS_UPDATE = existsSync(DB_FILE);

/** روی ویندوز، npm یک فایل .cmd است و بدون پسوند پیدا نمی‌شود. */
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const line = '='.repeat(60);

function log(text) {
  appendFileSync(LOG, text + '\n', 'utf8');
}

function say(text) {
  console.log(text);
  log(text);
}

/**
 * اجرای یک دستور npm.
 *
 * خروجی کامل در فایل لاگ می‌رود و فقط یک خط روی صفحه می‌ماند. دلیلش این
 * است که npm صدها خط چاپ می‌کند و کاربر غیرفنی در آن حجم، پیام خطا را
 * پیدا نمی‌کند — ولی همان خطا برای تشخیص لازم است، پس دور ریخته نمی‌شود.
 */
function run(label, args, extraEnv = {}) {
  log('\n' + line);
  log(`=== ${label}  (${NPM} ${args.join(' ')})`);
  log(line);

  const res = spawnSync(NPM, args, {
    cwd: ROOT,
    encoding: 'utf8',
    // بدون این، روی ویندوز فایل‌های .cmd اجرا نمی‌شوند
    shell: process.platform === 'win32',
    env: { ...process.env, ...extraEnv },
  });

  if (res.stdout) log(res.stdout);
  if (res.stderr) log(res.stderr);

  if (res.error) {
    log(`spawn error: ${res.error.message}`);
    return false;
  }
  return res.status === 0;
}

/** چند خط آخر لاگ، برای وقتی که کاربر نمی‌تواند فایل را بفرستد. */
function tailOfLog(n = 20) {
  try {
    const all = readFileSync(LOG, 'utf8').split('\n').filter((l) => l.trim());
    return all.slice(-n).join('\n');
  } catch {
    return '(log file could not be read)';
  }
}

function fail(step, hint) {
  // دم لاگ پیش از نوشتن خط نتیجه خوانده می‌شود، وگرنه خودِ همان خط
  // داخل «آخرین خطوط لاگ» تکرار می‌شود و گیج‌کننده است.
  const tail = tailOfLog();
  log(`\nRESULT: FAILED while ${step}`);
  console.log('');
  console.log(line);
  console.log('   INSTALL DID NOT FINISH');
  console.log(line);
  console.log('');
  console.log(`   Failed while: ${step}`);
  console.log('');
  if (hint) {
    console.log(hint);
    console.log('');
  }
  console.log('   ---- last lines of the log ----');
  console.log(tail);
  console.log('   -------------------------------');
  console.log('');
  console.log('   The full log is saved next to 1-INSTALL.bat :');
  console.log('       install-log.txt');
  console.log('');
  console.log('   Send that ONE file for help. It has everything needed.');
  console.log('');
  process.exit(1);
}

// ─────────────────────────── شروع ───────────────────────────

writeFileSync(LOG, '', 'utf8');
log('Ard Havaleh install log');
log(line);
log(`Date:     ${new Date().toISOString()}`);
log(`Folder:   ${ROOT}`);
log(`Platform: ${process.platform} ${process.arch}`);
log(`Node:     ${process.version}`);
log('');

console.log('');
console.log(line);
console.log('   ARD HAVALEH - INSTALLER');
console.log(line);
console.log('');
console.log('   A log is being written to install-log.txt');
console.log('');

// ---- ۱) نسخه Node ----
const major = Number(process.versions.node.split('.')[0]);
say(`[1/5] Node.js ${process.version}`);
if (!Number.isFinite(major) || major < MIN_NODE_MAJOR) {
  fail(
    'checking the Node.js version',
    `   Node.js ${process.version} is too old.\n` +
      `   Version ${MIN_NODE_MAJOR} or newer is required.\n\n` +
      '   Install the Windows LTS version from https://nodejs.org\n' +
      '   then run 1-INSTALL.bat again.',
  );
}

// ---- ۲) دسترسی به سرور بسته‌ها ----
// جدا از نصب بررسی می‌شود تا «اینترنت ندارد» شبیه «پروژه خراب است» نشود.
say('[2/5] Checking connection to the package server...');
if (!run('npm ping', ['ping'])) {
  fail(
    'contacting the npm package server',
    '   The installer needs the internet the first time only.\n\n' +
      '   Check that:\n' +
      '     - this computer is online\n' +
      '     - a firewall, antivirus or proxy is not blocking it',
  );
}

// ---- ۳) نصب بسته‌ها ----
say('[3/5] Installing packages. This takes a few minutes...');
if (!run('npm install', ['install', '--no-audit', '--no-fund'])) {
  fail(
    'downloading and installing packages',
    '   This step needs the internet. If the connection dropped\n' +
      '   part way through, running 1-INSTALL.bat again usually\n' +
      '   picks up where it stopped.',
  );
}

// ---- ۴) فایل تنظیمات ----
// این مرحله فایل موجود را بازنویسی نمی‌کند، پس اجرای دوباره نصب،
// کلید امنیتی و نشست کاربران را از بین نمی‌برد.
say('[4/5] Creating the config file and security key...');
if (!run('init:env', ['run', 'init:env'])) {
  fail('creating the config file', null);
}

// ---- ۵) پایگاه داده، build و داده نمونه ----
say('[5/5] Building the database and the app. A few more minutes...');
if (!run('setup', ['run', 'setup'])) {
  fail(
    'building the database and the app',
    '   This step downloads one more component (Prisma).\n' +
      '   If it failed, it is usually the internet connection.',
  );
}
/*
 * داده نمونه فقط روی نصب تازه ریخته می‌شود.
 *
 * اگر این اجرا یک **به‌روزرسانی** روی نصب موجود باشد، ریختن دوباره داده
 * نمونه قیمت محصولاتی را که کارخانه اصلاح کرده به مقدار نمونه برمی‌گرداند
 * و مشتری‌های نمونه را دوباره اضافه می‌کند. پس اگر پایگاه داده از قبل
 * هست، این مرحله رد می‌شود. (رمز کاربران در هیچ حالتی بازنویسی نمی‌شود.)
 */
if (IS_UPDATE) {
  say('      Existing database found - demo data skipped (this is an update).');
  log(`db exists at ${DB_FILE}; seed skipped`);
} else if (
  !run(
    'db:seed',
    ['run', 'db:seed'],
    PRODUCTION ? { ARD_PRODUCTION: '1', ARD_ADMIN_PASSWORD: ADMIN_PASSWORD } : {},
  )
) {
  fail(PRODUCTION ? 'creating the admin user' : 'loading the demo data', null);
} else if (PRODUCTION) {
  // رمز فقط همین یک‌بار ساخته می‌شود؛ داخل لاگ نمی‌رود، فقط این فایل
  writeFileSync(
    PASSWORD_FILE,
    `Ard Havaleh - first admin login\r\n\r\nUsername: admin\r\nPassword: ${ADMIN_PASSWORD}\r\n\r\n` +
      'Log in, change the password, then DELETE this file.\r\n',
    'utf8',
  );
}

// ---- بررسی نهایی: آیا واقعاً چیزی ساخته شد؟ ----
// یک دستور می‌تواند کد موفقیت بدهد و باز هم خروجی نداشته باشد؛ پس
// به‌جای اعتماد به کد خروج، خود فایل‌ها بررسی می‌شوند.
const mustExist = [
  ['node_modules', 'the installed packages'],
  ['.env', 'the config file'],
  [join('dist', 'index.html'), 'the built app'],
];
const missing = mustExist.filter(([p]) => !existsSync(join(ROOT, p)));
if (missing.length) {
  log('missing after install: ' + missing.map(([p]) => p).join(', '));
  fail(
    'the final check',
    '   These were not created:\n' +
      missing.map(([p, what]) => `     - ${p}  (${what})`).join('\n'),
  );
}

log('\nRESULT: SUCCESS');
console.log('');
console.log(line);
console.log('   INSTALL COMPLETE');
console.log(line);
console.log('');
/*
 * قدم بعد روی هر سیستم‌عامل فرق می‌کند. فایل .bat روی مک و لینوکس اجرا
 * نمی‌شود، و گفتن «دوبار کلیک کن» به کسی که روی مک نصب کرده، بن‌بست است.
 */
if (PRODUCTION && !IS_UPDATE) {
  console.log('   REAL SERVER MODE - no demo data was loaded.');
  console.log('');
  console.log('   First login (also saved in admin-password.txt):');
  console.log('       Username: admin');
  console.log(`       Password: ${ADMIN_PASSWORD}`);
  console.log('');
  console.log('   WRITE IT DOWN, log in, change it, then DELETE admin-password.txt');
  console.log('');
  console.log('   Next: double-click   3-SERVER-ON.bat   (as Administrator)');
} else {
  if (process.platform === 'win32') {
    console.log('   Now double-click:   2-START.bat');
  } else {
    console.log('   Now run:   npm start');
    console.log('   Then open: http://localhost:4000');
  }
  console.log('');
  if (!IS_UPDATE) {
    console.log('   Username: admin');
    console.log('   Password: ard@1404   (demo data)');
    console.log('');
  }
}
