-- CreateTable
CREATE TABLE IF NOT EXISTS "LinkHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LinkHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LinkHistory_userId_url_key" ON "LinkHistory"("userId", "url");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LinkHistory_userId_createdAt_idx" ON "LinkHistory"("userId", "createdAt");
