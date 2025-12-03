-- CreateTable
CREATE TABLE "FeatureMapping" (
    "id" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "settingNames" JSONB NOT NULL,
    "openAICallNames" JSONB NOT NULL,
    "planFeatureNames" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeatureMapping_featureKey_key" ON "FeatureMapping"("featureKey");

-- CreateIndex
CREATE INDEX "FeatureMapping_featureKey_idx" ON "FeatureMapping"("featureKey");
