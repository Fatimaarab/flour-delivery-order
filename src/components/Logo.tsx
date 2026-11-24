import React from 'react';

/**
 * لوگوی رسمی شرکت.
 *
 * فایل اصلی پس‌زمینه سفید دارد (نه شفاف). روی برگه چاپی این اصلاً دیده
 * نمی‌شود چون کاغذ هم سفید است؛ اما روی نوار تیره بالای صفحه، لوگو داخل یک
 * قاب سفید گرد گذاشته می‌شود تا عمدی و تمیز به نظر برسد.
 */
interface LogoProps {
  /** اندازه بر حسب پیکسل */
  size?: number;
  /** قاب سفید گرد — برای پس‌زمینه‌های تیره */
  framed?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 40, framed = false, className = '' }) => {
  const image = (
    <img
      src="/logo.png"
      width={size}
      height={size}
      alt="لوگوی شرکت آرد طلای سفید"
      className="block object-contain"
      style={{ width: size, height: size }}
    />
  );

  if (!framed) return <span className={className}>{image}</span>;

  return (
    <span
      className={`inline-flex items-center justify-center bg-white rounded-2xl overflow-hidden shrink-0 ring-1 ring-black/5 shadow-xs ${className}`}
      style={{ width: size, height: size, padding: Math.round(size * 0.06) }}
    >
      {image}
    </span>
  );
};
