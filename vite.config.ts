import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {createRequire} from 'module';

const {version} = createRequire(import.meta.url)('./package.json') as {version: string};

/**
 * مهر زمان ساخت.
 *
 * روی رابط کاربری نشان داده می‌شود تا در پشتیبانی بتوان با یک نگاه فهمید
 * کاربر واقعاً کدام نسخه را اجرا می‌کند. بدون این، نسخه قدیمیِ ساخته‌شده
 * در پوشه dist دقیقاً شبیه نسخه تازه به نظر می‌رسد.
 */
const BUILD_STAMP = new Date().toLocaleDateString('fa-IR-u-ca-persian', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export default defineConfig(() => {
  return {
    define: {
      __BUILD_STAMP__: JSON.stringify(BUILD_STAMP),
      __APP_VERSION__: JSON.stringify(version),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // درخواست‌های /api به سرور بک‌اند هدایت می‌شوند تا مرورگر همه‌چیز را
      // روی یک origin ببیند (بدون نیاز به تنظیمات CORS).
      proxy: {
        '/api': {
          target: `http://localhost:${process.env.PORT ?? 4000}`,
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
