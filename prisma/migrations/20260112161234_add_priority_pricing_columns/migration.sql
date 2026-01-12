-- AlterTable
ALTER TABLE "OpenAIPricing" ADD COLUMN     "cachePricePerMTokenPriority" DOUBLE PRECISION,
ADD COLUMN     "inputPricePerMTokenPriority" DOUBLE PRECISION,
ADD COLUMN     "outputPricePerMTokenPriority" DOUBLE PRECISION;
