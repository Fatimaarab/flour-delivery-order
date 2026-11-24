/**
 * تنها نقطه ارتباط مرورگر با سرور.
 *
 * کوکی نشست با `credentials: 'include'` خودکار ارسال می‌شود؛ هیچ توکنی در
 * جاوااسکریپت نگه‌داری نمی‌شود (کوکی httpOnly است) تا در برابر XSS امن بماند.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * وقتی نشست کاربر منقضی شود، سرور به همه درخواست‌ها ۴۰۱ می‌دهد.
 *
 * بدون این، کاربر پس از ۱۲ ساعت با پیام‌های خطای گیج‌کننده روبه‌رو می‌شد و
 * نمی‌فهمید که فقط باید دوباره وارد شود. حالا یک‌بار به همه اطلاع داده
 * می‌شود تا صفحه ورود نمایش داده شود.
 */
type SessionExpiredHandler = () => void;

let onSessionExpired: SessionExpiredHandler | null = null;

export function setSessionExpiredHandler(handler: SessionExpiredHandler | null) {
  onSessionExpired = handler;
}

/** مسیرهایی که ۴۰۱ گرفتنشان عادی است و نباید «پایان نشست» حساب شود. */
const SESSION_CHECK_PATHS = ['/auth/me', '/auth/login'];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(
      'ارتباط با سرور برقرار نشد. اتصال شبکه و روشن بودن سرور را بررسی کنید.',
      0,
      'NETWORK_ERROR',
    );
  }

  if (res.status === 204) return undefined as T;

  const body = (await res.json().catch(() => null)) as
    | { error?: { message: string; code: string; details?: unknown } }
    | null;

  if (!res.ok) {
    // نشست تمام شده؛ کاربر باید دوباره وارد شود
    if (res.status === 401 && !SESSION_CHECK_PATHS.includes(path)) {
      onSessionExpired?.();
    }

    throw new ApiError(
      body?.error?.message ?? 'خطای ناشناخته‌ای رخ داد.',
      res.status,
      body?.error?.code ?? 'UNKNOWN',
      body?.error?.details,
    );
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  postWithHeaders: <T>(path: string, data: unknown, headers: Record<string, string>) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data), headers }),
  patch: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),
};
