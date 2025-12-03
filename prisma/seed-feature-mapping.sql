-- Script SQL pour insérer/mettre à jour le mapping des features (PostgreSQL)
-- Usage: psql -U <user> -d <database> -f prisma/seed-feature-mapping.sql
-- Note: Pour SQLite (dev), utiliser npm run seed

-- Créer la table si elle n'existe pas
CREATE TABLE IF NOT EXISTS "FeatureMapping" (
    "id" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "settingNames" JSONB NOT NULL,
    "openAICallNames" JSONB NOT NULL,
    "planFeatureNames" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeatureMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FeatureMapping_featureKey_key" ON "FeatureMapping"("featureKey");
CREATE INDEX IF NOT EXISTS "FeatureMapping_featureKey_idx" ON "FeatureMapping"("featureKey");

-- Insérer ou mettre à jour les mappings (JSONB natif)
INSERT INTO "FeatureMapping" ("id", "featureKey", "displayName", "settingNames", "openAICallNames", "planFeatureNames", "createdAt", "updatedAt") VALUES
(gen_random_uuid()::text, 'match_score', 'Score de matching', '["model_match_score"]'::jsonb, '["match_score"]'::jsonb, '["match_score"]'::jsonb, NOW(), NOW()),
(gen_random_uuid()::text, 'optimize_cv', 'Optimisation CV', '["model_optimize_cv"]'::jsonb, '["optimize_cv"]'::jsonb, '["optimize_cv"]'::jsonb, NOW(), NOW()),
(gen_random_uuid()::text, 'generate_from_job_title', 'Génération depuis titre', '["model_generate_from_job_title"]'::jsonb, '["generate_from_job_title"]'::jsonb, '["generate_from_job_title"]'::jsonb, NOW(), NOW()),
(gen_random_uuid()::text, 'translate_cv', 'Traduction CV', '["model_translate_cv"]'::jsonb, '["translate_cv"]'::jsonb, '["translate_cv"]'::jsonb, NOW(), NOW()),
(gen_random_uuid()::text, 'gpt_cv_generation', 'Génération CV', '["model_analysis_rapid","model_analysis_medium","model_analysis_deep","model_extract_job_offer"]'::jsonb, '["generate_cv_url","generate_cv_pdf","extract_job_offer_url","extract_job_offer_pdf","create_template_cv_url","create_template_cv_pdf"]'::jsonb, '["gpt_cv_generation"]'::jsonb, NOW(), NOW()),
(gen_random_uuid()::text, 'import_pdf', 'Import PDF', '["model_import_pdf","model_first_import_pdf"]'::jsonb, '["import_pdf","first_import_pdf"]'::jsonb, '["import_pdf"]'::jsonb, NOW(), NOW()),
(gen_random_uuid()::text, 'detect_language', 'Détection langue', '["model_detect_language"]'::jsonb, '["detect_cv_language"]'::jsonb, '["match_score","gpt_cv_generation","import_pdf"]'::jsonb, NOW(), NOW())
ON CONFLICT ("featureKey") DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  "settingNames" = EXCLUDED."settingNames",
  "openAICallNames" = EXCLUDED."openAICallNames",
  "planFeatureNames" = EXCLUDED."planFeatureNames",
  "updatedAt" = NOW();

-- Vérification
SELECT "featureKey", "displayName", jsonb_array_length("settingNames") as settings_count FROM "FeatureMapping" ORDER BY "featureKey";
