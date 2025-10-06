-- AlterTable
ALTER TABLE "BackgroundTask" ADD COLUMN "cvFile" TEXT;

-- CreateIndex
CREATE INDEX "BackgroundTask_cvFile_status_idx" ON "BackgroundTask"("cvFile", "status");
