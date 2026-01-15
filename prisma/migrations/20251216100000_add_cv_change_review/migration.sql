-- Add CV Change Review System fields

-- CvFile: Add pending changes review state
ALTER TABLE "CvFile" ADD COLUMN "pendingChanges" JSONB;
ALTER TABLE "CvFile" ADD COLUMN "pendingSourceVersion" INTEGER;

-- CvVersion: Add change type and source file tracking
ALTER TABLE "CvVersion" ADD COLUMN "changeType" TEXT;
ALTER TABLE "CvVersion" ADD COLUMN "sourceFile" TEXT;
