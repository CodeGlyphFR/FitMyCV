-- DropIndex
DROP INDEX "CvGenerationOffer_jobOfferId_idx";

-- AlterTable
ALTER TABLE "CvGenerationOffer" ADD COLUMN     "sourceUrl" TEXT,
ALTER COLUMN "jobOfferId" DROP NOT NULL;
