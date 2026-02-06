/*
  Warnings:

  - You are about to drop the column `referralCode` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `referredBy` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `FeatureMapping` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PromoCode` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Referral` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VerificationToken` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Referral" DROP CONSTRAINT "Referral_referredUserId_fkey";

-- DropForeignKey
ALTER TABLE "Referral" DROP CONSTRAINT "Referral_referrerId_fkey";

-- DropIndex
DROP INDEX "User_referralCode_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "referralCode",
DROP COLUMN "referredBy";

-- DropTable
DROP TABLE "FeatureMapping";

-- DropTable
DROP TABLE "PromoCode";

-- DropTable
DROP TABLE "Referral";

-- DropTable
DROP TABLE "VerificationToken";
