/**
 * داده نمونه برای دمو و آموزش پرسنل.
 *
 * ⚠️ محصولات، قیمت‌ها و مشتریان زیر **فرضی‌اند** و باید با اطلاعات واقعی
 * کارخانه جایگزین شوند. همه‌شان از طریق صفحات «محصولات» و «مشتریان» قابل
 * ویرایش‌اند — نیازی به تغییر کد نیست.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'ard@1404';

/**
 * نام افراد، نه عنوان شغلی.
 *
 * پیش از این نام مدیر «مدیر سامانه» بود و بقیه عنوان نقش را داخل پرانتز
 * داشتند. همین رشته زیر امضای برگه حواله چاپ می‌شد؛ یعنی روی یک سند رسمی،
 * به‌جای نام امضاکننده، عنوان شغلی‌اش می‌نشست.
 *
 * این‌ها داده نمونه‌اند — نام واقعی هر کاربر از صفحه «کاربران» قابل ویرایش
 * است.
 */
const USERS = [
  { username: 'admin', fullName: 'علیرضا عرب‌آبادی', role: 'ADMIN' as const },
  { username: 'sales', fullName: 'علی رضایی', role: 'SALES' as const },
  { username: 'finance', fullName: 'مریم احمدی', role: 'FINANCE' as const },
  { username: 'warehouse', fullName: 'حسین کریمی', role: 'WAREHOUSE' as const },
  { username: 'viewer', fullName: 'سمیرا دادگر', role: 'VIEWER' as const },
];

// قیمت‌ها به ریال بر کیلوگرم — فرضی
const PRODUCTS = [
  {
    code: 'FL-15',
    name: 'آرد خبازی نوع ۱ (یارانه‌ای)',
    description: 'سبوس‌گیری ۱۵٪ — مخصوص نان لواش و تافتون',
    bagWeightKg: 40,
    basePricePerKg: 12_000,
    pricingCategory: 'SUBSIDISED' as const,
    vatPercent: 0,
    initialStockKg: 240_000,
  },
  {
    code: 'FL-18',
    name: 'آرد خبازی نوع ۲ (نیمه یارانه‌ای)',
    description: 'سبوس‌گیری ۱۸٪ — مخصوص نان بربری و سنگک',
    bagWeightKg: 40,
    basePricePerKg: 15_000,
    pricingCategory: 'SUBSIDISED' as const,
    vatPercent: 0,
    initialStockKg: 320_000,
  },
  {
    code: 'FL-ST',
    name: 'آرد ستاره فانتزی',
    description: 'سبوس‌گیری ۲۱٪ — مخصوص نان فانتزی و باگت',
    bagWeightKg: 40,
    basePricePerKg: 38_000,
    pricingCategory: 'FREE' as const,
    vatPercent: 10,
    initialStockKg: 160_000,
  },
  {
    code: 'FL-NL',
    name: 'آرد نول قنادی و صنعتی',
    description: 'سبوس‌گیری ۲۷٪ — مخصوص شیرینی‌پزی و کیک',
    bagWeightKg: 50,
    basePricePerKg: 46_000,
    pricingCategory: 'FREE' as const,
    vatPercent: 10,
    initialStockKg: 120_000,
  },
  {
    code: 'BR-WH',
    name: 'سبوس گندم',
    description: 'سبوس خالص — خوراک دام و طیور',
    bagWeightKg: 30,
    basePricePerKg: 9_000,
    pricingCategory: 'FREE' as const,
    vatPercent: 10,
    initialStockKg: 80_000,
  },
];

const CUSTOMERS = [
  {
    code: 'NB-4819',
    kind: 'INDIVIDUAL' as const,
    type: 'BAKERY' as const,
    name: 'نانوایی سنگک مرکزی برکت',
    nationalId: '0499370899',
    phone: '05143221100',
    address: 'نیشابور، خیابان امام رضا، پلاک ۱۲',
    creditLimit: 5_000_000_000,
    monthlyQuotaKg: 30_000,
  },
  {
    code: 'COP-9021',
    kind: 'COMPANY' as const,
    type: 'WHOLESALER' as const,
    name: 'شرکت تعاونی مصرف نانوایان مشهد',
    nationalId: '10380284655',
    economicCode: '411133335555',
    phone: '05138442200',
    address: 'مشهد، فاز دو شهرک صنعتی توس',
    creditLimit: 20_000_000_000,
    monthlyQuotaKg: 200_000,
  },
  {
    code: 'IND-3340',
    kind: 'COMPANY' as const,
    type: 'GUILD_INDUSTRY' as const,
    name: 'صنایع غذایی و شیرینی‌پزی طوس',
    nationalId: '10861234565',
    economicCode: '411199998888',
    phone: '05135410099',
    address: 'مشهد، شهرک صنعتی توس، فاز ۳',
    creditLimit: 12_000_000_000,
    monthlyQuotaKg: 0,
  },
  {
    code: 'FAN-1108',
    kind: 'INDIVIDUAL' as const,
    type: 'BAKERY' as const,
    name: 'نان فانتزی و باگت بهاران',
    nationalId: '0790419904',
    phone: '05136098877',
    address: 'مشهد، بلوار وکیل‌آباد، نبش وکیل‌آباد ۲۲',
    creditLimit: 3_000_000_000,
    monthlyQuotaKg: 12_000,
  },
];

