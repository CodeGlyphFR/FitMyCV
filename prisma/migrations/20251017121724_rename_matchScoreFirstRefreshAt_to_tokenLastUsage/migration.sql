-- Rename column matchScoreFirstRefreshAt to tokenLastUsage
-- This column tracks the timestamp of the last token usage for rate limiting
ALTER TABLE "User" RENAME COLUMN "matchScoreFirstRefreshAt" TO "tokenLastUsage";
