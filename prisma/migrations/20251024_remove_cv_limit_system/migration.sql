-- RemoveCvLimitSystem
-- Suppression du champ maxCvCount de la table SubscriptionPlan
-- La limitation de CV est retirée : tous les utilisateurs ont des CV illimités

-- AlterTable SubscriptionPlan - Supprimer la colonne maxCvCount
PRAGMA foreign_keys=OFF;

CREATE TABLE "SubscriptionPlan_new" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceMonthly" REAL NOT NULL DEFAULT 0,
    "priceYearly" REAL NOT NULL DEFAULT 0,
    "yearlyDiscountPercent" REAL NOT NULL DEFAULT 0,
    "priceCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "stripeProductId" TEXT,
    "stripePriceIdMonthly" TEXT,
    "stripePriceIdYearly" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "SubscriptionPlan_new" ("id", "name", "description", "priceMonthly", "priceYearly", "yearlyDiscountPercent", "priceCurrency", "stripeProductId", "stripePriceIdMonthly", "stripePriceIdYearly", "createdAt", "updatedAt")
SELECT "id", "name", "description", "priceMonthly", "priceYearly", "yearlyDiscountPercent", "priceCurrency", "stripeProductId", "stripePriceIdMonthly", "stripePriceIdYearly", "createdAt", "updatedAt"
FROM "SubscriptionPlan";

DROP TABLE "SubscriptionPlan";
ALTER TABLE "SubscriptionPlan_new" RENAME TO "SubscriptionPlan";

CREATE UNIQUE INDEX "SubscriptionPlan_name_key" ON "SubscriptionPlan"("name");
CREATE UNIQUE INDEX "SubscriptionPlan_stripeProductId_key" ON "SubscriptionPlan"("stripeProductId");
CREATE UNIQUE INDEX "SubscriptionPlan_stripePriceIdMonthly_key" ON "SubscriptionPlan"("stripePriceIdMonthly");
CREATE UNIQUE INDEX "SubscriptionPlan_stripePriceIdYearly_key" ON "SubscriptionPlan"("stripePriceIdYearly");
CREATE INDEX "SubscriptionPlan_name_idx" ON "SubscriptionPlan"("name");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
