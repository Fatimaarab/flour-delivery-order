import React, { useState } from 'react';
import { FlourReceipt } from '../types';
import {
  Search,
  Plus,
  Eye,
  Trash2,
  Edit,
  Printer,
  Truck,
  Package,
  Calendar,
  Building,
  UserCheck,
} from 'lucide-react';

interface ReceiptListProps {
  receipts: FlourReceipt[];
  onSelectReceipt: (receipt: FlourReceipt) => void;
  onEditReceipt: (receipt: FlourReceipt) => void;
  onDeleteReceipt: (id: number) => void;
  onOpenCreateModal: () => void;
}

export const ReceiptList: React.FC<ReceiptListProps> = ({
  receipts,
  onSelectReceipt,
  onEditReceipt,
  onDeleteReceipt,
  onOpenCreateModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredReceipts = receipts.filter((r) => {
    const term = searchTerm.toLowerCase();
    return (
      r.receipt_number.toLowerCase().includes(term) ||
      r.driver_name.toLowerCase().includes(term) ||
      r.destination.toLowerCase().includes(term) ||
      r.truck_number.toLowerCase().includes(term) ||
      r.driver_national_id.includes(term) ||
      (r.description && r.description.toLowerCase().includes(term))
    );
  });

  return (
    <div className="w-full max-w-5xl mx-auto my-6 space-y-6">
      
      {/* Action & Filter Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجو بر اساس شماره حواله، نام راننده، مقصد، کد ملی یا پلاک..."
            className="w-full pr-9 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden transition"
          />
        </div>

        {/* Create Button */}
        <button
          onClick={onOpenCreateModal}
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2.5 rounded-xl shadow transition flex items-center justify-center gap-2 text-sm shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>صدور حواله جدید</span>
        </button>
      </div>

      {/* Receipts Table / Grid */}
      {filteredReceipts.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <Package className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-slate-600 font-medium">هیچ حواله‌ای یافت نشد.</p>
          <button
            onClick={onOpenCreateModal}
            className="text-amber-600 hover:text-amber-700 font-bold text-sm underline cursor-pointer"
          >
            ایجاد اولین حواله تحویل آرد
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReceipts.map((receipt) => (
            <div
              key={receipt.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Header Badge */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <div className="bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-lg text-xs font-bold">
                    حواله #{receipt.receipt_number}
                  </div>
                  <div className="flex items-center gap-1 text-slate-500 text-xs">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{receipt.issue_date}</span>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm text-slate-700 mb-4">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-bold text-slate-900">{receipt.driver_name}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <Truck className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>کامیون: <strong className="text-slate-800">{receipt.truck_number}</strong> (کد ملی: {receipt.driver_national_id})</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <Package className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>مقدار بار: <strong className="text-amber-700 font-bold">{receipt.bag_count} کیسه آرد</strong></span>
                  </div>

                  <div className="flex items-start gap-2 text-xs">
                    <Building className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">مقصد: {receipt.destination}</span>
                  </div>

                  {receipt.description && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-600 line-clamp-2 bg-amber-50/50 p-2 rounded border border-amber-100">
                      <strong className="text-amber-900 font-semibold">توضیحات: </strong>
                      {receipt.description}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectReceipt(receipt)}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 px-3 rounded-lg text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span>مشاهده و چاپ</span>
                </button>

                <button
                  onClick={() => onEditReceipt(receipt)}
                  title="ویرایش"
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg transition text-xs cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => onDeleteReceipt(receipt.id)}
                  title="حذف"
                  className="bg-red-50 hover:bg-red-100 text-red-600 p-2 rounded-lg transition text-xs cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
