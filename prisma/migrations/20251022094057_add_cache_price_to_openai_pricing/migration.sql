-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OpenAIPricing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelName" TEXT NOT NULL,
    "inputPricePerMToken" REAL NOT NULL,
    "outputPricePerMToken" REAL NOT NULL,
    "cachePricePerMToken" REAL NOT NULL DEFAULT 0,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_OpenAIPricing" ("createdAt", "description", "id", "inputPricePerMToken", "isActive", "modelName", "outputPricePerMToken", "updatedAt") SELECT "createdAt", "description", "id", "inputPricePerMToken", "isActive", "modelName", "outputPricePerMToken", "updatedAt" FROM "OpenAIPricing";
DROP TABLE "OpenAIPricing";
ALTER TABLE "new_OpenAIPricing" RENAME TO "OpenAIPricing";
CREATE UNIQUE INDEX "OpenAIPricing_modelName_key" ON "OpenAIPricing"("modelName");
CREATE INDEX "OpenAIPricing_modelName_idx" ON "OpenAIPricing"("modelName");
CREATE INDEX "OpenAIPricing_isActive_idx" ON "OpenAIPricing"("isActive");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
