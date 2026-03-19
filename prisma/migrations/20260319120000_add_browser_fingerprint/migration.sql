-- CreateTable
CREATE TABLE "BrowserFingerprint" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrowserFingerprint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrowserFingerprint_visitorId_idx" ON "BrowserFingerprint"("visitorId");

-- CreateIndex
CREATE INDEX "BrowserFingerprint_userId_idx" ON "BrowserFingerprint"("userId");

-- AddForeignKey
ALTER TABLE "BrowserFingerprint" ADD CONSTRAINT "BrowserFingerprint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
