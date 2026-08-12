export const DJANGO_MODELS_PY = `# models.py
from django.db import models

class FlourReceipt(models.Model):
    """
    مدل دیتابیس برای ذخیره‌سازی اطلاعات «برگ صدور حواله تحویل آرد»
    شرکت آرد طلای سفید ماهان
    پشتیبانی از دو نسخه (نسخه انبار + نسخه باسکول) و توضیحات تکمیلی
    """
    receipt_number = models.CharField(
        max_length=50, 
        unique=True, 
        verbose_name="شماره حواله"
    )
    issue_date = models.CharField(
        max_length=20, 
        verbose_name="تاریخ صدور (شمسی)"
    )
    bag_count = models.PositiveIntegerField(
        verbose_name="تعداد کیسه آرد"
    )
    driver_name = models.CharField(
        max_length=150, 
        verbose_name="نام و نام خانوادگی راننده"
    )
    truck_number = models.CharField(
        max_length=50, 
        verbose_name="شماره کامیون / پلاک"
    )
    driver_national_id = models.CharField(
        max_length=10, 
        verbose_name="کد ملی راننده"
    )
    destination = models.CharField(
        max_length=255, 
        verbose_name="محل مقصد"
    )
    description = models.TextField(
        blank=True, 
        null=True, 
        verbose_name="توضیحات تکمیلی (نوع آرد، یادداشت انبار یا وزن باسکول)"
    )
    created_at = models.DateTimeField(
        auto_now_add=True, 
        verbose_name="زمان ایجاد رکورد"
    )

    class Meta:
        verbose_name = "حواله تحویل آرد"
        verbose_name_plural = "حواله‌های تحویل آرد"
        ordering = ['-created_at']

    def __str__(self):
        return f"حواله شماره {self.receipt_number} - {self.driver_name}"
`;

export const DJANGO_VIEWS_PY = `# views.py
from django.views.generic import DetailView, ListView, CreateView, UpdateView
from django.urls import reverse_lazy
from .models import FlourReceipt

class FlourReceiptDetailView(DetailView):
    """
    ویو جهت دریافت اطلاعات یک حواله خاص و رندر دو نسخه همزمان
    (نسخه انبار و نسخه باسکول) در یک صفحه چاپی
    """
    model = FlourReceipt
    template_name = 'receipts/receipt_detail.html'
    context_object_name = 'receipt'


class FlourReceiptListView(ListView):
    """
    ویوی مشاهده لیست کلیه حواله‌های صادر شده با قابلیت جستجو
    """
    model = FlourReceipt
    template_name = 'receipts/receipt_list.html'
    context_object_name = 'receipts'
    paginate_by = 10


class FlourReceiptCreateView(CreateView):
    """
    ویوی ثبت حواله جدید همراه با توضیحات تکمیلی
    """
    model = FlourReceipt
    fields = [
        'receipt_number', 'issue_date', 'bag_count',
        'driver_name', 'truck_number', 'driver_national_id', 
        'destination', 'description'
    ]
    template_name = 'receipts/receipt_form.html'
    success_url = reverse_lazy('receipt_list')


class FlourReceiptUpdateView(UpdateView):
    """
    ویوی ویرایش اطلاعات حواله و توضیحات
    """
    model = FlourReceipt
    fields = [
        'receipt_number', 'issue_date', 'bag_count',
        'driver_name', 'truck_number', 'driver_national_id', 
        'destination', 'description'
    ]
    template_name = 'receipts/receipt_form.html'
    success_url = reverse_lazy('receipt_list')
`;

export const DJANGO_URLS_PY = `# urls.py
from django.urls import path
from .views import (
    FlourReceiptDetailView, 
    FlourReceiptListView, 
    FlourReceiptCreateView,
    FlourReceiptUpdateView
)

urlpatterns = [
    # آدرس مشاهده و چاپ برگه دو نسخه‌ای حواله بر اساس کلید اصلی (pk)
    path('receipts/<int:pk>/', FlourReceiptDetailView.as_view(), name='receipt_detail'),
    
    # آدرس‌های مدیریت و ویرایش
    path('receipts/', FlourReceiptListView.as_view(), name='receipt_list'),
    path('receipts/create/', FlourReceiptCreateView.as_view(), name='receipt_create'),
    path('receipts/<int:pk>/edit/', FlourReceiptUpdateView.as_view(), name='receipt_update'),
]
`;

export const DJANGO_ADMIN_PY = `# admin.py
from django.contrib import admin
from .models import FlourReceipt

@admin.register(FlourReceipt)
class FlourReceiptAdmin(admin.ModelAdmin):
    list_display = ('receipt_number', 'issue_date', 'driver_name', 'bag_count', 'destination', 'created_at')
    search_fields = ('receipt_number', 'driver_name', 'driver_national_id', 'truck_number', 'destination', 'description')
    list_filter = ('issue_date', 'created_at')
    ordering = ('-created_at',)
`;

