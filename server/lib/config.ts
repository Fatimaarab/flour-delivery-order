/**
 * بررسی تنظیمات، پیش از بالا آمدن سرور.
 *
 * ── چرا این فایل وجود دارد ───────────────────────────────────────────────
 * پیش از این، اگر `JWT_SECRET` تنظیم نشده بود، سرور با پیام «در حال اجراست»
 * بالا می‌آمد و کاملاً سالم به نظر می‌رسید. بعد **اولین کاربری که می‌خواست
 * وارد شود** خطای «خطای غیرمنتظره‌ای رخ داد» می‌گرفت — بدون هیچ سرنخی که
 * مشکل از تنظیمات است.
 *
 * حالا سرور در همان ثانیه اول متوقف می‌شود و دقیقاً می‌گوید چه چیزی غلط است
 * و چطور درستش کنند. خرابی باید **زود و با صدای بلند** اتفاق بیفتد، نه دیر
 * و بی‌صدا.
 * ─────────────────────────────────────────────────────────────────────────
 */

const MIN_SECRET_LENGTH = 16;

/** مقادیری که در فایل نمونه هستند و نباید روی سرور واقعی بمانند. */
const PLACEHOLDER_SECRETS = new Set([
  'change-me',
  'changeme',
  'secret',
  'dev-only-secret-change-on-server',
  'اینجا-را-حتما-عوض-کنید',
]);

export interface AppConfig {
  port: number;
  jwtSecret: string;
  databaseUrl: string;
  isProduction: boolean;
}

class ConfigError extends Error {}

function fail(problem: string, howToFix: string): never {
  throw new ConfigError(
    `\n` +
      `┌─────────────────────────────────────────────────────────────┐\n` +
      `│  سامانه اجرا نشد — ایراد در تنظیمات                          │\n` +
      `└─────────────────────────────────────────────────────────────┘\n\n` +
      `مشکل:\n  ${problem}\n\n` +
      `راه حل:\n${howToFix}\n`,
  );
}

export function loadConfig(): AppConfig {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    fail(
      'متغیر DATABASE_URL در فایل .env تنظیم نشده است.',
      '  فایل .env را باز کنید و این خط را اضافه کنید:\n' +
        '    DATABASE_URL="file:./data/ard.db"',
    );
  }

  const jwtSecret = process.env.JWT_SECRET?.trim();

  if (!jwtSecret) {
    fail(
      'متغیر JWT_SECRET در فایل .env تنظیم نشده است.',
      '  ۱. در همین پوشه این دستور را اجرا کنید تا یک کلید امن ساخته شود:\n\n' +
        `        node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"\n\n` +
        '  ۲. خروجی را کپی کنید و در فایل .env بگذارید:\n\n' +
        '        JWT_SECRET="<کلیدی که کپی کردید>"',
    );
  }

  if (PLACEHOLDER_SECRETS.has(jwtSecret)) {
    fail(
      `مقدار JWT_SECRET هنوز همان مقدار نمونه («${jwtSecret}») است.\n` +
        '  این کلید، نشست کاربران و کد QR روی برگه‌های حواله را امضا می‌کند.\n' +
        '  اگر کسی آن را بداند، می‌تواند برگه حواله جعلی بسازد.',
      '  ۱. یک کلید تصادفی بسازید:\n\n' +
        `        node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"\n\n` +
        '  ۲. آن را در فایل .env جایگزین مقدار فعلی کنید.',
    );
  }

  if (jwtSecret.length < MIN_SECRET_LENGTH) {
    fail(
      `مقدار JWT_SECRET فقط ${jwtSecret.length} نویسه است؛ حداقل ${MIN_SECRET_LENGTH} نویسه لازم است.\n` +
        '  کلید کوتاه قابل حدس زدن است و امنیت نشست کاربران را از بین می‌برد.',
      '  یک کلید بلندتر بسازید و در .env جایگزین کنید:\n\n' +
        `        node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`,
    );
  }

  const rawPort = process.env.PORT?.trim() || '4000';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail(
      `مقدار PORT («${rawPort}») یک شماره پورت معتبر نیست.`,
      '  در فایل .env یک عدد بین ۱ تا ۶۵۵۳۵ بگذارید، مثلاً:\n' +
        '    PORT=4000',
    );
  }

  return {
    port,
    jwtSecret,
    databaseUrl,
    isProduction: process.env.NODE_ENV === 'production',
  };
}

/**
 * تنظیمات را بررسی می‌کند و در صورت ایراد، با پیام فارسی برنامه را متوقف
 * می‌کند. این تابع باید **پیش از** شروع به گوش دادن روی پورت صدا زده شود.
 */
export function loadConfigOrExit(): AppConfig {
  try {
    return loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
}
