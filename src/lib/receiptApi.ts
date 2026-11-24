import { api } from './api';
import type { ReceiptStatus, Transition } from '../../shared/receiptStateMachine';

export interface ReceiptItem {
  id: number;
  productId: number;
  bagCount: number;
  bagWeightKg: number;
  weightKg: number;
  unitPricePerKg: number;
  lineTotal: number;
  vatPercent: number;
  vatAmount: number;
  product: { id: number; code: string; name: string };
}

export interface Receipt {
  id: number;
  receiptNumber: string;
  status: ReceiptStatus;
  issueDate: string;
  validUntil: string;
  subtotal: number;
  discount: number;
  vatAmount: number;
  grandTotal: number;
  paidAmount: number;
  totalWeightKg: number;
  notes: string | null;
  customer: { id: number; code: string; name: string };
  issuedBy: { id: number; fullName: string };
  items: ReceiptItem[];
}

export interface StatusLog {
  id: number;
  fromStatus: ReceiptStatus | null;
  toStatus: ReceiptStatus;
  reason: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { fullName: string };
}

export interface ShipmentInfo {
  driverId?: number | null;
  driverName: string | null;
  driverNationalId: string | null;
  driverMobile: string | null;
  plateNumber: string | null;
  haulType: 'COMPANY' | 'SELF';
  carrierCompany: string | null;
}

export interface ReceiptDetail {
  receipt: Receipt & { statusLogs: StatusLog[]; shipment: ShipmentInfo | null };
  editable: boolean;
  transitions: Transition[];
}

export interface DraftPayload {
  customerId: number;
  items: { productId: number; bagCount: number }[];
  discount?: number;
  notes?: string;
  /** راننده تعریف‌شده در بخش «رانندگان» */
  driverId: number;
  haulType: 'COMPANY' | 'SELF';
  carrierCompany?: string;
}

export const receiptApi = {
  list: (params: { status?: string; search?: string; page?: number }) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.search) q.set('search', params.search);
    q.set('page', String(params.page ?? 1));
    return api.get<{ receipts: Receipt[]; total: number; page: number; pageSize: number }>(
      `/receipts?${q}`,
    );
  },

  get: (id: number) => api.get<ReceiptDetail>(`/receipts/${id}`),

  /**
   * ساخت پیش‌نویس با کلید یکتا.
   *
   * کلید هنگام باز شدن فرم ساخته می‌شود؛ اگر کاربر دوبار روی «ثبت» بزند یا
   * اینترنت قطع و وصل شود، سرور همان حواله اول را برمی‌گرداند نه یک حواله دوم.
   */
  create: (data: DraftPayload, idempotencyKey: string) =>
    api.postWithHeaders<{ receipt: Receipt; reused: boolean }>('/receipts', data, {
      'Idempotency-Key': idempotencyKey,
    }),

  update: (id: number, data: DraftPayload) =>
    api.patch<{ receipt: Receipt }>(`/receipts/${id}`, data),

  transition: (id: number, to: ReceiptStatus, reason?: string) =>
    api.post<{ receipt: Receipt; transitions: Transition[] }>(`/receipts/${id}/transition`, {
      to,
      reason,
    }),
};
