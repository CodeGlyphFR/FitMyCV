-- AlterTable
ALTER TABLE "public"."CvVersion" ADD COLUMN     "improvementSuggestions" TEXT,
ADD COLUMN     "matchScore" INTEGER,
ADD COLUMN     "matchingSkills" TEXT,
ADD COLUMN     "missingSkills" TEXT,
ADD COLUMN     "scoreBreakdown" TEXT;
