-- Refactor FeatureUsageCounter: 1 compteur par feature par user (reset auto au changement de période)
-- Plus besoin de script CRON pour nettoyer les compteurs expirés

-- 1. Supprimer les anciens index
DROP INDEX IF EXISTS "FeatureUsageCounter_periodStart_idx";
DROP INDEX IF EXISTS "FeatureUsageCounter_periodEnd_idx";

-- 2. Supprimer l'ancien index unique
DROP INDEX IF EXISTS "FeatureUsageCounter_userId_featureName_periodStart_key";

-- 3. Nettoyer les doublons (garder seulement le plus récent par userId + featureName)
DELETE FROM "FeatureUsageCounter" a
USING "FeatureUsageCounter" b
WHERE a."createdAt" < b."createdAt"
  AND a."userId" = b."userId"
  AND a."featureName" = b."featureName";

-- 4. Créer le nouvel index unique (1 compteur par feature par user)
CREATE UNIQUE INDEX "FeatureUsageCounter_userId_featureName_key" ON "FeatureUsageCounter"("userId", "featureName");
