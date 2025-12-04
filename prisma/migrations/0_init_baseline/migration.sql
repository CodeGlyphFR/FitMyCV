-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "referralCode" TEXT,
    "referredBy" TEXT,
    "onboardingState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "refresh_token_expires_in" INTEGER,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "public"."CvFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceValue" TEXT,
    "extractedJobOffer" TEXT,
    "createdBy" TEXT,
    "originalCreatedBy" TEXT,
    "analysisLevel" TEXT,
    "isTranslated" BOOLEAN NOT NULL DEFAULT false,
    "matchScore" INTEGER,
    "matchScoreUpdatedAt" TIMESTAMP(3),
    "matchScoreStatus" TEXT DEFAULT 'idle',
    "scoreBreakdown" TEXT,
    "improvementSuggestions" TEXT,
    "missingSkills" TEXT,
    "matchingSkills" TEXT,
    "optimiseStatus" TEXT DEFAULT 'idle',
    "optimiseUpdatedAt" TIMESTAMP(3),
    "createdWithCredit" BOOLEAN NOT NULL DEFAULT false,
    "creditUsedAt" TIMESTAMP(3),
    "creditTransactionId" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "blockedAt" TIMESTAMP(3),
    "blockedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CvFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BackgroundTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "successMessage" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL,
    "shouldUpdateCvList" BOOLEAN NOT NULL DEFAULT false,
    "result" TEXT,
    "error" TEXT,
    "payload" TEXT,
    "deviceId" TEXT NOT NULL,
    "userId" TEXT,
    "cvFile" TEXT,
    "creditUsed" BOOLEAN NOT NULL DEFAULT false,
    "creditTransactionId" TEXT,
    "featureName" TEXT,
    "featureCounterPeriodStart" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackgroundTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LinkHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "isBugReport" BOOLEAN NOT NULL DEFAULT false,
    "currentCvFile" TEXT,
    "userAgent" TEXT,
    "pageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'new',

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConsentLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "preferences" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Setting" (
    "id" TEXT NOT NULL,
    "settingName" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FeatureMapping" (
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

