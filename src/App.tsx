/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FlourReceipt, ActiveTab } from './types';
import { INITIAL_RECEIPTS } from './data/initialReceipts';
import { ReceiptPaper } from './components/ReceiptPaper';
import { ReceiptList } from './components/ReceiptList';
import { DjangoCodeViewer } from './components/DjangoCodeViewer';
import { ReceiptFormModal } from './components/ReceiptFormModal';
import {
  Printer,
  FileText,
  Code2,
  PlusCircle,
  Wheat,
  ListFilter,
  Info,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

export default function App() {
  const [receipts, setReceipts] = useState<FlourReceipt[]>(INITIAL_RECEIPTS);
  const [selectedReceipt, setSelectedReceipt] = useState<FlourReceipt>(INITIAL_RECEIPTS[0]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('paper');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<FlourReceipt | null>(null);

  // Handle save receipt (Create / Edit)
  const handleSaveReceipt = (
    data: Omit<FlourReceipt, 'id' | 'created_at'>,
    editingId?: number
  ) => {
    if (editingId) {
      // Edit existing
      setReceipts((prev) =>
        prev.map((r) =>
          r.id === editingId
            ? {
                ...r,
                ...data,
              }
            : r
        )
      );
      if (selectedReceipt.id === editingId) {
        setSelectedReceipt((prev) => ({ ...prev, ...data }));
      }
    } else {
      // Create new
      const newReceipt: FlourReceipt = {
        ...data,
        id: Date.now(),
        created_at: new Date().toISOString(),
      };
      setReceipts((prev) => [newReceipt, ...prev]);
      setSelectedReceipt(newReceipt);
      setActiveTab('paper');
    }
  };

  const handleDeleteReceipt = (id: number) => {
    if (confirm('آیا از حذف این حواله اطمینان دارید؟')) {
      const updated = receipts.filter((r) => r.id !== id);
      setReceipts(updated);
      if (selectedReceipt.id === id && updated.length > 0) {
        setSelectedReceipt(updated[0]);
      }
    }
  };

  const handleEditClick = (receipt: FlourReceipt) => {
    setEditingReceipt(receipt);
    setIsModalOpen(true);
  };

  const handleOpenCreateModal = () => {
    setEditingReceipt(null);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-['Vazirmatn',sans-serif] dir-rtl selection:bg-amber-200">
      
      {/* Top Navbar - Hidden on print */}
      <header className="no-print bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Logo & Company Title */}
          <div className="flex items-center gap-3">
            <div className="bg-amber-600 text-slate-950 p-2 rounded-xl shadow-xs">
              <Wheat className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-extrabold text-lg sm:text-xl text-white tracking-wide">
                شرکت آرد طلای سفید ماهان
              </h1>
              <p className="text-xs text-amber-400 font-medium">
                سامانه هوشمند صدور و چاپ «برگ حواله تحویل آرد»
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setActiveTab('paper')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
                activeTab === 'paper'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>پیش‌نمایش فرم چاپی</span>
            </button>

            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <ListFilter className="w-4 h-4" />
              <span>لیست حواله‌ها ({receipts.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('django-code')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
                activeTab === 'django-code'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>کد سورس Django</span>
            </button>

            <button
              onClick={() => setActiveTab('about')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
                activeTab === 'about'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Info className="w-4 h-4" />
              <span>راهنما</span>
            </button>
          </nav>

          {/* Quick Create Button */}
          <button
            onClick={handleOpenCreateModal}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-sm transition flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>صدور حواله جدید</span>
          </button>

        </div>
      </header>

      {/* Main Body Area */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        {activeTab === 'paper' && (
          <ReceiptPaper
            receipt={selectedReceipt}
            onEdit={handleEditClick}
            onViewDjangoCode={() => setActiveTab('django-code')}
          />
        )}

        {activeTab === 'list' && (
          <ReceiptList
            receipts={receipts}
            onSelectReceipt={(r) => {
              setSelectedReceipt(r);
              setActiveTab('paper');
            }}
            onEditReceipt={handleEditClick}
            onDeleteReceipt={handleDeleteReceipt}
            onOpenCreateModal={handleOpenCreateModal}
          />
        )}

        {activeTab === 'django-code' && <DjangoCodeViewer />}

        {activeTab === 'about' && (
          <div className="max-w-4xl mx-auto my-6 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6 text-slate-800">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
              <Wheat className="w-8 h-8 text-amber-600" />
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  راهنمای سامانه مدیریت حواله آرد شرکت آرد طلای سفید ماهان
                </h2>
                <p className="text-sm text-slate-500">
                  سیستم استاندارد چاپ برگه‌های اداری و حواله حمل با قالب RTL
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-2">
                <h3 className="font-bold text-amber-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600" />
                  <span>ویژگی‌های فرم چاپی استاندارد</span>
                </h3>
                <ul className="list-disc list-inside space-y-1 text-slate-600 text-xs sm:text-sm">
                  <li>قالب دقیق RTL برای نرم‌افزارهای چاپ و چاپگرهای A4/A5</li>
                  <li>تراز دقیق تمام فیلدها با استفاده از جدول‌های HTML</li>
                  <li>خط‌کشی نقطه‌چین زیر متغیرهای چاپی برگه</li>
                  <li>استفاده از <code className="bg-slate-200 px-1 rounded">@media print</code> جهت مخفی‌سازی دکمه‌ها در زمان پرینت</li>
                  <li>محل دقیق امضای مسئول صدور و اثر انگشت راننده</li>
                </ul>
              </div>

              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-2">
                <h3 className="font-bold text-amber-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>ساختار پایتون و جنگو (Django)</span>
                </h3>
                <ul className="list-disc list-inside space-y-1 text-slate-600 text-xs sm:text-sm">
                  <li>کلاس مدل <code className="bg-slate-200 px-1 rounded">FlourReceipt</code> شامل تمام فیلدهای درخواستی</li>
                  <li>کلاس ویو <code className="bg-slate-200 px-1 rounded">DetailView</code> برای دریافت رکورد بر اساس <code className="bg-slate-200 px-1 rounded">pk</code></li>
                  <li>تنظیمات <code className="bg-slate-200 px-1 rounded">urls.py</code> جهت مسیریابی آدرس برگه</li>
                  <li>فایل تمپلیت <code className="bg-slate-200 px-1 rounded">receipt_detail.html</code> آماده جهت کپی‌پیست</li>
                </ul>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between">
              <span className="text-sm font-semibold text-amber-900">
                جهت مشاهده کدهای پایتون و جنگو به تب «کد سورس Django» مراجعه فرمایید.
              </span>
              <button
                onClick={() => setActiveTab('django-code')}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition cursor-pointer"
              >
                مشاهده کدها
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modal for Creating / Editing Receipt */}
      <ReceiptFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveReceipt}
        initialData={editingReceipt}
      />

      {/* Footer */}
      <footer className="no-print bg-slate-900 text-slate-400 py-4 px-6 text-center text-xs border-t border-slate-800">
        <p>سامانه صدور حواله تحویل آرد - شرکت آرد طلای سفید ماهان © ۱۴۰۳</p>
      </footer>

    </div>
  );
}
