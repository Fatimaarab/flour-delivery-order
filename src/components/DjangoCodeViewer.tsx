import React, { useState } from 'react';
import {
  DJANGO_MODELS_PY,
  DJANGO_VIEWS_PY,
  DJANGO_URLS_PY,
  DJANGO_ADMIN_PY,
  DJANGO_TEMPLATE_HTML,
} from '../data/djangoCode';
import { Code2, Copy, Check, Terminal, FileCode2, Layers, ExternalLink, Sparkles } from 'lucide-react';

export const DjangoCodeViewer: React.FC = () => {
  const [activeFile, setActiveFile] = useState<
    'models.py' | 'views.py' | 'urls.py' | 'admin.py' | 'receipt_detail.html'
  >('models.py');

  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const getCode = () => {
    switch (activeFile) {
      case 'models.py':
        return DJANGO_MODELS_PY;
      case 'views.py':
        return DJANGO_VIEWS_PY;
      case 'urls.py':
        return DJANGO_URLS_PY;
      case 'admin.py':
        return DJANGO_ADMIN_PY;
      case 'receipt_detail.html':
        return DJANGO_TEMPLATE_HTML;
      default:
        return '';
    }
  };

  const handleCopy = (filename: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedFile(filename);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  const fileTabs = [
    { name: 'models.py', label: 'مدل (models.py)', icon: Layers },
    { name: 'views.py', label: 'ویو (views.py)', icon: Code2 },
    { name: 'urls.py', label: 'مسیریابی (urls.py)', icon: ExternalLink },
    { name: 'admin.py', label: 'پنل مدیریت (admin.py)', icon: Sparkles },
    { name: 'receipt_detail.html', label: 'قالب چاپی (HTML)', icon: FileCode2 },
  ] as const;

  return (
    <div className="w-full max-w-5xl mx-auto my-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm mb-1">
              <Terminal className="w-4 h-4" />
              <span>کدهای کامل پروژه جنگو (Django Architecture)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              کدهای آماده کپی و استفاده در پروژه پایتون و جنگو
            </h2>
            <p className="text-slate-300 text-sm mt-1">
              مطابق با تمام نیازمندی‌های مدل، DetailView، urls.py و قالب HTML استاندارد RTL با استایل‌های چاپی @media print.
            </p>
          </div>

          <button
            onClick={() => handleCopy(activeFile, getCode())}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow transition flex items-center gap-2 text-sm shrink-0 cursor-pointer"
          >
            {copiedFile === activeFile ? (
              <>
                <Check className="w-4 h-4 text-emerald-900" />
                <span>کپی شد!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>کپی کد {activeFile}</span>
              </>
            )}
          </button>
        </div>

        {/* File Tabs */}
        <div className="flex flex-wrap gap-2 mt-6 border-b border-slate-800 pb-3">
          {fileTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeFile === tab.name;
            return (
              <button
                key={tab.name}
                onClick={() => setActiveFile(tab.name)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Code Content Box */}
        <div className="mt-4 relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
          <div className="bg-slate-900 px-4 py-2 text-xs font-mono text-slate-400 flex items-center justify-between border-b border-slate-800">
            <span className="text-amber-400 font-bold">path/to/app/{activeFile}</span>
            <span>UTF-8 | Django 4.2+ / Python 3.10+</span>
          </div>

          <pre className="p-4 sm:p-6 text-xs sm:text-sm font-mono text-slate-200 overflow-x-auto leading-relaxed dir-ltr text-left">
            <code>{getCode()}</code>
          </pre>
        </div>
      </div>

      {/* Django Setup Quick Guide Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
          <Terminal className="w-5 h-5 text-amber-600" />
          <span>راهنمای راه‌اندازی و اجرای این پروژه در جنگو (Django Setup Guide)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-700">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="font-bold text-amber-800 mb-2">۱. ایجاد اپلیکیشن جدید</div>
            <code className="block bg-slate-900 text-amber-300 p-2 rounded text-xs dir-ltr text-left mb-2">
              python manage.py startapp receipts
            </code>
            <p className="text-xs text-slate-600">
              یک اپلیکیشن به نام <span className="font-mono bg-slate-200 px-1 rounded">receipts</span> بسازید و کدهای بالا را در فایل‌های مربوطه قرار دهید.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="font-bold text-amber-800 mb-2">۲. مایگریشن دیتابیس</div>
            <code className="block bg-slate-900 text-amber-300 p-2 rounded text-xs dir-ltr text-left mb-2">
              python manage.py makemigrations{'\n'}python manage.py migrate
            </code>
            <p className="text-xs text-slate-600">
              مدل <span className="font-mono bg-slate-200 px-1 rounded">FlourReceipt</span> در دیتابیس (SQLite/PostgreSQL) ایجاد می‌گردد.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="font-bold text-amber-800 mb-2">۳. اجرای سرور توسعه</div>
            <code className="block bg-slate-900 text-amber-300 p-2 rounded text-xs dir-ltr text-left mb-2">
              python manage.py runserver
            </code>
            <p className="text-xs text-slate-600">
              سپس می‌توانید با آدرس <span className="font-mono bg-slate-200 px-1 rounded">/receipts/1/</span> برگه حواله چاپی را مشاهده و پرینت کنید.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
