import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import {
  METHODS_REQUIRING_REFERENCE,
  validatePaymentAmount,
  type PaymentMethod,
} from '../../../shared/finance.js';

export interface RecordPaymentInput {
  receiptId?: number;
  customerId: number;
  amount: number;
  method: PaymentMethod;
  referenceNumber?: string;
  chequeDueDate?: Date;
  note?: string;
  userId: number;
  ipAddress?: string;
  idempotencyKey?: string;
}

/**
 * ثبت پرداخت.
 *
 * سه کار با هم و در یک تراکنش انجام می‌شوند: ساخت رکورد پرداخت، به‌روزرسانی
 * مبلغ پرداخت‌شده حواله، و اصلاح مانده حساب مشتری. حالت میانی — مثلاً پول ثبت
 * شود ولی از بدهی کم نشود — ممکن نیست.
 */
export async function recordPayment(input: RecordPaymentInput) {
  if (METHODS_REQUIRING_REFERENCE.includes(input.method) && !input.referenceNumber?.trim()) {
    throw badRequest(
      input.method === 'CHEQUE'
        ? 'برای پرداخت با چک، شماره چک اجباری است.'
        : 'برای واریز بانکی، شماره فیش اجباری است.',
    );
  }

  if (input.method === 'CHEQUE' && !input.chequeDueDate) {
    throw badRequest('برای پرداخت با چک، تاریخ سررسید اجباری است.');
  }

  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: input.customerId, deletedAt: null },
    });
    if (!customer) throw badRequest('مشتری معتبر نیست.');

    let receipt = null;
    if (input.receiptId !== undefined) {
      receipt = await tx.receipt.findFirst({
        where: { id: input.receiptId, deletedAt: null },
      });
      if (!receipt) throw notFound('حواله‌ای با این شناسه پیدا نشد.');

      if (receipt.customerId !== customer.id) {
        throw badRequest('این حواله متعلق به مشتری انتخاب‌شده نیست.');
      }

      if (receipt.status === 'CANCELLED' || receipt.status === 'EXPIRED') {
        throw conflict('برای حواله ابطال‌شده یا منقضی، پرداخت ثبت نمی‌شود.');
      }

      const outstanding = Number(receipt.grandTotal) - Number(receipt.paidAmount);
      const check = validatePaymentAmount(input.amount, outstanding);
      if (!check.valid) throw badRequest(check.reason!);
    } else if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw badRequest('مبلغ پرداخت باید عددی صحیح و بزرگ‌تر از صفر باشد.');
    }

    const payment = await tx.payment.create({
      data: {
        receiptId: receipt?.id ?? null,
        customerId: customer.id,
        amount: BigInt(input.amount),
        method: input.method,
        referenceNumber: input.referenceNumber?.trim() || null,
        chequeDueDate: input.chequeDueDate ?? null,
        note: input.note?.trim() || null,
        userId: input.userId,
      },
    });

    if (receipt) {
      await tx.receipt.update({
        where: { id: receipt.id },
        data: { paidAmount: { increment: BigInt(input.amount) } },
      });
    }

    // پول دریافتی از بدهی مشتری کم می‌کند (مانده را به سمت مثبت می‌برد)
    await tx.customer.update({
      where: { id: customer.id },
      data: { balance: { increment: BigInt(input.amount) } },
    });

    await tx.auditLog.create({
      data: {
        entityType: 'Payment',
        entityId: payment.id,
        action: 'CREATE',
        changes: JSON.stringify({
          amount: input.amount,
          method: input.method,
          receiptId: receipt?.id ?? null,
        }),
        userId: input.userId,
        ipAddress: input.ipAddress ?? null,
      },
    });

    return payment;
  });
}

/**
 * ابطال پرداخت.
 *
 * ⚠️ داده مالی هرگز فیزیکی حذف نمی‌شود. رکورد با `deletedAt` علامت می‌خورد و
 * برای همیشه در دیتابیس و در دفتر وقایع می‌ماند؛ فقط از محاسبات کنار می‌رود.
 */
