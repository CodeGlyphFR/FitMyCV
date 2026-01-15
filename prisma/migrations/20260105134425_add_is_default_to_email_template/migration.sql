-- AlterTable
ALTER TABLE "public"."EmailTemplate" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "EmailTemplate_isDefault_idx" ON "public"."EmailTemplate"("isDefault");
