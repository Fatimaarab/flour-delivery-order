import type { Request } from 'express';
import { prisma } from '../../lib/prisma.js';

/** IP واقعی کاربر — برای ثبت در audit log. */
export function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

export interface AuditInput {
  entityType: string;
  entityId: number;
  action: string;
  changes?: unknown;
  userId: number;
  ipAddress?: string;
}

/**
 * ثبت یک واقعه در دفتر وقایع.
 *
 * ⚠️ ثبت audit هرگز نباید عملیات اصلی را از کار بیندازد، اما نبودش هم نباید
 * بی‌صدا بماند؛ پس خطا را می‌گیریم و در لاگ سرور فریاد می‌زنیم.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        changes: input.changes ? JSON.stringify(input.changes) : null,
        userId: input.userId,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error('[audit] ثبت وقایع ناموفق بود:', input, err);
  }
}