export const DJANGO_TEMPLATE_HTML = `<!-- receipt_detail.html (شامل دو نسخه: نسخه انبار + نسخه باسکول) -->
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>برگ صدور حواله تحویل آرد (نسخه انبار و باسکول) - {{ receipt.receipt_number }}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700;800&display=swap');
        
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Vazirmatn', Tahoma, sans-serif;
            background-color: #f8fafc;
            color: #0f172a;
            direction: rtl;
            text-align: right;
            padding: 20px;
        }

        .container {
            width: 100%;
            max-width: 850px;
            margin: 0 auto;
        }

        /* کادر هر نسخه */
        .receipt-card {
            background-color: #ffffff;
            border: 2px solid #0f172a;
            border-radius: 8px;
            padding: 25px 30px;
            margin-bottom: 25px;
            position: relative;
        }

        /* جدول هدر */
        .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
        }

        .receipt-number-box {
            font-size: 15px;
            font-weight: 700;
            width: 30%;
        }

        .company-header {
            text-align: center;
            width: 40%;
        }

        .company-header h1 {
            font-size: 18px;
            font-weight: 800;
            margin-bottom: 4px;
        }

        .company-header h2 {
            font-size: 15px;
            font-weight: 700;
            background-color: #f1f5f9;
            display: inline-block;
            padding: 2px 12px;
            border-radius: 4px;
            border: 1px solid #cbd5e1;
        }

        .badge-cell {
            width: 30%;
            text-align: left;
            vertical-align: top;
        }

        .copy-badge {
            display: inline-block;
            padding: 4px 10px;
            font-weight: 800;
            font-size: 13px;
            border-radius: 6px;
            border: 2px solid #0f172a;
        }

        .badge-warehouse {
            background-color: #fef3c7;
            color: #78350f;
            border-color: #d97706;
        }

        .badge-scale {
            background-color: #dbeafe;
            color: #1e3a8a;
            border-color: #2563eb;
        }

        /* متن اصلی برگه */
        .content-box {
            line-height: 2.1;
            font-size: 15px;
            margin: 15px 0;
            text-align: justify;
        }

        .variable-value {
            font-weight: 700;
            border-bottom: 2px dotted #d97706;
            padding: 0 6px;
        }

        /* باکس توضیحات کاربر */
        .description-box {
            background-color: #fffbeb;
            border: 1px solid #fde68a;
            border-radius: 6px;
            padding: 10px 14px;
            margin: 12px 0;
            font-size: 14px;
        }

        .description-title {
            font-weight: 700;
            color: #92400e;
            margin-bottom: 4px;
        }

        /* جدول امضاها */
        .signatures-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 30px;
        }

        .signatures-table td {
            width: 50%;
            text-align: center;
            vertical-align: top;
        }

        .signature-title {
            font-weight: 700;
            font-size: 14px;
            margin-bottom: 45px;
        }

        .signature-line {
            border-top: 1px dashed #64748b;
            width: 75%;
            margin: 0 auto;
            font-size: 12px;
            color: #64748b;
            padding-top: 4px;
        }

        /* خط برش بین دو نسخه */
        .cut-line {
            border-top: 2px dashed #94a3b8;
            margin: 25px 0;
            text-align: center;
            position: relative;
        }

        .cut-line span {
            background-color: #f8fafc;
            padding: 2px 12px;
            font-size: 12px;
            font-weight: bold;
            color: #64748b;
            position: relative;
            top: -12px;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
        }

        /* دکمه چاپ */
        .actions-bar {
            text-align: center;
            margin-bottom: 20px;
        }

        .btn-print {
            background-color: #d97706;
            color: #ffffff;
            border: none;
            padding: 10px 28px;
            font-size: 15px;
            font-weight: 700;
            font-family: inherit;
            border-radius: 8px;
            cursor: pointer;
        }

        @media print {
            .no-print { display: none !important; }
            body { background-color: #fff !important; padding: 0 !important; }
            .cut-line span { background-color: #fff !important; }
            .receipt-card { page-break-inside: avoid; }
        }
    </style>
</head>
<body>

    <div class="actions-bar no-print">
        <button onclick="window.print()" class="btn-print">
            🖨️ چاپ هر دو نسخه (انبار + باسکول)
        </button>
    </div>

    <div class="container">

        <!-- ================= نسخه اول: نسخه انبار ================= -->
        <div class="receipt-card">
            <table class="header-table">
                <tr>
                    <td class="receipt-number-box">
                        شماره: <span class="variable-value">{{ receipt.receipt_number }}</span><br>
                        تاریخ: <span>{{ receipt.issue_date }}</span>
                    </td>
                    <td class="company-header">
                        <h1>شرکت آرد طلای سفید ماهان</h1>
                        <h2>«برگ صدور حواله تحویل آرد»</h2>
                    </td>
                    <td class="badge-cell">
                        <span class="copy-badge badge-warehouse">🏭 نسخه انبار</span>
                    </td>
                </tr>
            </table>

            <div class="content-box">
                <p>
                    در تاریخ <span class="variable-value">{{ receipt.issue_date }}</span>
                    تعداد <span class="variable-value">{{ receipt.bag_count }}</span> کیسه آرد
                    تحویل راننده کامیون آقای <span class="variable-value">{{ receipt.driver_name }}</span>
                    به شماره کامیون <span class="variable-value">{{ receipt.truck_number }}</span>
                    و کدملی <span class="variable-value">{{ receipt.driver_national_id }}</span>
                    جهت حمل به مقصد <span class="variable-value">{{ receipt.destination }}</span> تحویل گردید.
                </p>

                {% if receipt.description %}
                <div class="description-box">
                    <div class="description-title">📌 توضیحات و یادداشت‌های انبار:</div>
                    <p>{{ receipt.description }}</p>
                </div>
                {% endif %}

                <div style="font-size: 13px; margin-top: 10px; color: #334155;">
                    <p>• راننده پس از تحویل در مقصد ملزم به دریافت رسید از تحویل گیرنده می باشد.</p>
                    <p>• ضمانت صحیح و سالم رسیدن بار فوق به عهده راننده می باشد.</p>
                </div>
            </div>

            <table class="signatures-table">
                <tr>
                    <td>
                        <div class="signature-title">امضاء مسئول انبار و صدور</div>
                        <div class="signature-line">محل مهر و امضاء انباردار</div>
                    </td>
                    <td>
                        <div class="signature-title">امضاء راننده کامیون</div>
                        <div class="signature-line">امضاء و اثر انگشت راننده</div>
                    </td>
                </tr>
            </table>
        </div>

        <!-- ================= خط برش برگه ================= -->
        <div class="cut-line">
            <span>✂️ محل برش برگه (نسخه انبار / نسخه باسکول)</span>
        </div>

        <!-- ================= نسخه دوم: نسخه باسکول ================= -->
        <div class="receipt-card">
            <table class="header-table">
                <tr>
                    <td class="receipt-number-box">
                        شماره: <span class="variable-value">{{ receipt.receipt_number }}</span><br>
                        تاریخ: <span>{{ receipt.issue_date }}</span>
                    </td>
                    <td class="company-header">
                        <h1>شرکت آرد طلای سفید ماهان</h1>
                        <h2>«برگ صدور حواله تحویل آرد»</h2>
                    </td>
                    <td class="badge-cell">
                        <span class="copy-badge badge-scale">⚖️ نسخه باسکول</span>
                    </td>
                </tr>
            </table>

            <div class="content-box">
                <p>
                    در تاریخ <span class="variable-value">{{ receipt.issue_date }}</span>
                    تعداد <span class="variable-value">{{ receipt.bag_count }}</span> کیسه آرد
                    تحویل راننده کامیون آقای <span class="variable-value">{{ receipt.driver_name }}</span>
                    به شماره کامیون <span class="variable-value">{{ receipt.truck_number }}</span>
                    و کدملی <span class="variable-value">{{ receipt.driver_national_id }}</span>
                    جهت حمل به مقصد <span class="variable-value">{{ receipt.destination }}</span> تحویل گردید.
                </p>

                {% if receipt.description %}
                <div class="description-box">
                    <div class="description-title">📌 توضیحات و یادداشت‌های باسکول:</div>
                    <p>{{ receipt.description }}</p>
                </div>
                {% endif %}

                <div style="font-size: 13px; margin-top: 10px; color: #334155;">
                    <p>• راننده پس از تحویل در مقصد ملزم به دریافت رسید از تحویل گیرنده می باشد.</p>
                    <p>• ضمانت صحیح و سالم رسیدن بار فوق به عهده راننده می باشد.</p>
                </div>
            </div>

            <table class="signatures-table">
                <tr>
                    <td>
                        <div class="signature-title">امضاء متصدی باسکول</div>
                        <div class="signature-line">محل مهر و امضاء متصدی</div>
                    </td>
                    <td>
                        <div class="signature-title">امضاء راننده کامیون</div>
                        <div class="signature-line">امضاء و اثر انگشت راننده</div>
                    </td>
                </tr>
            </table>
        </div>

    </div>

</body>
</html>
`;
