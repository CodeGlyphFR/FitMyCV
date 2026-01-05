-- DropIndex
DROP INDEX "public"."EmailTemplate_name_key";

-- AlterTable
ALTER TABLE "public"."EmailTemplate" ADD COLUMN     "triggerId" TEXT,
ALTER COLUMN "isActive" SET DEFAULT false;

-- CreateTable
CREATE TABLE "public"."EmailTrigger" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "variables" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "icon" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailTrigger_name_key" ON "public"."EmailTrigger"("name");

-- CreateIndex
CREATE INDEX "EmailTrigger_name_idx" ON "public"."EmailTrigger"("name");

-- CreateIndex
CREATE INDEX "EmailTrigger_category_idx" ON "public"."EmailTrigger"("category");

-- CreateIndex
CREATE INDEX "EmailTemplate_triggerId_idx" ON "public"."EmailTemplate"("triggerId");

-- AddForeignKey
ALTER TABLE "public"."EmailTemplate" ADD CONSTRAINT "EmailTemplate_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "public"."EmailTrigger"("id") ON DELETE SET NULL ON UPDATE CASCADE;
