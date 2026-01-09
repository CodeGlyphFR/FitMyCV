-- CreateTable
CREATE TABLE "public"."CvGenerationTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceCvFileId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'adapt',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalOffers" INTEGER NOT NULL DEFAULT 1,
    "completedOffers" INTEGER NOT NULL DEFAULT 0,
    "creditsDebited" INTEGER NOT NULL DEFAULT 0,
    "creditsRefunded" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CvGenerationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CvGenerationOffer" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "jobOfferId" TEXT NOT NULL,
    "offerIndex" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "classificationResult" JSONB,
    "batchResults" JSONB,
    "generatedCvFileId" TEXT,
    "generatedCvFileName" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "creditsRefunded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CvGenerationOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CvGenerationSubtask" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "itemIndex" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "input" JSONB,
    "output" JSONB,
    "modifications" JSONB,
    "modelUsed" TEXT,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CvGenerationSubtask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CvGenerationTask_userId_idx" ON "public"."CvGenerationTask"("userId");

-- CreateIndex
CREATE INDEX "CvGenerationTask_status_idx" ON "public"."CvGenerationTask"("status");

-- CreateIndex
CREATE INDEX "CvGenerationTask_createdAt_idx" ON "public"."CvGenerationTask"("createdAt");

-- CreateIndex
CREATE INDEX "CvGenerationTask_userId_status_idx" ON "public"."CvGenerationTask"("userId", "status");

-- CreateIndex
CREATE INDEX "CvGenerationOffer_taskId_idx" ON "public"."CvGenerationOffer"("taskId");

-- CreateIndex
CREATE INDEX "CvGenerationOffer_jobOfferId_idx" ON "public"."CvGenerationOffer"("jobOfferId");

-- CreateIndex
CREATE INDEX "CvGenerationOffer_status_idx" ON "public"."CvGenerationOffer"("status");

-- CreateIndex
CREATE INDEX "CvGenerationOffer_taskId_offerIndex_idx" ON "public"."CvGenerationOffer"("taskId", "offerIndex");

-- CreateIndex
CREATE INDEX "CvGenerationSubtask_offerId_idx" ON "public"."CvGenerationSubtask"("offerId");

-- CreateIndex
CREATE INDEX "CvGenerationSubtask_type_idx" ON "public"."CvGenerationSubtask"("type");

-- CreateIndex
CREATE INDEX "CvGenerationSubtask_status_idx" ON "public"."CvGenerationSubtask"("status");

-- CreateIndex
CREATE INDEX "CvGenerationSubtask_offerId_type_idx" ON "public"."CvGenerationSubtask"("offerId", "type");

-- AddForeignKey
ALTER TABLE "public"."CvGenerationTask" ADD CONSTRAINT "CvGenerationTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CvGenerationOffer" ADD CONSTRAINT "CvGenerationOffer_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."CvGenerationTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CvGenerationSubtask" ADD CONSTRAINT "CvGenerationSubtask_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "public"."CvGenerationOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
