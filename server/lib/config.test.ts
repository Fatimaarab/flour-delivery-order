import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

/**
 * تست بررسی تنظیمات.
 *
 * این تست‌ها از یک اشکال واقعی آمده‌اند: فایل نمونه مقدار `change-me` داشت،
 * کاربر طبق دستورالعمل کپی‌اش کرد، سرور سالم بالا آمد، و بعد **اولین ورود**
 * با خطای «خطای غیرمنتظره‌ای رخ داد» شکست خورد.
 */

const original = { ...process.env };

beforeEach(() => {
  process.env.DATABASE_URL = 'file:./data/test.db';
  process.env.JWT_SECRET = 'a-perfectly-long-and-random-secret';
  process.env.PORT = '4000';
});

afterEach(() => {
  process.env = { ...original };
});

describe('بررسی تنظیمات پیش از اجرا', () => {
  it('با تنظیمات درست، مقادیر را برمی‌گرداند', () => {
    const config = loadConfig();
    expect(config.port).toBe(4000);
    expect(config.jwtSecret).toBe('a-perfectly-long-and-random-secret');
  });

  it('نبود DATABASE_URL را با راهنمایی گزارش می‌کند', () => {
    delete process.env.DATABASE_URL;
    expect(() => loadConfig()).toThrow(/DATABASE_URL/);
  });

  it('نبود JWT_SECRET را با راهنمایی گزارش می‌کند', () => {
    delete process.env.JWT_SECRET;
    expect(() => loadConfig()).toThrow(/JWT_SECRET/);
  });

  it('JWT_SECRET خالی پذیرفته نمی‌شود', () => {
    process.env.JWT_SECRET = '   ';
    expect(() => loadConfig()).toThrow(/JWT_SECRET/);
  });

  // ⭐ همان اشکالی که در تست پذیرش پیدا شد
  it('مقدار نمونه change-me رد می‌شود و دلیلش را می‌گوید', () => {
    process.env.JWT_SECRET = 'change-me';
    expect(() => loadConfig()).toThrow(/مقدار نمونه/);
    expect(() => loadConfig()).toThrow(/جعلی/);
  });

  it.each(['secret', 'changeme', 'dev-only-secret-change-on-server'])(
    'مقدار نمونه «%s» هم رد می‌شود',
    (value) => {
      process.env.JWT_SECRET = value;
      expect(() => loadConfig()).toThrow(/مقدار نمونه/);
    },
  );

  it('کلید کوتاه‌تر از ۱۶ نویسه رد می‌شود و طولش را می‌گوید', () => {
    process.env.JWT_SECRET = 'kootah';
    expect(() => loadConfig()).toThrow(/۶ نویسه|6 نویسه/);
  });

  it('پیام خطا دستور ساخت کلید را نشان می‌دهد', () => {
    process.env.JWT_SECRET = 'kootah';
    expect(() => loadConfig()).toThrow(/randomBytes/);
  });

  it('پورت نامعتبر رد می‌شود', () => {
    for (const bad of ['abc', '0', '70000', '-1']) {
      process.env.PORT = bad;
      expect(() => loadConfig(), bad).toThrow(/PORT/);
    }
  });

  it('نبود PORT مشکلی ندارد و ۴۰۰۰ پیش‌فرض می‌شود', () => {
    delete process.env.PORT;
    expect(loadConfig().port).toBe(4000);
  });
});
