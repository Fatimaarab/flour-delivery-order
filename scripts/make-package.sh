#!/usr/bin/env bash
#
# ساخت بسته نصب ویندوز.
#
# خروجی یک فایل zip است که روی یک ویندوز تازه باز می‌شود و با 1-INSTALL.bat
# نصب می‌شود. node_modules داخلش نیست — روی خود ویندوز نصب می‌شود، چون
# بسته‌های Prisma و esbuild فایل اجرایی مخصوص همان سیستم‌عامل دارند و
# node_modules ساخته‌شده روی مک روی ویندوز کار نمی‌کند.
#
# اجرا:  bash scripts/make-package.sh [مسیر-خروجی]

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$HOME/Downloads/ard-havaleh.zip}"
STAGE="$(mktemp -d)/ard-havaleh"

cleanup() { rm -rf "$(dirname "$STAGE")"; }
trap cleanup EXIT

mkdir -p "$STAGE"

# فایل‌های تکی در ریشه
for f in \
  1-INSTALL.bat 2-START.bat 3-SERVER-ON.bat 4-SERVER-OFF.bat \
  START-HERE.md README.md DEPLOY.md USER-GUIDE.md TEST-ME.md UAT-CHECKLIST.md \
  PLAN.md AUDIT.md REVIEW.md \
  package.json package-lock.json \
  tsconfig.json vite.config.ts vitest.config.ts vitest.globalSetup.ts \
  index.html .env.example .gitignore
do
  cp "$ROOT/$f" "$STAGE/$f"
done

# پوشه‌های کد و دارایی‌ها
#
# data/ عمداً کپی نمی‌شود: پایگاه داده روی خود ویندوز ساخته می‌شود و
# فرستادن یک دیتابیس آزمایشی یعنی کارخانه با داده الکی شروع کند.
for d in src server shared prisma public scripts; do
  rsync -a \
    --exclude 'data/' \
    --exclude '*.db' \
    --exclude '*.db-journal' \
    --exclude '.DS_Store' \
    "$ROOT/$d/" "$STAGE/$d/"
done

# فایل‌های .bat باید پایان خط ویندوزی داشته باشند، وگرنه cmd بدرفتاری می‌کند
for b in "$STAGE"/*.bat "$STAGE"/scripts/*.cmd; do
  perl -pi -e 's/\r?\n/\r\n/' "$b"
done

# راستی‌آزمایی: هیچ نویسه غیر-ASCII در .bat نباشد. متن فارسی داخل cmd
# ناخوانا چاپ می‌شود و می‌تواند تجزیه دستورها را هم خراب کند.
# (grep -P روی مک وجود ندارد، پس با perl بررسی می‌شود تا این مرحله
# بی‌صدا رد نشود.)
for b in "$STAGE"/*.bat "$STAGE"/scripts/*.cmd; do
  if ! perl -ne 'exit 1 if /[^\x00-\x7F]/' "$b"; then
    echo "خطا: نویسه غیر-ASCII در $(basename "$b")" >&2
    exit 1
  fi
done

rm -f "$OUT"
( cd "$(dirname "$STAGE")" && zip -rq "$OUT" ard-havaleh -x '*.DS_Store' )

echo "بسته ساخته شد: $OUT"
echo "حجم: $(du -h "$OUT" | cut -f1)"
echo "تعداد فایل: $(unzip -l "$OUT" | tail -1 | awk '{print $2}')"
