-- AlterTable
ALTER TABLE "Account" DROP COLUMN "refresh_token_expires_in",
DROP COLUMN "session_state";

-- AlterTable
ALTER TABLE "CvFile" DROP COLUMN "creditUsedAt";

-- DropTable
DROP TABLE "OpenAIAlert";
