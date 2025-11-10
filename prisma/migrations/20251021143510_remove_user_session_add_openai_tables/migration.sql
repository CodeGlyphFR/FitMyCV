/*
  Warnings:

  - You are about to drop the `UserSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `sessionId` on the `TelemetryEvent` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "UserSession_userId_startedAt_idx";

-- DropIndex
DROP INDEX "UserSession_startedAt_idx";

-- DropIndex
DROP INDEX "UserSession_deviceId_idx";

-- DropIndex
DROP INDEX "UserSession_userId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "UserSession";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "OpenAIUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "featureName" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" REAL NOT NULL DEFAULT 0,
    "callsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OpenAIUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OpenAIPricing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelName" TEXT NOT NULL,
    "inputPricePerMToken" REAL NOT NULL,
    "outputPricePerMToken" REAL NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OpenAIAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "threshold" REAL NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OpenAICall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "featureName" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" REAL NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TelemetryEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "metadata" TEXT,
    "deviceId" TEXT,
    "duration" INTEGER,
    "status" TEXT,
    "error" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelemetryEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TelemetryEvent" ("category", "createdAt", "deviceId", "duration", "error", "id", "metadata", "status", "timestamp", "type", "userId") SELECT "category", "createdAt", "deviceId", "duration", "error", "id", "metadata", "status", "timestamp", "type", "userId" FROM "TelemetryEvent";
DROP TABLE "TelemetryEvent";
ALTER TABLE "new_TelemetryEvent" RENAME TO "TelemetryEvent";
CREATE INDEX "TelemetryEvent_userId_idx" ON "TelemetryEvent"("userId");
CREATE INDEX "TelemetryEvent_type_idx" ON "TelemetryEvent"("type");
CREATE INDEX "TelemetryEvent_category_idx" ON "TelemetryEvent"("category");
CREATE INDEX "TelemetryEvent_deviceId_idx" ON "TelemetryEvent"("deviceId");
CREATE INDEX "TelemetryEvent_timestamp_idx" ON "TelemetryEvent"("timestamp");
CREATE INDEX "TelemetryEvent_userId_type_idx" ON "TelemetryEvent"("userId", "type");
CREATE INDEX "TelemetryEvent_type_timestamp_idx" ON "TelemetryEvent"("type", "timestamp");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "OpenAIUsage_userId_idx" ON "OpenAIUsage"("userId");

-- CreateIndex
CREATE INDEX "OpenAIUsage_featureName_idx" ON "OpenAIUsage"("featureName");

-- CreateIndex
CREATE INDEX "OpenAIUsage_model_idx" ON "OpenAIUsage"("model");

-- CreateIndex
CREATE INDEX "OpenAIUsage_date_idx" ON "OpenAIUsage"("date");

-- CreateIndex
CREATE INDEX "OpenAIUsage_userId_date_idx" ON "OpenAIUsage"("userId", "date");

-- CreateIndex
CREATE INDEX "OpenAIUsage_featureName_date_idx" ON "OpenAIUsage"("featureName", "date");

-- CreateIndex
CREATE UNIQUE INDEX "OpenAIUsage_userId_featureName_model_date_key" ON "OpenAIUsage"("userId", "featureName", "model", "date");

-- CreateIndex
CREATE UNIQUE INDEX "OpenAIPricing_modelName_key" ON "OpenAIPricing"("modelName");

-- CreateIndex
CREATE INDEX "OpenAIPricing_modelName_idx" ON "OpenAIPricing"("modelName");

-- CreateIndex
CREATE INDEX "OpenAIPricing_isActive_idx" ON "OpenAIPricing"("isActive");

-- CreateIndex
CREATE INDEX "OpenAIAlert_type_idx" ON "OpenAIAlert"("type");

-- CreateIndex
CREATE INDEX "OpenAIAlert_enabled_idx" ON "OpenAIAlert"("enabled");

-- CreateIndex
CREATE INDEX "OpenAICall_userId_idx" ON "OpenAICall"("userId");

-- CreateIndex
CREATE INDEX "OpenAICall_featureName_idx" ON "OpenAICall"("featureName");

-- CreateIndex
CREATE INDEX "OpenAICall_featureName_createdAt_idx" ON "OpenAICall"("featureName", "createdAt");

-- CreateIndex
CREATE INDEX "OpenAICall_userId_featureName_idx" ON "OpenAICall"("userId", "featureName");

-- CreateIndex
CREATE INDEX "OpenAICall_createdAt_idx" ON "OpenAICall"("createdAt");
