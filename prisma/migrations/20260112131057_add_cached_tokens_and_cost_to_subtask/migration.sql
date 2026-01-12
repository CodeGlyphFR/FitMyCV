-- AlterTable
ALTER TABLE "CvGenerationSubtask" ADD COLUMN     "cachedTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0;
