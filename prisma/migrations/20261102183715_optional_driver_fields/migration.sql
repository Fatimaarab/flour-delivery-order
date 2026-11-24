-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Shipment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "receiptId" INTEGER NOT NULL,
    "driverName" TEXT NOT NULL,
    "driverNationalId" TEXT,
    "driverMobile" TEXT,
    "plateNumber" TEXT,
    "haulType" TEXT NOT NULL DEFAULT 'COMPANY',
    "carrierCompany" TEXT,
    "tareWeightKg" INTEGER,
    "grossWeightKg" INTEGER,
    "netWeightKg" INTEGER,
    "varianceKg" INTEGER,
    "varianceApproved" BOOLEAN NOT NULL DEFAULT false,
    "loadedAt" DATETIME,
    "dispatchedAt" DATETIME,
    "gateUserId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Shipment_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Shipment" ("carrierCompany", "createdAt", "dispatchedAt", "driverMobile", "driverName", "driverNationalId", "gateUserId", "grossWeightKg", "haulType", "id", "loadedAt", "netWeightKg", "plateNumber", "receiptId", "tareWeightKg", "updatedAt", "varianceApproved", "varianceKg") SELECT "carrierCompany", "createdAt", "dispatchedAt", "driverMobile", "driverName", "driverNationalId", "gateUserId", "grossWeightKg", "haulType", "id", "loadedAt", "netWeightKg", "plateNumber", "receiptId", "tareWeightKg", "updatedAt", "varianceApproved", "varianceKg" FROM "Shipment";
DROP TABLE "Shipment";
ALTER TABLE "new_Shipment" RENAME TO "Shipment";
CREATE UNIQUE INDEX "Shipment_receiptId_key" ON "Shipment"("receiptId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
