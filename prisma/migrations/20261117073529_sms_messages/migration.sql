-- CreateTable
CREATE TABLE "SmsMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "receiptId" INTEGER,
    "recipient" TEXT NOT NULL,
    "recipientKind" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "providerRef" TEXT,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    CONSTRAINT "SmsMessage_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SmsMessage_status_idx" ON "SmsMessage"("status");

-- CreateIndex
CREATE INDEX "SmsMessage_receiptId_idx" ON "SmsMessage"("receiptId");
