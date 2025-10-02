/*
  Warnings:

  - You are about to drop the column `matchScoreFirstRefreshAt` on the `CvFile` table. All the data in the column will be lost.
  - You are about to drop the column `matchScoreRefreshCount` on the `CvFile` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CvFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceValue" TEXT,
    "createdBy" TEXT,
    "originalCreatedBy" TEXT,
    "analysisLevel" TEXT,
    "isTranslated" BOOLEAN NOT NULL DEFAULT false,
    "matchScore" INTEGER,
    "matchScoreUpdatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CvFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CvFile" ("analysisLevel", "createdAt", "createdBy", "filename", "id", "isTranslated", "matchScore", "matchScoreUpdatedAt", "originalCreatedBy", "sourceType", "sourceValue", "updatedAt", "userId") SELECT "analysisLevel", "createdAt", "createdBy", "filename", "id", "isTranslated", "matchScore", "matchScoreUpdatedAt", "originalCreatedBy", "sourceType", "sourceValue", "updatedAt", "userId" FROM "CvFile";
DROP TABLE "CvFile";
ALTER TABLE "new_CvFile" RENAME TO "CvFile";
CREATE UNIQUE INDEX "CvFile_userId_filename_key" ON "CvFile"("userId", "filename");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" DATETIME,
    "passwordHash" TEXT,
    "image" TEXT,
    "matchScoreRefreshCount" INTEGER NOT NULL DEFAULT 0,
    "matchScoreFirstRefreshAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "emailVerified", "id", "image", "name", "passwordHash", "updatedAt") SELECT "createdAt", "email", "emailVerified", "id", "image", "name", "passwordHash", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
