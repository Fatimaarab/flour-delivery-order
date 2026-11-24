/*
  Warnings:

  - You are about to alter the column `balance` on the `Customer` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `creditLimit` on the `Customer` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `amount` on the `Payment` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `basePricePerKg` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `discount` on the `Receipt` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `grandTotal` on the `Receipt` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `paidAmount` on the `Receipt` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `subtotal` on the `Receipt` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `vatAmount` on the `Receipt` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `lineTotal` on the `ReceiptItem` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `unitPricePerKg` on the `ReceiptItem` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `vatAmount` on the `ReceiptItem` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Customer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nationalId" TEXT,
    "economicCode" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "creditLimit" BIGINT NOT NULL DEFAULT 0,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "monthlyQuotaKg" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_Customer" ("address", "balance", "code", "createdAt", "creditLimit", "deletedAt", "economicCode", "id", "isActive", "kind", "monthlyQuotaKg", "name", "nationalId", "phone", "type", "updatedAt") SELECT "address", "balance", "code", "createdAt", "creditLimit", "deletedAt", "economicCode", "id", "isActive", "kind", "monthlyQuotaKg", "name", "nationalId", "phone", "type", "updatedAt" FROM "Customer";
DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");
CREATE INDEX "Customer_name_idx" ON "Customer"("name");
CREATE INDEX "Customer_nationalId_idx" ON "Customer"("nationalId");
CREATE TABLE "new_Payment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "receiptId" INTEGER,
    "customerId" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,
    "method" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "chequeDueDate" DATETIME,
    "note" TEXT,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Payment_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amount", "chequeDueDate", "createdAt", "customerId", "deletedAt", "id", "method", "note", "receiptId", "referenceNumber", "userId") SELECT "amount", "chequeDueDate", "createdAt", "customerId", "deletedAt", "id", "method", "note", "receiptId", "referenceNumber", "userId" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE INDEX "Payment_customerId_createdAt_idx" ON "Payment"("customerId", "createdAt");
CREATE INDEX "Payment_receiptId_idx" ON "Payment"("receiptId");
CREATE TABLE "new_Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "bagWeightKg" INTEGER NOT NULL,
    "basePricePerKg" BIGINT NOT NULL,
    "pricingCategory" TEXT NOT NULL,
    "vatPercent" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_Product" ("bagWeightKg", "basePricePerKg", "code", "createdAt", "deletedAt", "description", "id", "isActive", "name", "pricingCategory", "updatedAt", "vatPercent") SELECT "bagWeightKg", "basePricePerKg", "code", "createdAt", "deletedAt", "description", "id", "isActive", "name", "pricingCategory", "updatedAt", "vatPercent" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");
CREATE INDEX "Product_pricingCategory_idx" ON "Product"("pricingCategory");
CREATE TABLE "new_Receipt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "receiptNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "customerId" INTEGER NOT NULL,
    "issuedById" INTEGER NOT NULL,
    "issueDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" DATETIME NOT NULL,
    "subtotal" BIGINT NOT NULL DEFAULT 0,
    "discount" BIGINT NOT NULL DEFAULT 0,
    "vatAmount" BIGINT NOT NULL DEFAULT 0,
    "grandTotal" BIGINT NOT NULL DEFAULT 0,
    "paidAmount" BIGINT NOT NULL DEFAULT 0,
    "totalWeightKg" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "correctsReceiptId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Receipt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Receipt_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Receipt_correctsReceiptId_fkey" FOREIGN KEY ("correctsReceiptId") REFERENCES "Receipt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Receipt" ("correctsReceiptId", "createdAt", "customerId", "deletedAt", "discount", "grandTotal", "id", "idempotencyKey", "issueDate", "issuedById", "notes", "paidAmount", "receiptNumber", "status", "subtotal", "totalWeightKg", "updatedAt", "validUntil", "vatAmount") SELECT "correctsReceiptId", "createdAt", "customerId", "deletedAt", "discount", "grandTotal", "id", "idempotencyKey", "issueDate", "issuedById", "notes", "paidAmount", "receiptNumber", "status", "subtotal", "totalWeightKg", "updatedAt", "validUntil", "vatAmount" FROM "Receipt";
DROP TABLE "Receipt";
ALTER TABLE "new_Receipt" RENAME TO "Receipt";
CREATE UNIQUE INDEX "Receipt_receiptNumber_key" ON "Receipt"("receiptNumber");
CREATE UNIQUE INDEX "Receipt_idempotencyKey_key" ON "Receipt"("idempotencyKey");
CREATE INDEX "Receipt_status_idx" ON "Receipt"("status");
CREATE INDEX "Receipt_customerId_idx" ON "Receipt"("customerId");
CREATE INDEX "Receipt_issueDate_idx" ON "Receipt"("issueDate");
CREATE TABLE "new_ReceiptItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "receiptId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "bagCount" INTEGER NOT NULL,
    "bagWeightKg" INTEGER NOT NULL,
    "weightKg" INTEGER NOT NULL,
    "unitPricePerKg" BIGINT NOT NULL,
    "lineTotal" BIGINT NOT NULL,
    "vatPercent" INTEGER NOT NULL DEFAULT 0,
    "vatAmount" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "ReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReceiptItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ReceiptItem" ("bagCount", "bagWeightKg", "id", "lineTotal", "productId", "receiptId", "unitPricePerKg", "vatAmount", "vatPercent", "weightKg") SELECT "bagCount", "bagWeightKg", "id", "lineTotal", "productId", "receiptId", "unitPricePerKg", "vatAmount", "vatPercent", "weightKg" FROM "ReceiptItem";
DROP TABLE "ReceiptItem";
ALTER TABLE "new_ReceiptItem" RENAME TO "ReceiptItem";
CREATE INDEX "ReceiptItem_receiptId_idx" ON "ReceiptItem"("receiptId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
