-- AlterTable
ALTER TABLE "public"."JobOffer" ADD COLUMN     "contentHash" TEXT;

-- CreateIndex
CREATE INDEX "JobOffer_userId_contentHash_idx" ON "public"."JobOffer"("userId", "contentHash");
