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
    "matchScoreStatus" TEXT DEFAULT 'idle',
    "scoreBreakdown" TEXT,
    "improvementSuggestions" TEXT,
    "missingSkills" TEXT,
    "matchingSkills" TEXT,
    "optimiseStatus" TEXT DEFAULT 'idle',
    "optimiseUpdatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CvFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CvFile" ("analysisLevel", "createdAt", "createdBy", "filename", "id", "improvementSuggestions", "isTranslated", "matchScore", "matchScoreStatus", "matchScoreUpdatedAt", "matchingSkills", "missingSkills", "originalCreatedBy", "scoreBreakdown", "sourceType", "sourceValue", "updatedAt", "userId") SELECT "analysisLevel", "createdAt", "createdBy", "filename", "id", "improvementSuggestions", "isTranslated", "matchScore", "matchScoreStatus", "matchScoreUpdatedAt", "matchingSkills", "missingSkills", "originalCreatedBy", "scoreBreakdown", "sourceType", "sourceValue", "updatedAt", "userId" FROM "CvFile";
DROP TABLE "CvFile";
ALTER TABLE "new_CvFile" RENAME TO "CvFile";
CREATE UNIQUE INDEX "CvFile_userId_filename_key" ON "CvFile"("userId", "filename");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
