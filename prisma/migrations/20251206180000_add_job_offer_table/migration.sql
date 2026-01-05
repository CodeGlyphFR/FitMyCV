-- CreateTable
CREATE TABLE "JobOffer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceValue" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extractionModel" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobOffer_userId_idx" ON "JobOffer"("userId");

-- CreateIndex
CREATE INDEX "JobOffer_sourceType_idx" ON "JobOffer"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "JobOffer_userId_sourceValue_key" ON "JobOffer"("userId", "sourceValue");

-- AddForeignKey
ALTER TABLE "JobOffer" ADD CONSTRAINT "JobOffer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add jobOfferId to CvFile
ALTER TABLE "CvFile" ADD COLUMN "jobOfferId" TEXT;

-- CreateIndex
CREATE INDEX "CvFile_jobOfferId_idx" ON "CvFile"("jobOfferId");

-- AddForeignKey
ALTER TABLE "CvFile" ADD CONSTRAINT "CvFile_jobOfferId_fkey" FOREIGN KEY ("jobOfferId") REFERENCES "JobOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Drop extractedJobOffer column (data loss accepted by user)
ALTER TABLE "CvFile" DROP COLUMN "extractedJobOffer";
