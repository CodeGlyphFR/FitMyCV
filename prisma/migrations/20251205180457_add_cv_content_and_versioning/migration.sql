-- AlterTable
ALTER TABLE "public"."CvFile" ADD COLUMN     "content" JSONB,
ADD COLUMN     "contentVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "public"."CvVersion" (
    "id" TEXT NOT NULL,
    "cvFileId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "changelog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CvVersion_cvFileId_createdAt_idx" ON "public"."CvVersion"("cvFileId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "CvVersion_cvFileId_version_key" ON "public"."CvVersion"("cvFileId", "version");

-- AddForeignKey
ALTER TABLE "public"."CvVersion" ADD CONSTRAINT "CvVersion_cvFileId_fkey" FOREIGN KEY ("cvFileId") REFERENCES "public"."CvFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
