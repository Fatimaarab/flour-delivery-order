import { describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from './app.js';

/** سرور را روی یک پورت آزاد بالا می‌آورد و آدرس پایه‌اش را برمی‌گرداند. */
function startTestServer(): { server: Server; baseUrl: string } {
  const server = createApp().listen(0);
  const { port } = server.address() as { port: number };
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

async function getJson<T>(url: string): Promise<{ status: number; body: T }> {
  const res = await fetch(url);
  return { status: res.status, body: (await res.json()) as T };
}

/**
 * تست دود (smoke test): مطمئن می‌شود سرور بالا می‌آید و واقعاً به دیتابیس
 * وصل است. اگر این تست بشکند، یعنی پایه کار خراب است و بقیه تست‌ها بی‌معنی‌اند.
 */
describe('اسکلت سرور', () => {
  it('به دیتابیس وصل می‌شود و وضعیت سلامت را گزارش می‌دهد', async () => {
    const { server, baseUrl } = startTestServer();

    try {
      const { status, body } = await getJson<{ ok: boolean; db: string }>(
        `${baseUrl}/api/health`,
      );
      expect(status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.db).toBe('connected');
    } finally {
      server.close();
    }
  });

  it('برای آدرس ناشناخته، خطای فارسی برمی‌گرداند', async () => {
    const { server, baseUrl } = startTestServer();

    try {
      const { status, body } = await getJson<{
        error: { code: string; message: string };
      }>(`${baseUrl}/api/does-not-exist`);

      expect(status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toContain('وجود ندارد');
    } finally {
      server.close();
    }
  });
});
