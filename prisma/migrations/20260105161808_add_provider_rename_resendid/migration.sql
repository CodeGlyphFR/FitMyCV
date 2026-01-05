-- Add provider column with default value "resend" for existing data
ALTER TABLE "EmailLog" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'resend';

-- Rename resendId to providerId (preserves existing data)
ALTER TABLE "EmailLog" RENAME COLUMN "resendId" TO "providerId";

-- Add index on provider column
CREATE INDEX "EmailLog_provider_idx" ON "EmailLog"("provider");
