-- DropColumn: Remove analysisLevel from CvFile
ALTER TABLE "CvFile" DROP COLUMN IF EXISTS "analysisLevel";

-- DropColumn: Remove allowedAnalysisLevels from SubscriptionPlanFeatureLimit
ALTER TABLE "SubscriptionPlanFeatureLimit" DROP COLUMN IF EXISTS "allowedAnalysisLevels";