-- CreateTable
CREATE TABLE "public"."EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AutoSignInToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoSignInToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmailChangeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newEmail" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TelemetryEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "metadata" TEXT,
    "deviceId" TEXT,
    "duration" INTEGER,
    "status" TEXT,
    "error" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelemetryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FeatureUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "featureName" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalDuration" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OpenAIUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "featureName" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "callsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenAIUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OpenAIPricing" (
    "id" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "inputPricePerMToken" DOUBLE PRECISION NOT NULL,
    "outputPricePerMToken" DOUBLE PRECISION NOT NULL,
    "cachePricePerMToken" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenAIPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OpenAIAlert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenAIAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OpenAICall" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "featureName" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpenAICall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SubscriptionPlan" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "tier" INTEGER NOT NULL DEFAULT 0,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "priceMonthly" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceYearly" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yearlyDiscountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "stripeProductId" TEXT,
    "stripePriceIdMonthly" TEXT,
    "stripePriceIdYearly" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SubscriptionPlanFeatureLimit" (
    "id" TEXT NOT NULL,
    "planId" INTEGER NOT NULL,
    "featureName" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "usageLimit" INTEGER NOT NULL DEFAULT -1,
    "allowedAnalysisLevels" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlanFeatureLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CreditPack" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "creditAmount" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "priceCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stripePriceId" TEXT,
    "stripeProductId" TEXT,

    CONSTRAINT "CreditPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "planId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "billingPeriod" TEXT NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CreditBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "totalPurchased" INTEGER NOT NULL DEFAULT 0,
    "totalUsed" INTEGER NOT NULL DEFAULT 0,
    "totalRefunded" INTEGER NOT NULL DEFAULT 0,
    "totalGifted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "featureName" TEXT,
    "taskId" TEXT,
    "cvFileId" TEXT,
    "stripePaymentIntentId" TEXT,
    "refunded" BOOLEAN NOT NULL DEFAULT false,
    "relatedTransactionId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stripeInvoiceId" TEXT,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FeatureUsageCounter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "featureName" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureUsageCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StripeWebhookLog" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeWebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "referrerReward" INTEGER NOT NULL DEFAULT 0,
    "referredReward" INTEGER NOT NULL DEFAULT 0,
    "rewardsGrantedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "discountType" TEXT,
    "discountValue" DOUBLE PRECISION,
    "creditBonus" INTEGER,
    "applicableTo" TEXT NOT NULL,
    "maxUses" INTEGER,
    "currentUses" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stripeCouponId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmailTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "designJson" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "variables" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmailLog" (
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "templateName" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "resendId" TEXT,
    "isTestEmail" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "public"."User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "public"."User"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "public"."Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "public"."VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "public"."VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "CvFile_creditTransactionId_key" ON "public"."CvFile"("creditTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "CvFile_userId_filename_key" ON "public"."CvFile"("userId", "filename");

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundTask_creditTransactionId_key" ON "public"."BackgroundTask"("creditTransactionId");

-- CreateIndex
CREATE INDEX "BackgroundTask_deviceId_idx" ON "public"."BackgroundTask"("deviceId");

-- CreateIndex
CREATE INDEX "BackgroundTask_status_idx" ON "public"."BackgroundTask"("status");

-- CreateIndex
CREATE INDEX "BackgroundTask_createdAt_idx" ON "public"."BackgroundTask"("createdAt");

-- CreateIndex
CREATE INDEX "BackgroundTask_cvFile_status_idx" ON "public"."BackgroundTask"("cvFile", "status");

-- CreateIndex
CREATE INDEX "LinkHistory_userId_createdAt_idx" ON "public"."LinkHistory"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LinkHistory_userId_url_key" ON "public"."LinkHistory"("userId", "url");

-- CreateIndex
CREATE INDEX "Feedback_userId_idx" ON "public"."Feedback"("userId");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "public"."Feedback"("createdAt");

-- CreateIndex
CREATE INDEX "Feedback_isBugReport_idx" ON "public"."Feedback"("isBugReport");

-- CreateIndex
CREATE INDEX "Feedback_status_idx" ON "public"."Feedback"("status");

-- CreateIndex
CREATE INDEX "ConsentLog_userId_idx" ON "public"."ConsentLog"("userId");

-- CreateIndex
CREATE INDEX "ConsentLog_createdAt_idx" ON "public"."ConsentLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_settingName_key" ON "public"."Setting"("settingName");

-- CreateIndex
CREATE INDEX "Setting_category_idx" ON "public"."Setting"("category");

-- CreateIndex
CREATE INDEX "Setting_settingName_idx" ON "public"."Setting"("settingName");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureMapping_featureKey_key" ON "public"."FeatureMapping"("featureKey");

-- CreateIndex
CREATE INDEX "FeatureMapping_featureKey_idx" ON "public"."FeatureMapping"("featureKey");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_token_key" ON "public"."EmailVerificationToken"("token");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "public"."EmailVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_token_idx" ON "public"."EmailVerificationToken"("token");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_expires_idx" ON "public"."EmailVerificationToken"("expires");

-- CreateIndex
CREATE UNIQUE INDEX "AutoSignInToken_token_key" ON "public"."AutoSignInToken"("token");

-- CreateIndex
CREATE INDEX "AutoSignInToken_userId_idx" ON "public"."AutoSignInToken"("userId");

-- CreateIndex
CREATE INDEX "AutoSignInToken_token_idx" ON "public"."AutoSignInToken"("token");

-- CreateIndex
CREATE INDEX "AutoSignInToken_expires_idx" ON "public"."AutoSignInToken"("expires");

-- CreateIndex
CREATE UNIQUE INDEX "EmailChangeRequest_token_key" ON "public"."EmailChangeRequest"("token");

-- CreateIndex
CREATE INDEX "EmailChangeRequest_userId_idx" ON "public"."EmailChangeRequest"("userId");

-- CreateIndex
CREATE INDEX "EmailChangeRequest_token_idx" ON "public"."EmailChangeRequest"("token");

-- CreateIndex
CREATE INDEX "EmailChangeRequest_expires_idx" ON "public"."EmailChangeRequest"("expires");

-- CreateIndex
CREATE INDEX "TelemetryEvent_userId_idx" ON "public"."TelemetryEvent"("userId");

-- CreateIndex
CREATE INDEX "TelemetryEvent_type_idx" ON "public"."TelemetryEvent"("type");

-- CreateIndex
CREATE INDEX "TelemetryEvent_category_idx" ON "public"."TelemetryEvent"("category");

-- CreateIndex
CREATE INDEX "TelemetryEvent_deviceId_idx" ON "public"."TelemetryEvent"("deviceId");

-- CreateIndex
CREATE INDEX "TelemetryEvent_timestamp_idx" ON "public"."TelemetryEvent"("timestamp");

-- CreateIndex
CREATE INDEX "TelemetryEvent_userId_type_idx" ON "public"."TelemetryEvent"("userId", "type");

-- CreateIndex
CREATE INDEX "TelemetryEvent_type_timestamp_idx" ON "public"."TelemetryEvent"("type", "timestamp");

-- CreateIndex
CREATE INDEX "FeatureUsage_userId_idx" ON "public"."FeatureUsage"("userId");

-- CreateIndex
CREATE INDEX "FeatureUsage_featureName_idx" ON "public"."FeatureUsage"("featureName");

-- CreateIndex
CREATE INDEX "FeatureUsage_lastUsedAt_idx" ON "public"."FeatureUsage"("lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureUsage_userId_featureName_key" ON "public"."FeatureUsage"("userId", "featureName");

-- CreateIndex
CREATE INDEX "OpenAIUsage_userId_idx" ON "public"."OpenAIUsage"("userId");

-- CreateIndex
CREATE INDEX "OpenAIUsage_featureName_idx" ON "public"."OpenAIUsage"("featureName");

-- CreateIndex
CREATE INDEX "OpenAIUsage_model_idx" ON "public"."OpenAIUsage"("model");

-- CreateIndex
CREATE INDEX "OpenAIUsage_date_idx" ON "public"."OpenAIUsage"("date");

-- CreateIndex
CREATE INDEX "OpenAIUsage_userId_date_idx" ON "public"."OpenAIUsage"("userId", "date");

-- CreateIndex
CREATE INDEX "OpenAIUsage_featureName_date_idx" ON "public"."OpenAIUsage"("featureName", "date");

-- CreateIndex
CREATE UNIQUE INDEX "OpenAIUsage_userId_featureName_model_date_key" ON "public"."OpenAIUsage"("userId", "featureName", "model", "date");

-- CreateIndex
CREATE UNIQUE INDEX "OpenAIPricing_modelName_key" ON "public"."OpenAIPricing"("modelName");

-- CreateIndex
CREATE INDEX "OpenAIPricing_modelName_idx" ON "public"."OpenAIPricing"("modelName");

-- CreateIndex
CREATE INDEX "OpenAIPricing_isActive_idx" ON "public"."OpenAIPricing"("isActive");

-- CreateIndex
CREATE INDEX "OpenAIAlert_type_idx" ON "public"."OpenAIAlert"("type");

-- CreateIndex
CREATE INDEX "OpenAIAlert_enabled_idx" ON "public"."OpenAIAlert"("enabled");

-- CreateIndex
CREATE INDEX "OpenAICall_userId_idx" ON "public"."OpenAICall"("userId");

-- CreateIndex
CREATE INDEX "OpenAICall_featureName_idx" ON "public"."OpenAICall"("featureName");

-- CreateIndex
CREATE INDEX "OpenAICall_featureName_createdAt_idx" ON "public"."OpenAICall"("featureName", "createdAt");

-- CreateIndex
CREATE INDEX "OpenAICall_userId_featureName_idx" ON "public"."OpenAICall"("userId", "featureName");

-- CreateIndex
CREATE INDEX "OpenAICall_createdAt_idx" ON "public"."OpenAICall"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_name_key" ON "public"."SubscriptionPlan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_stripeProductId_key" ON "public"."SubscriptionPlan"("stripeProductId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_stripePriceIdMonthly_key" ON "public"."SubscriptionPlan"("stripePriceIdMonthly");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_stripePriceIdYearly_key" ON "public"."SubscriptionPlan"("stripePriceIdYearly");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_name_idx" ON "public"."SubscriptionPlan"("name");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_tier_idx" ON "public"."SubscriptionPlan"("tier");

-- CreateIndex
CREATE INDEX "SubscriptionPlanFeatureLimit_planId_idx" ON "public"."SubscriptionPlanFeatureLimit"("planId");

-- CreateIndex
CREATE INDEX "SubscriptionPlanFeatureLimit_featureName_idx" ON "public"."SubscriptionPlanFeatureLimit"("featureName");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlanFeatureLimit_planId_featureName_key" ON "public"."SubscriptionPlanFeatureLimit"("planId", "featureName");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPack_creditAmount_key" ON "public"."CreditPack"("creditAmount");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPack_stripePriceId_key" ON "public"."CreditPack"("stripePriceId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPack_stripeProductId_key" ON "public"."CreditPack"("stripeProductId");

-- CreateIndex
CREATE INDEX "CreditPack_creditAmount_idx" ON "public"."CreditPack"("creditAmount");

-- CreateIndex
CREATE INDEX "CreditPack_isActive_idx" ON "public"."CreditPack"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "public"."Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "public"."Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "public"."Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "public"."Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "public"."Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "public"."Subscription"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Subscription_stripeSubscriptionId_idx" ON "public"."Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditBalance_userId_key" ON "public"."CreditBalance"("userId");

-- CreateIndex
CREATE INDEX "CreditBalance_userId_idx" ON "public"."CreditBalance"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditTransaction_stripePaymentIntentId_key" ON "public"."CreditTransaction"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_idx" ON "public"."CreditTransaction"("userId");

-- CreateIndex
CREATE INDEX "CreditTransaction_type_idx" ON "public"."CreditTransaction"("type");

-- CreateIndex
CREATE INDEX "CreditTransaction_featureName_idx" ON "public"."CreditTransaction"("featureName");

-- CreateIndex
CREATE INDEX "CreditTransaction_createdAt_idx" ON "public"."CreditTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_createdAt_idx" ON "public"."CreditTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FeatureUsageCounter_userId_idx" ON "public"."FeatureUsageCounter"("userId");

-- CreateIndex
CREATE INDEX "FeatureUsageCounter_featureName_idx" ON "public"."FeatureUsageCounter"("featureName");

-- CreateIndex
CREATE INDEX "FeatureUsageCounter_periodStart_idx" ON "public"."FeatureUsageCounter"("periodStart");

-- CreateIndex
CREATE INDEX "FeatureUsageCounter_periodEnd_idx" ON "public"."FeatureUsageCounter"("periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureUsageCounter_userId_featureName_periodStart_key" ON "public"."FeatureUsageCounter"("userId", "featureName", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "StripeWebhookLog_eventId_key" ON "public"."StripeWebhookLog"("eventId");

-- CreateIndex
CREATE INDEX "StripeWebhookLog_eventId_idx" ON "public"."StripeWebhookLog"("eventId");

-- CreateIndex
CREATE INDEX "StripeWebhookLog_eventType_idx" ON "public"."StripeWebhookLog"("eventType");

-- CreateIndex
CREATE INDEX "StripeWebhookLog_processed_idx" ON "public"."StripeWebhookLog"("processed");

-- CreateIndex
CREATE INDEX "StripeWebhookLog_createdAt_idx" ON "public"."StripeWebhookLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredUserId_key" ON "public"."Referral"("referredUserId");

-- CreateIndex
CREATE INDEX "Referral_referrerId_idx" ON "public"."Referral"("referrerId");

-- CreateIndex
CREATE INDEX "Referral_referredUserId_idx" ON "public"."Referral"("referredUserId");

-- CreateIndex
CREATE INDEX "Referral_referralCode_idx" ON "public"."Referral"("referralCode");

-- CreateIndex
CREATE INDEX "Referral_status_idx" ON "public"."Referral"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "public"."PromoCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_stripeCouponId_key" ON "public"."PromoCode"("stripeCouponId");

-- CreateIndex
CREATE INDEX "PromoCode_code_idx" ON "public"."PromoCode"("code");

-- CreateIndex
CREATE INDEX "PromoCode_isActive_idx" ON "public"."PromoCode"("isActive");

-- CreateIndex
CREATE INDEX "PromoCode_validFrom_idx" ON "public"."PromoCode"("validFrom");

-- CreateIndex
CREATE INDEX "PromoCode_validUntil_idx" ON "public"."PromoCode"("validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_name_key" ON "public"."EmailTemplate"("name");

-- CreateIndex
CREATE INDEX "EmailTemplate_name_idx" ON "public"."EmailTemplate"("name");

-- CreateIndex
CREATE INDEX "EmailTemplate_isActive_idx" ON "public"."EmailTemplate"("isActive");

-- CreateIndex
CREATE INDEX "EmailLog_templateId_idx" ON "public"."EmailLog"("templateId");

-- CreateIndex
CREATE INDEX "EmailLog_templateName_idx" ON "public"."EmailLog"("templateName");

-- CreateIndex
CREATE INDEX "EmailLog_recipientEmail_idx" ON "public"."EmailLog"("recipientEmail");

-- CreateIndex
CREATE INDEX "EmailLog_recipientUserId_idx" ON "public"."EmailLog"("recipientUserId");

-- CreateIndex
CREATE INDEX "EmailLog_status_idx" ON "public"."EmailLog"("status");

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "public"."EmailLog"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CvFile" ADD CONSTRAINT "CvFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CvFile" ADD CONSTRAINT "CvFile_creditTransactionId_fkey" FOREIGN KEY ("creditTransactionId") REFERENCES "public"."CreditTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BackgroundTask" ADD CONSTRAINT "BackgroundTask_creditTransactionId_fkey" FOREIGN KEY ("creditTransactionId") REFERENCES "public"."CreditTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BackgroundTask" ADD CONSTRAINT "BackgroundTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LinkHistory" ADD CONSTRAINT "LinkHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConsentLog" ADD CONSTRAINT "ConsentLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TelemetryEvent" ADD CONSTRAINT "TelemetryEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeatureUsage" ADD CONSTRAINT "FeatureUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OpenAIUsage" ADD CONSTRAINT "OpenAIUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OpenAICall" ADD CONSTRAINT "OpenAICall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubscriptionPlanFeatureLimit" ADD CONSTRAINT "SubscriptionPlanFeatureLimit_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CreditBalance" ADD CONSTRAINT "CreditBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeatureUsageCounter" ADD CONSTRAINT "FeatureUsageCounter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Referral" ADD CONSTRAINT "Referral_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailLog" ADD CONSTRAINT "EmailLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."EmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

