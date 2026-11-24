/**
 * اتصال به پنل پیامک.
 *
 * ── چرا یک لایه جدا ──────────────────────────────────────────────────────
 * صف، متن‌ها، زمان ارسال و سابقه پیامک هیچ ربطی به این ندارند که پنل از
 * کدام شرکت است. تنها تکه‌ای که به شرکت پنل وابسته است همین فایل است، پس
 * عوض کردن پنل یعنی نوشتن یک تابع `send` تازه — نه دست زدن به بقیه سامانه.
 *
 * ── حالت‌ها (متغیر SMS_PROVIDER در فایل .env) ────────────────────────────
 *   خالی / off → پیامک خاموش است؛ هیچ چیزی در صف نمی‌رود
 *   test       → حالت آزمایشی: پیامک در صف و سابقه ثبت می‌شود و «ارسال‌شده»
 *                علامت می‌خورد، اما **واقعاً به هیچ شماره‌ای فرستاده نمی‌شود**.
 *                برای دیدن متن‌ها و آزمودن جریان کار، بدون خرج شارژ پنل.
 *
 * ⚠️ اتصال به پنل واقعی («پیام‌رسان») هنوز نوشته نشده است. آدرس و قالب
 * درخواست آن پنل را از مستند رسمی‌اش نداشتیم و حدس زدنش یعنی پیامکی که
 * «ارسال‌شده» علامت می‌خورد ولی هرگز نمی‌رسد. با داشتن مستند وب‌سرویس و
 * مشخصات حساب، یک `SmsProvider` تازه همین‌جا اضافه می‌شود.
 * ────────────────────────────────────────────────────────────────────────
 */

export interface SmsSendResult {
  /** شناسه‌ای که پنل برمی‌گرداند — برای پیگیری تحویل */
  providerRef: string | null;
}

export interface SmsProvider {
  readonly name: string;
  /** اگر ارسال ناموفق باشد باید خطا پرتاب کند؛ صف خودش دوباره تلاش می‌کند. */
  send(to: string, text: string): Promise<SmsSendResult>;
}

/** حالت آزمایشی: چیزی فرستاده نمی‌شود. */
class TestProvider implements SmsProvider {
  readonly name = 'test';
  async send(to: string, text: string): Promise<SmsSendResult> {
    console.log(`[sms:test] → ${to}\n${text}\n`);
    return { providerRef: `test-${Date.now()}` };
  }
}

let override: SmsProvider | null | undefined;

/** فقط برای آزمون‌ها: جایگزین کردن پنل با یک نمونه ساختگی. */
export function setSmsProviderForTests(provider: SmsProvider | null | undefined) {
  override = provider;
}

/** پنل فعال، یا null اگر پیامک خاموش است. */
export function getSmsProvider(): SmsProvider | null {
  if (override !== undefined) return override;

  const name = (process.env.SMS_PROVIDER ?? '').trim().toLowerCase();
  if (!name || name === 'off') return null;
  if (name === 'test') return new TestProvider();

  // نام ناشناخته را بی‌صدا «خاموش» حساب نمی‌کنیم: کسی که آن را تنظیم کرده
  // انتظار دارد پیامک برود، و باید بفهمد که نمی‌رود.
  throw new Error(
    `مقدار SMS_PROVIDER در فایل .env ناشناخته است: «${name}». مقادیر مجاز: off، test`,
  );
}

/** شماره‌های مدیر کارخانه، از SMS_MANAGER_NUMBERS (با ویرگول جدا می‌شوند). */
export function managerNumbers(): string[] {
  return (process.env.SMS_MANAGER_NUMBERS ?? '')
    .split(/[,،\s]+/)
    .map((n) => n.trim())
    .filter(Boolean);
}
