-- Add model_first_import_pdf setting for dedicated AI model on first PDF import
INSERT INTO "Setting" ("id", "settingName", "value", "category", "description", "createdAt", "updatedAt")
VALUES (
  'setting_model_first_import_pdf',
  'model_first_import_pdf',
  'gpt-5-mini-2025-08-07',
  'ai_models',
  'Modèle IA utilisé pour le premier import PDF d''un utilisateur (sans historique d''import)',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);