-- CreateTable
CREATE TABLE "CreditPack" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "creditAmount" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "priceCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditPack_name_key" ON "CreditPack"("name");

-- CreateIndex
CREATE INDEX "CreditPack_name_idx" ON "CreditPack"("name");

-- CreateIndex
CREATE INDEX "CreditPack_isActive_idx" ON "CreditPack"("isActive");