const SETTINGS = [
  { key: 'vat_percent_free', value: '10' },
  { key: 'vat_percent_subsidised', value: '0' },
  { key: 'receipt_validity_days', value: '7' },
  { key: 'weight_variance_percent', value: '2' },
  { key: 'company_name', value: 'شرکت آرد طلای سفید ماهان' },
  // پیشوند شماره حواله اینجا نیست: سال شمسی از تاریخ صدور گرفته می‌شود و
  // شمارنده هر سال خودکار از ۱ شروع می‌شود — نگاه کنید به serial.ts
];

/**
 * نصب روی سرور واقعی (`ARD_PRODUCTION=1`): بدون هیچ داده نمونه.
 *
 * فقط یک کاربر مدیر با رمز تصادفی (که نصب‌کننده می‌سازد و یک‌بار نشان می‌دهد)
 * و تنظیمات پایه ساخته می‌شود. مشتری، محصول، راننده و بقیه کاربران را خود
 * کارخانه با اطلاعات واقعی وارد می‌کند — قیمت‌های فرضی یا رمز `ard@1404`
 * نباید هرگز روی سیستم واقعی بماند.
 */
async function seedProduction() {
  const password = process.env.ARD_ADMIN_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error('ARD_ADMIN_PASSWORD is missing or too short (min 8).');
  }
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      // این نام زیر امضای برگه حواله چاپ می‌شود؛ مدیر باید در «کاربران» نام واقعی‌اش را بگذارد
      fullName: 'مدیر سیستم',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash(password, 12),
    },
  });
  for (const s of SETTINGS) {
    await prisma.setting.upsert({ where: { key: s.key }, update: {}, create: s });
  }
  console.log('✔ Production seed: admin user + base settings only (no demo data)');
}

async function main() {
  if (process.env.ARD_PRODUCTION === '1') return seedProduction();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  for (const u of USERS) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: { fullName: u.fullName, role: u.role },
      create: { ...u, passwordHash },
    });
  }
  console.log(`✔ ${USERS.length} کاربر نمونه ساخته شد`);

  for (const { initialStockKg, ...p } of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { code: p.code },
      update: p,
      create: p,
    });
    await prisma.stock.upsert({
      where: { productId: product.id },
      update: {},
      create: { productId: product.id, onHandKg: initialStockKg, reservedKg: 0 },
    });
  }
  console.log(`✔ ${PRODUCTS.length} محصول و موجودی اولیه‌شان ثبت شد`);

  for (const c of CUSTOMERS) {
    await prisma.customer.upsert({ where: { code: c.code }, update: c, create: c });
  }
  console.log(`✔ ${CUSTOMERS.length} مشتری نمونه ساخته شد`);

  // رانندگان نمونه — فرضی؛ از بخش «رانندگان» قابل ویرایش و حذف‌اند
  const DRIVERS = [
    { fullName: 'اصغر محمدی', nationalId: '0499370899', mobile: '09123456789', plateNumber: '44ع789ایران77' },
    { fullName: 'حمید کاظمی', nationalId: '1234567891', mobile: '09151234567', plateNumber: '12ب345ایران10' },
  ];
  for (const d of DRIVERS) {
    await prisma.driver.upsert({ where: { nationalId: d.nationalId }, update: {}, create: d });
  }
  console.log(`✔ ${DRIVERS.length} راننده نمونه ساخته شد`);

  for (const s of SETTINGS) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }
  console.log(`✔ ${SETTINGS.length} تنظیم پایه ثبت شد`);

  console.log(`\nرمز عبور همه کاربران نمونه: ${DEMO_PASSWORD}`);
  console.log('⚠️ پیش از استفاده واقعی، حتماً رمزها را عوض کنید.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
