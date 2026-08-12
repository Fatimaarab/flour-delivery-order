import React, { useState, useEffect } from 'react';
import { FlourReceipt } from '../types';
import { X, PlusCircle, Save, FileText, RefreshCw } from 'lucide-react';

interface ReceiptFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (receiptData: Omit<FlourReceipt, 'id' | 'created_at'>, editingId?: number) => void;
  initialData?: FlourReceipt | null;
}

export const ReceiptFormModal: React.FC<ReceiptFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [receiptNumber, setReceiptNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [bagCount, setBagCount] = useState<number>(300);
  const [driverName, setDriverName] = useState('');
  const [truckNumber, setTruckNumber] = useState('');
  const [driverNationalId, setDriverNationalId] = useState('');
  const [destination, setDestination] = useState('');
  const [description, setDescription] = useState('');

  // Generate random default receipt number and Jalali date string
  const generateDefaults = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setReceiptNumber(`1403-${randomNum}`);

    // Today Jalali mock date string format
    const todayStr = '۱۴۰۳/۰۵/۱۳';
    setIssueDate(todayStr);
  };

  useEffect(() => {
    if (initialData) {
      setReceiptNumber(initialData.receipt_number);
      setIssueDate(initialData.issue_date);
      setBagCount(initialData.bag_count);
      setDriverName(initialData.driver_name);
      setTruckNumber(initialData.truck_number);
      setDriverNationalId(initialData.driver_national_id);
      setDestination(initialData.destination);
      setDescription(initialData.description || '');
    } else {
      generateDefaults();
      setBagCount(300);
      setDriverName('');
      setTruckNumber('');
      setDriverNationalId('');
      setDestination('');
      setDescription('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptNumber || !issueDate || !driverName || !destination) {
      alert('لطفاً تمامی فیلدهای ضروری را تکمیل نمایید.');
      return;
    }

    onSave(
      {
        receipt_number: receiptNumber,
        issue_date: issueDate,
        bag_count: Number(bagCount),
        driver_name: driverName,
        truck_number: truckNumber,
        driver_national_id: driverNationalId,
        destination: destination,
        description: description,
      },
      initialData?.id
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto no-print">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <h3 className="font-extrabold text-lg">
              {initialData ? 'ویرایش اطلاعات حواله آرد' : 'صدور حواله تحویل آرد جدید'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-800 p-1.5 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Receipt Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                شماره حواله <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  placeholder="مثال: 1403-8821"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-bold"
                />
                <button
                  type="button"
                  onClick={generateDefaults}
                  title="تولید شماره تصادفی"
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg border border-slate-300 transition cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Issue Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                تاریخ صدور (شمسی) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                placeholder="مثال: ۱۴۰۳/۰۵/۱۰"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>

            {/* Bag Count */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                تعداد کیسه آرد (عدد صحیح) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min={1}
                value={bagCount}
                onChange={(e) => setBagCount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-bold text-amber-900"
              />
            </div>

            {/* Driver Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                نام و نام خانوادگی راننده <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="مثال: اصغر محمدی"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>

            {/* Truck License Plate */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                شماره کامیون / پلاک <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={truckNumber}
                onChange={(e) => setTruckNumber(e.target.value)}
                placeholder="مثال: ۴۴ع۷۸۹-ایران۷۷"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>

            {/* Driver National ID */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                کد ملی راننده <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={10}
                value={driverNationalId}
                onChange={(e) => setDriverNationalId(e.target.value)}
                placeholder="مثال: ۰۹۲۳۴۵۶۷۸۱"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-mono"
              />
            </div>

          </div>

          {/* Destination */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              محل مقصد (نام نانوایی/کارخانه/شهر) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="مثال: نانوایی سنگک مرکزی - نیشابور خیابان امام"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            />
          </div>

          {/* Description / Custom Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>توضیحات تکمیلی (نوع آرد، یادداشت انبار یا وزن باسکول)</span>
              <span className="text-xs font-normal text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                در نسخه انبار و نسخه باسکول چاپ می‌شود
              </span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="توضیحات دلخواه خود مانند: نوع آرد (خبازی ۱ / ستاره / نول)، وزن خالص باسکول، درجه کیفی یا شرایط بارگیری را بنویسید..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden leading-relaxed"
            />
          </div>

          {/* Actions Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition cursor-pointer"
            >
              انصراف
            </button>

            <button
              type="submit"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-2.5 rounded-lg shadow transition flex items-center gap-2 text-sm cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{initialData ? 'ذخیره تغییرات' : 'صدور و ثبت حواله'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
