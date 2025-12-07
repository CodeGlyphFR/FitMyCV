-- Script SQL de nettoyage : Suppression des niveaux d'analyse Rapid et Deep
-- À exécuter APRÈS le déploiement du code
-- Date de création : 2025-12-07

-- ===================================================
-- IMPORTANT : Exécuter ce script sur la base de production
-- APRÈS avoir déployé le code mis à jour
-- ===================================================

BEGIN;

-- 1. Supprimer les settings des niveaux d'analyse rapid et deep
DELETE FROM "Setting" WHERE "settingName" IN (
  'model_analysis_rapid',
  'model_analysis_deep',
  'credits_gpt_cv_generation_rapid',
  'credits_gpt_cv_generation_deep'
);

-- 2. Renommer le setting model_analysis_medium → model_cv_generation
UPDATE "Setting"
SET "settingName" = 'model_cv_generation',
    "description" = 'Modèle utilisé pour la génération de CV'
WHERE "settingName" = 'model_analysis_medium';

-- 3. Renommer le setting credits_gpt_cv_generation_medium → credits_gpt_cv_generation
UPDATE "Setting"
SET "settingName" = 'credits_gpt_cv_generation',
    "description" = 'Crédits pour génération CV'
WHERE "settingName" = 'credits_gpt_cv_generation_medium';

-- 4. Nettoyer allowedAnalysisLevels dans les SubscriptionPlanFeatureLimit
UPDATE "SubscriptionPlanFeatureLimit"
SET "allowedAnalysisLevels" = NULL
WHERE "featureName" = 'gpt_cv_generation';

-- 5. Mettre à jour le FeatureMapping pour gpt_cv_generation
UPDATE "FeatureMapping"
SET "settingNames" = '["model_cv_generation", "model_extract_job_offer"]'
WHERE "featureKey" = 'gpt_cv_generation';

-- 6. Nettoyer les colonnes analysisLevel dans CvFile (optionnel - garde l'historique)
-- Note: La colonne est nullable donc pas besoin de la supprimer
-- UPDATE "CvFile" SET "analysisLevel" = NULL;

COMMIT;

-- ===================================================
-- Vérification post-exécution
-- ===================================================

-- Vérifier que les anciens settings ont été supprimés
SELECT * FROM "Setting" WHERE "settingName" LIKE '%analysis%' OR "settingName" LIKE 'credits_gpt_cv_generation_%';

-- Vérifier les nouveaux noms de settings
SELECT * FROM "Setting" WHERE "settingName" IN ('model_cv_generation', 'credits_gpt_cv_generation');

-- Vérifier le FeatureMapping
SELECT * FROM "FeatureMapping" WHERE "featureKey" = 'gpt_cv_generation';

-- Vérifier les allowedAnalysisLevels
SELECT * FROM "SubscriptionPlanFeatureLimit" WHERE "featureName" = 'gpt_cv_generation';
