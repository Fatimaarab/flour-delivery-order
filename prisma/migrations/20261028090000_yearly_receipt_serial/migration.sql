-- شماره حواله هر سال از نو شروع می‌شود.
--
-- پیش از این یک شمارنده سراسری (`receipt_serial_last`) و یک پیشوند ثابت
-- (`receipt_serial_prefix`) وجود داشت. حالا سال از تاریخ صدور گرفته می‌شود و
-- هر سال شمارنده خودش را دارد: `receipt_serial_last:1405`.
--
-- این مهاجرت شمارنده قدیمی را به سالی که به آن تعلق داشت منتقل می‌کند تا
-- شماره‌ها در همان سال ادامه پیدا کنند و با حواله‌های موجود تداخل نکنند.

INSERT OR IGNORE INTO "Setting" ("key", "value", "updatedAt")
SELECT
  'receipt_serial_last:' || p."value",
  c."value",
  CURRENT_TIMESTAMP
FROM "Setting" c
JOIN "Setting" p ON p."key" = 'receipt_serial_prefix'
WHERE c."key" = 'receipt_serial_last';

-- کلیدهای قدیمی دیگر خوانده نمی‌شوند. اگر بمانند، کسی ممکن است پیشوند را
-- عوض کند و انتظار داشته باشد اثری داشته باشد.
DELETE FROM "Setting" WHERE "key" IN ('receipt_serial_last', 'receipt_serial_prefix');
