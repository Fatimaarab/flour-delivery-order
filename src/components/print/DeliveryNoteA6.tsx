import React from 'react';
import { IranPlateBadge } from '../IranPlate';
import { Logo } from '../Logo';
import { formatJalaliDate } from '../../lib/jalali';
import type { Receipt } from '../../lib/receiptApi';

/**
 * برگ حواله تحویل آرد.
 *
 * این برگه عمداً **هیچ مبلغی ندارد**. سند خروج بار است، نه فاکتور؛ دقیقاً
 * مثل فرم کاغذی فعلی کارخانه. راننده و نگهبان به قیمت کاری ندارند و نبودن
 * مبلغ روی برگه‌ای که دست راننده است، یک مزیت است نه کمبود.
 *
 * ── اندازه و خوانایی ─────────────────────────────────────────────────────
 * دو نسخه (انبار و باسکول) روی یک برگ A4 چاپ می‌شوند، یعنی هر نسخه نصف A4
 * است. این فضا اجازه می‌دهد فونت‌ها در حد ۱۲ تا ۱۴ پوینت بمانند که برای
 * راننده و انباردار در نور کارگاه خواناست.
 * ────────────────────────────────────────────────────────────────────────
 */
export interface DeliveryNoteProps {
  receipt: Receipt;
  shipment?: {
    driverName: string | null;
    driverNationalId: string | null;
    plateNumber: string | null;
    haulType?: 'COMPANY' | 'SELF';
    carrierCompany: string | null;
  } | null;
  companyName: string;
  /** برچسب نسخه، مثل «نسخه انبار» */
  copyLabel?: string;
}

const fa = (n: number) => n.toLocaleString('fa-IR');
const tons = (kg: number) =>
  (kg / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 2 });

