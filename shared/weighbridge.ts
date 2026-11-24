/**
 * منطق باسکول و مغایرت وزنی.
 *
 * ── به زبان ساده ──────────────────────────────────────────────────────────
 * کامیون دو بار وزن می‌شود: یک‌بار خالی («وزن خالی») و یک‌بار پر («وزن پر»).
 * تفاوت این دو، وزن واقعی باری است که بارگیری شده («وزن خالص»).
 *
 * این وزن واقعی با وزنی که روی حواله نوشته شده مقایسه می‌شود. اگر اختلاف از
 * حد مجاز بیشتر باشد، «مغایرت وزنی» ثبت می‌شود.
 *
 * طبق تصمیم کارفرما: مغایرت **جلوی خروج بار را نمی‌گیرد**، اما انباردار باید
 * صریحاً آن را تأیید کند و تأییدش در سوابق می‌ماند.
 * ─────────────────────────────────────────────────────────────────────────
 */

export interface WeighbridgeInput {
  /** وزن کامیون خالی، کیلوگرم */
  tareWeightKg: number;
  /** وزن کامیون پر، کیلوگرم */
  grossWeightKg: number;
  /** وزنی که روی حواله صادر شده، کیلوگرم */
  receiptWeightKg: number;
  /** حد مجاز مغایرت، درصد */
  tolerancePercent: number;
}

export interface WeighbridgeResult {
  netWeightKg: number;
  /** اختلاف وزن باسکول با وزن حواله — مثبت یعنی بیشتر بار زده شده */
  varianceKg: number;
  variancePercent: number;
  /** آیا اختلاف از حد مجاز عبور کرده؟ */
  exceedsTolerance: boolean;
  /** توضیح فارسی برای نمایش به انباردار */
  message: string;
}

export class WeighbridgeError extends Error {}

export function calculateWeighbridge(input: WeighbridgeInput): WeighbridgeResult {
  const { tareWeightKg, grossWeightKg, receiptWeightKg, tolerancePercent } = input;

  for (const [label, value] of [
    ['وزن خالی', tareWeightKg],
    ['وزن پر', grossWeightKg],
  ] as const) {
    if (!Number.isInteger(value) || value < 0) {
      throw new WeighbridgeError(`${label} باید عددی صحیح و نامنفی باشد.`);
    }
  }

  if (grossWeightKg <= tareWeightKg) {
    throw new WeighbridgeError(
      'وزن پر باید از وزن خالی بیشتر باشد. احتمالاً جای دو عدد جابه‌جا وارد شده است.',
    );
  }

  if (receiptWeightKg <= 0) {
    throw new WeighbridgeError('وزن حواله معتبر نیست.');
  }

  const netWeightKg = grossWeightKg - tareWeightKg;
  const varianceKg = netWeightKg - receiptWeightKg;
  const variancePercent = (Math.abs(varianceKg) / receiptWeightKg) * 100;
  const exceedsTolerance = variancePercent > tolerancePercent;

  const tons = (kg: number) =>
    (Math.abs(kg) / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 2 });

  let message: string;
  if (varianceKg === 0) {
    message = 'وزن باسکول دقیقاً با وزن حواله می‌خواند.';
  } else if (!exceedsTolerance) {
    message =
      `اختلاف ${tons(varianceKg)} تُن (${variancePercent.toLocaleString('fa-IR', { maximumFractionDigits: 2 })}٪) ` +
      `در حد مجاز است.`;
  } else {
    message =
      `⚠️ مغایرت وزنی: وزن باسکول ${tons(varianceKg)} تُن ` +
      `${varianceKg > 0 ? 'بیشتر' : 'کمتر'} از وزن حواله است ` +
      `(${variancePercent.toLocaleString('fa-IR', { maximumFractionDigits: 2 })}٪، حد مجاز ${tolerancePercent.toLocaleString('fa-IR')}٪). ` +
      `برای ادامه، تأیید انباردار لازم است.`;
  }

  return { netWeightKg, varianceKg, variancePercent, exceedsTolerance, message };
}
