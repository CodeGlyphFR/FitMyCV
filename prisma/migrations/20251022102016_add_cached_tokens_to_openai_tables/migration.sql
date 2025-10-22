-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OpenAICall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "featureName" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" REAL NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_OpenAICall" ("completionTokens", "createdAt", "duration", "estimatedCost", "featureName", "id", "metadata", "model", "promptTokens", "totalTokens", "userId") SELECT "completionTokens", "createdAt", "duration", "estimatedCost", "featureName", "id", "metadata", "model", "promptTokens", "totalTokens", "userId" FROM "OpenAICall";
DROP TABLE "OpenAICall";
ALTER TABLE "new_OpenAICall" RENAME TO "OpenAICall";
CREATE INDEX "OpenAICall_userId_idx" ON "OpenAICall"("userId");
CREATE INDEX "OpenAICall_featureName_idx" ON "OpenAICall"("featureName");
CREATE INDEX "OpenAICall_featureName_createdAt_idx" ON "OpenAICall"("featureName", "createdAt");
CREATE INDEX "OpenAICall_userId_featureName_idx" ON "OpenAICall"("userId", "featureName");
CREATE INDEX "OpenAICall_createdAt_idx" ON "OpenAICall"("createdAt");
CREATE TABLE "new_OpenAIUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "featureName" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" REAL NOT NULL DEFAULT 0,
    "callsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OpenAIUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OpenAIUsage" ("callsCount", "completionTokens", "createdAt", "date", "estimatedCost", "featureName", "id", "model", "promptTokens", "totalTokens", "updatedAt", "userId") SELECT "callsCount", "completionTokens", "createdAt", "date", "estimatedCost", "featureName", "id", "model", "promptTokens", "totalTokens", "updatedAt", "userId" FROM "OpenAIUsage";
DROP TABLE "OpenAIUsage";
ALTER TABLE "new_OpenAIUsage" RENAME TO "OpenAIUsage";
CREATE INDEX "OpenAIUsage_userId_idx" ON "OpenAIUsage"("userId");
CREATE INDEX "OpenAIUsage_featureName_idx" ON "OpenAIUsage"("featureName");
CREATE INDEX "OpenAIUsage_model_idx" ON "OpenAIUsage"("model");
CREATE INDEX "OpenAIUsage_date_idx" ON "OpenAIUsage"("date");
CREATE INDEX "OpenAIUsage_userId_date_idx" ON "OpenAIUsage"("userId", "date");
CREATE INDEX "OpenAIUsage_featureName_date_idx" ON "OpenAIUsage"("featureName", "date");
CREATE UNIQUE INDEX "OpenAIUsage_userId_featureName_model_date_key" ON "OpenAIUsage"("userId", "featureName", "model", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
