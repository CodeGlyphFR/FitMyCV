-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceAmount" REAL NOT NULL DEFAULT 0,
    "priceCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "pricePeriod" TEXT NOT NULL DEFAULT 'monthly',
    "maxCvCount" INTEGER NOT NULL DEFAULT -1,
    "tokenCount" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SubscriptionPlanFeatureLimit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" INTEGER NOT NULL,
    "featureName" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "usageLimit" INTEGER NOT NULL DEFAULT -1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubscriptionPlanFeatureLimit_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_name_key" ON "SubscriptionPlan"("name");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_name_idx" ON "SubscriptionPlan"("name");

-- CreateIndex
CREATE INDEX "SubscriptionPlanFeatureLimit_planId_idx" ON "SubscriptionPlanFeatureLimit"("planId");

-- CreateIndex
CREATE INDEX "SubscriptionPlanFeatureLimit_featureName_idx" ON "SubscriptionPlanFeatureLimit"("featureName");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlanFeatureLimit_planId_featureName_key" ON "SubscriptionPlanFeatureLimit"("planId", "featureName");
