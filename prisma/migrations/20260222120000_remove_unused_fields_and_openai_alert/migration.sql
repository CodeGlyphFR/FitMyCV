-- AlterTable
ALTER TABLE "Account" DROP COLUMN IF EXISTS "refresh_token_expires_in",
DROP COLUMN IF EXISTS "session_state";

-- AlterTable
ALTER TABLE "CvFile" DROP COLUMN IF EXISTS "creditUsedAt";

-- DropTable
DROP TABLE IF EXISTS "OpenAIAlert";