export const DeliveryNoteA6: React.FC<DeliveryNoteProps> = ({
  receipt,
  shipment,
  companyName,
  copyLabel,
}) => {
  const singleItem = receipt.items.length === 1 ? receipt.items[0] : null;

  return (
    <div className="delivery-note border-2 border-black bg-white text-black px-3 py-2 flex flex-col">
      {/*
        سربرگ.

        ── چرا QR اینجا نیست ───────────────────────────────────────────────
        به درخواست کارفرما فعلاً برداشته شد. کنترل خروج از بین نرفته: نگهبان
        شماره حواله را در صفحه گیت وارد می‌کند و همان بررسی‌ها انجام می‌شود.
        به‌همین دلیل کد QR، صفحه گیت و مراحل بارگیری و خروج از سامانه حذف شده‌اند
        و صدور حواله آخرین مرحله است.
        ────────────────────────────────────────────────────────────────────
      */}
      <div className="flex items-center justify-between border-b-2 border-black pb-1.5 mb-1.5">
        <div className="flex items-center gap-2 flex-1 justify-center px-2">
          <Logo size={44} />
          <div className="text-center">
            <div className="font-black text-[20px] leading-tight whitespace-nowrap">
              {companyName}
            </div>
            <div className="font-bold text-[15px] mt-0.5 whitespace-nowrap">
              «برگ صدور حواله تحویل آرد»
            </div>
          </div>
        </div>

        <div className="text-left shrink-0 leading-snug">
          <div className="font-black text-[17px] whitespace-nowrap">
            شماره: <span className="font-mono">{receipt.receiptNumber}</span>
          </div>
          {copyLabel && (
            <div className="mt-1 border-2 border-black px-2 py-0.5 inline-block font-black text-[15px]">
              {copyLabel}
            </div>
          )}
        </div>
      </div>

      {/*
        متن اصلی — به سبک همان فرم کاغذی.

        مشخصات راننده و خودرو عمداً در این جمله نیامده؛ همه‌شان یک‌بار و با
        برچسب روشن در کادر زیر می‌آیند. پیش از این هم در متن بود و هم در
        کادر، که سه بار چاپ شدن یک پلاک، برگه را شلوغ و کندخوان می‌کرد.
      */}
      {/*
        ناحیه متن — تنها بخشی که اجازه دارد بریده شود.

        `min-h-0` و `overflow-hidden` در کنار `shrink-0` روی کادر امضاها، با
        هم یک قانون را تضمین می‌کنند: اگر محتوا از ارتفاع برگه بیشتر شد،
        چیزی که بیرون می‌افتد از **وسط** متن است، نه امضاها.

        پیش از این برعکس بود: کادر امضاها با `mt-auto` ته برگه می‌نشست و
        هرچه متن بلندتر می‌شد آن را از لبه پایین بیرون می‌راند. روی حواله‌ای
        با دو قلم کالا و یک سطر توضیحات، امضاها و نام‌ها ۱۷ میلی‌متر پایین‌تر
        از لبه کاغذ می‌افتادند — یعنی در چاپ اصلاً دیده نمی‌شدند.
      */}
      <div className="text-[16px] leading-[1.55] flex-1 min-h-0 overflow-hidden">
        {singleItem ? (
          <p>
            در تاریخ <U>{formatJalaliDate(receipt.issueDate)}</U> تعداد{' '}
            <U>{fa(singleItem.bagCount)}</U> کیسه <U>{singleItem.product.name}</U> جهت حمل
            به مقصد <U>{receipt.customer.name}</U> تحویل راننده مشخص‌شده در کادر زیر گردید.
          </p>
        ) : (
          <>
            <p>
              در تاریخ <U>{formatJalaliDate(receipt.issueDate)}</U> اقلام زیر جهت حمل به
              مقصد <U>{receipt.customer.name}</U> تحویل راننده مشخص‌شده در کادر زیر گردید:
            </p>
            <table className="w-full border-collapse border border-black my-1 text-[14.5px] leading-tight text-center">
              <thead>
                <tr className="bg-slate-100 font-bold">
                  <th className="border border-black px-1 py-0.5">نوع آرد</th>
                  <th className="border border-black px-1 py-0.5">تعداد کیسه</th>
                  <th className="border border-black px-1 py-0.5">وزن</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((i) => (
                  <tr key={i.id}>
                    <td className="border border-black px-1 py-0.5 text-right">{i.product.name}</td>
                    <td className="border border-black px-1 py-0.5 font-bold">{fa(i.bagCount)}</td>
                    <td className="border border-black px-1 py-0.5">{tons(i.weightKg)} تُن</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/*
          مشخصات راننده و خودرو — تنها جای این اطلاعات روی برگه.

          نگهبان گیت باید در یک نگاه پلاک و کد ملی را با کارت راننده و خود
          کامیون تطبیق دهد؛ برای همین با برچسب روشن و جدا از متن می‌آید.

          پلاک فقط به شکل گرافیکی (همان قالب پلاک ایرانی) چاپ می‌شود، نه
          هم‌زمان متنی و گرافیکی. تطبیق تصویر پلاک با پلاک واقعی خودرو از
          خواندن یک رشته عدد سریع‌تر و کم‌اشتباه‌تر است.
        */}
        {/*
          پلاک در یک ستون و چهار خانه دیگر کنارش، در دو سطر.

          قبلاً پلاک یک سطر کامل برای خودش داشت. با این چیدمان همان
          اطلاعات در ارتفاع کمتری جا می‌شود — و همین ارتفاع است که اجازه
          می‌دهد دو نسخه با حاشیه امن روی یک کاغذ بنشینند.
        */}
        <div className="mt-1 border-2 border-black rounded grid grid-cols-3 text-[14.5px] leading-tight">
          <div className="row-span-2 px-1.5 py-1 border-l border-black flex flex-col justify-center">
            <div className="text-[11.5px] text-slate-600 font-bold">پلاک خودرو</div>
            <div className="mt-0.5">
              {shipment?.plateNumber ? (
                <IranPlateBadge plateString={shipment.plateNumber} size="xl" />
              ) : (
                <span className="font-black">—</span>
              )}
            </div>
          </div>
          <Field label="نام راننده" value={shipment?.driverName ?? '—'} />
          <Field label="کد ملی راننده" value={shipment?.driverNationalId ?? '—'} mono last />
          <Field label="حمل" value={haulText(shipment)} top />
          <Field label="وزن کل بار" value={`${tons(receipt.totalWeightKg)} تُن`} top last />
        </div>

        {/*
          توضیحات حواله — اگر ثبت شده باشد، حداکثر در دو سطر. متن بلند پیش
          از این می‌توانست جدول اقلام را از برگه بیرون براند.
        */}
        {receipt.notes && (
          <div className="mt-1 border border-black rounded px-2 py-0.5 text-[14px] leading-snug">
            <p className="line-clamp-2">
              <span className="font-black">توضیحات: </span>
              <span>{receipt.notes}</span>
            </p>
          </div>
        )}

        {/* تعهدات — عیناً از فرم فعلی کارخانه */}
        <div className="mt-1 text-[12.5px] leading-tight">
          <p>• راننده پس از تحویل در مقصد ملزم به دریافت رسید از تحویل‌گیرنده می‌باشد.</p>
          <p>• ضمانت صحیح و سالم رسیدن بار فوق به عهده راننده می‌باشد.</p>
        </div>
      </div>

      {/*
        امضاها — نام افراد زیر هر امضا چاپ می‌شود.

        پیش از این فقط عبارت «نام و نام خانوادگی» خالی چاپ می‌شد و باید دستی
        پر می‌شد. حالا نام صادرکننده و راننده از خود سامانه می‌آید؛ هم سریع‌تر
        است و هم جای جعل یا اشتباه کمتری می‌ماند.
      */}
      <div className="shrink-0 flex items-end justify-between mt-auto pt-1 text-[14px] leading-tight text-center">
        <div className="w-[46%]">
          <div className="font-black mb-4">امضاء مسئول صدور حواله</div>
          <div className="border-t border-dotted border-black pt-1 font-bold">
            {receipt.issuedBy.fullName}
          </div>
        </div>
        <div className="w-[46%]">
          <div className="font-black mb-4">امضاء راننده</div>
          <div className="border-t border-dotted border-black pt-1 font-bold">
            {/*
              اگر راننده ثبت نشده باشد، خط خالی می‌ماند تا دستی نوشته شود.
              پیش از این عبارت «نام و نام خانوادگی» چاپ می‌شد که روی برگه
              به نظر می‌رسید نام حذف شده است.
            */}
            {shipment?.driverName?.trim() || '\u00A0'}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * «حمل» روی برگه: یا نام شرکت حمل‌ونقل، یا «خود حمل».
 *
 * خالی گذاشتن برای خود حمل درست نیست — نگهبان نمی‌تواند تشخیص دهد که
 * شرکتی در کار نبوده یا فقط ثبت نشده است.
 */
function haulText(shipment: DeliveryNoteProps['shipment']): string {
  if (!shipment) return '—';
  if (shipment.haulType === 'SELF') return 'خود حمل';
  return shipment.carrierCompany?.trim() || '—';
}

/** یک خانه از جدول مشخصات راننده. */
const Field: React.FC<{
  label: string;
  value: string;
  mono?: boolean;
  /** آخرین خانه سطر — خط جداکننده کناری ندارد */
  last?: boolean;
  /** خانه سطر دوم — خط جداکننده بالایی دارد */
  top?: boolean;
}> = ({ label, value, mono, last, top }) => (
  <div
    className={`px-1.5 py-0.5 ${last ? '' : 'border-l border-black'} ${
      top ? 'border-t border-black' : ''
    }`}
  >
    <div className="text-[11.5px] text-slate-600 font-bold">{label}</div>
    <div className={`font-black ${mono ? 'font-mono' : ''}`}>{value}</div>
  </div>
);

/** مقدار متغیر، با خط‌چین زیرش — مثل جای خالی فرم کاغذی که پر شده باشد. */
const U: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="font-black border-b border-dotted border-black px-1">{children}</span>
);
