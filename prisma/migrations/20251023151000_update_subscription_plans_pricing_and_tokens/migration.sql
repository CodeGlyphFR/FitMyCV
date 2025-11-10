-- AlterTable: Add new columns to SubscriptionPlan with default values
ALTER TABLE "SubscriptionPlan" ADD COLUMN "priceMonthly" REAL NOT NULL DEFAULT 0;
ALTER TABLE "SubscriptionPlan" ADD COLUMN "priceYearly" REAL NOT NULL DEFAULT 0;
ALTER TABLE "SubscriptionPlan" ADD COLUMN "yearlyDiscountPercent" REAL NOT NULL DEFAULT 0;

-- Migrate existing data: copy priceAmount to priceMonthly
UPDATE "SubscriptionPlan" SET "priceMonthly" = "priceAmount";

-- Calculate priceYearly (monthly * 12) for existing data
UPDATE "SubscriptionPlan" SET "priceYearly" = "priceAmount" * 12;

-- Drop old columns
PRAGMA foreign_keys=off;

-- Create new table without old columns
CREATE TABLE "new_SubscriptionPlan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceMonthly" REAL NOT NULL DEFAULT 0,
    "priceYearly" REAL NOT NULL DEFAULT 0,
    "yearlyDiscountPercent" REAL NOT NULL DEFAULT 0,
    "priceCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "maxCvCount" INTEGER NOT NULL DEFAULT -1,
    "tokenCount" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Copy data from old table to new table
INSERT INTO "new_SubscriptionPlan" ("id", "name", "description", "priceMonthly", "priceYearly", "yearlyDiscountPercent", "priceCurrency", "maxCvCount", "tokenCount", "createdAt", "updatedAt")
SELECT "id", "name", "description", "priceMonthly", "priceYearly", "yearlyDiscountPercent", "priceCurrency", "maxCvCount", "tokenCount", "createdAt", "updatedAt"
FROM "SubscriptionPlan";

-- Drop old table
DROP TABLE "SubscriptionPlan";

-- Rename new table
ALTER TABLE "new_SubscriptionPlan" RENAME TO "SubscriptionPlan";

-- Recreate unique index
CREATE UNIQUE INDEX "SubscriptionPlan_name_key" ON "SubscriptionPlan"("name");

-- Recreate index
CREATE INDEX "SubscriptionPlan_name_idx" ON "SubscriptionPlan"("name");

PRAGMA foreign_keys=on;

-- AlterTable: Add new columns to SubscriptionPlanFeatureLimit
ALTER TABLE "SubscriptionPlanFeatureLimit" ADD COLUMN "requiresToken" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "SubscriptionPlanFeatureLimit" ADD COLUMN "allowedAnalysisLevels" TEXT;