export async function voidPayment(
  paymentId: number,
  reason: string,
  userId: number,
  ipAddress?: string,
) {
  if (!reason.trim()) throw badRequest('برای ابطال پرداخت، ثبت دلیل اجباری است.');

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { id: paymentId, deletedAt: null },
    });
    if (!payment) throw notFound('پرداختی با این شناسه پیدا نشد.');

    await tx.payment.update({
      where: { id: paymentId },
      data: { deletedAt: new Date(), note: `${payment.note ?? ''}\n[ابطال] ${reason}`.trim() },
    });

    if (payment.receiptId) {
      await tx.receipt.update({
        where: { id: payment.receiptId },
        data: { paidAmount: { decrement: payment.amount } },
      });
    }

    await tx.customer.update({
      where: { id: payment.customerId },
      data: { balance: { decrement: payment.amount } },
    });

    await tx.auditLog.create({
      data: {
        entityType: 'Payment',
        entityId: paymentId,
        action: 'VOID',
        changes: JSON.stringify({ amount: String(payment.amount), reason }),
        userId,
        ipAddress: ipAddress ?? null,
      },
    });

    return payment;
  });
}

/**
 * صورتحساب مشتری (کاردکس مالی) — فهرست زمانی بدهکاری‌ها و بستانکاری‌ها با
 * مانده متحرک.
 */
export async function customerStatement(customerId: number) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, deletedAt: null },
  });
  if (!customer) throw notFound('مشتری‌ای با این شناسه پیدا نشد.');

  const [receipts, payments] = await Promise.all([
    prisma.receipt.findMany({
      where: {
        customerId,
        deletedAt: null,
        /*
         * حواله از لحظه صدور بدهی ایجاد می‌کند. پیش از حذف مرحله تأیید
         * مالی، مبدأ بدهی همان تأیید بود؛ وضعیت قدیمی برای حواله‌های
         * پیش از تغییر در فهرست مانده است.
         */
        status: {
          in: ['ISSUED', 'FINANCE_APPROVED', 'READY_FOR_LOADING', 'LOADED', 'DISPATCHED', 'CLOSED'],
        },
      },
      select: { id: true, receiptNumber: true, grandTotal: true, issueDate: true, status: true },
    }),
    prisma.payment.findMany({
      where: { customerId, deletedAt: null },
      select: {
        id: true,
        amount: true,
        method: true,
        referenceNumber: true,
        createdAt: true,
        receipt: { select: { receiptNumber: true } },
      },
    }),
  ]);

  type Entry = {
    date: Date;
    kind: 'RECEIPT' | 'PAYMENT';
    title: string;
    reference: string | null;
    debit: number;
    credit: number;
    balance: number;
  };

  const entries: Omit<Entry, 'balance'>[] = [
    ...receipts.map((r) => ({
      date: r.issueDate,
      kind: 'RECEIPT' as const,
      title: `حواله ${r.receiptNumber}`,
      reference: r.receiptNumber,
      debit: Number(r.grandTotal),
      credit: 0,
    })),
    ...payments.map((p) => ({
      date: p.createdAt,
      kind: 'PAYMENT' as const,
      title: p.receipt ? `پرداخت بابت ${p.receipt.receiptNumber}` : 'پرداخت علی‌الحساب',
      reference: p.referenceNumber,
      debit: 0,
      credit: Number(p.amount),
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  let running = 0;
  const ledger: Entry[] = entries.map((e) => {
    running += e.credit - e.debit;
    return { ...e, balance: running };
  });

  return {
    customer: {
      id: customer.id,
      code: customer.code,
      name: customer.name,
      creditLimit: Number(customer.creditLimit),
      balance: Number(customer.balance),
    },
    ledger,
    totals: {
      debit: ledger.reduce((s, e) => s + e.debit, 0),
      credit: ledger.reduce((s, e) => s + e.credit, 0),
    },
  };
}

/** مبلغ پرداخت‌نشده یک حواله. */
export function outstandingOf(receipt: { grandTotal: bigint; paidAmount: bigint }): number {
  return Number(receipt.grandTotal) - Number(receipt.paidAmount);
}

export type PaymentTx = Prisma.TransactionClient;
