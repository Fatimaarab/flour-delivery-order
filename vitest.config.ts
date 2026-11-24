import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./vitest.globalSetup.ts'],
    // تست‌ها روی دیتابیس جداگانه اجرا می‌شوند تا دیتابیس دمو آلوده نشود
    env: { DATABASE_URL: 'file:./data/test.db' },
    // فایل‌های تست پشت سر هم اجرا می‌شوند؛ چند نویسنده همزمان روی یک فایل
    // SQLite به قفل می‌خورند
    fileParallelism: false,
    include: ['server/**/*.test.ts', 'shared/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
