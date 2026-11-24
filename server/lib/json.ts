/**
 * مبالغ ریالی در دیتابیس BigInt هستند، اما JSON استاندارد BigInt را نمی‌شناسد
 * و `JSON.stringify` روی آن خطا می‌دهد. این تبدیل، BigInt را به عدد معمولی
 * تبدیل می‌کند.
 *
 * چرا این امن است: بزرگ‌ترین عدد امن در جاوااسکریپت حدود ۹ کوآدریلیون
 * (۹۰۰۰ تریلیون) است. بزرگ‌ترین مبلغ قابل تصور در این سامانه — مثلاً جمع
 * فروش چندین ساله — چند ده تریلیون ریال است، یعنی چهار مرتبه بزرگی پایین‌تر.
 * با این حال برای اطمینان، اگر روزی عددی از این سقف رد شود، به‌جای خراب شدن
 * بی‌صدا، خطا می‌دهیم.
 */
export function serializeBigInt(value: unknown): unknown {
  if (typeof value === 'bigint') {
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(-Number.MAX_SAFE_INTEGER)) {
      throw new Error(`مبلغ ${value} از محدوده امن عددی خارج است.`);
    }
    return Number(value);
  }

  if (Array.isArray(value)) return value.map(serializeBigInt);

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        serializeBigInt(v),
      ]),
    );
  }

  return value;
}
