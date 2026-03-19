-- AlterTable: rendre visitorId nullable (null si JS désactivé)
ALTER TABLE "BrowserFingerprint" ALTER COLUMN "visitorId" DROP NOT NULL;

-- AlterTable: rendre userId nullable (conservé après suppression du compte)
ALTER TABLE "BrowserFingerprint" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable: ajouter colonne ipHash
ALTER TABLE "BrowserFingerprint" ADD COLUMN "ipHash" TEXT;

-- CreateIndex
CREATE INDEX "BrowserFingerprint_ipHash_idx" ON "BrowserFingerprint"("ipHash");

-- DropForeignKey (ancienne: CASCADE)
ALTER TABLE "BrowserFingerprint" DROP CONSTRAINT "BrowserFingerprint_userId_fkey";

-- AddForeignKey (nouvelle: SET NULL)
ALTER TABLE "BrowserFingerprint" ADD CONSTRAINT "BrowserFingerprint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
