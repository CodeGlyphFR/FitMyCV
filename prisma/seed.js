const { PrismaClient } = require('@prisma/client');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// ============================================================================
// UI HELPERS
// ============================================================================
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

const BAR_WIDTH = 20;
const LABEL_WIDTH = 22;

function progressBar(current, total) {
  const percent = total > 0 ? current / total : 1;
  const filled = Math.round(BAR_WIDTH * percent);
  const empty = BAR_WIDTH - filled;
  return `${COLORS.green}${'█'.repeat(filled)}${COLORS.dim}${'░'.repeat(empty)}${COLORS.reset}`;
}

function formatLine(emoji, label, current, total, status = '✓') {
  const paddedLabel = label.padEnd(LABEL_WIDTH);
  const count = `${current}/${total}`.padStart(6);
  return `${emoji} ${paddedLabel} [${progressBar(current, total)}] ${count} ${COLORS.green}${status}${COLORS.reset}`;
}

function formatStripeLine(success) {
  const paddedLabel = 'Stripe Sync'.padEnd(LABEL_WIDTH);
  const status = success ? `${COLORS.green}OK${COLORS.reset}` : `${COLORS.yellow}skip${COLORS.reset}`;
  const bar = success ? progressBar(1, 1) : `${COLORS.dim}${'░'.repeat(BAR_WIDTH)}${COLORS.reset}`;
  return `🔄 ${paddedLabel} [${bar}]    ${status}  ${success ? `${COLORS.green}✓${COLORS.reset}` : `${COLORS.dim}-${COLORS.reset}`}`;
}

// Helper pour exécuter le script de sync Stripe (mode silencieux)
function runStripeSync() {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, '../scripts/sync-stripe.mjs');
    const child = spawn('node', [scriptPath, '--quiet'], {
      stdio: 'pipe',
      env: process.env,
    });
    child.on('close', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

// ============================================================================
// 1. EMAIL TRIGGERS
// ============================================================================
const EMAIL_TRIGGERS = [
  {
    name: 'email_verification',
    label: 'Verification Email',
    description: "Envoye lors de l'inscription pour verifier l'adresse email",
    variables: JSON.stringify(['userName', 'verificationUrl']),
    category: 'authentication',
    icon: '✉️',
    isSystem: true,
  },
  {
    name: 'password_reset',
    label: 'Reset Mot de passe',
    description: "Envoye lors d'une demande de reinitialisation du mot de passe",
    variables: JSON.stringify(['userName', 'resetUrl']),
    category: 'authentication',
    icon: '🔐',
    isSystem: true,
  },
  {
    name: 'email_change',
    label: 'Changement Email',
    description: "Envoye pour confirmer un changement d'adresse email",
    variables: JSON.stringify(['userName', 'verificationUrl', 'newEmail']),
    category: 'authentication',
    icon: '📧',
    isSystem: true,
  },
  {
    name: 'welcome',
    label: 'Bienvenue',
    description: "Envoye apres la verification de l'email pour souhaiter la bienvenue",
    variables: JSON.stringify(['userName', 'loginUrl', 'welcomeCredits']),
    category: 'account',
    icon: '👋',
    isSystem: true,
  },
  {
    name: 'purchase_credits',
    label: 'Achat Credits',
    description: "Envoye apres un achat de credits avec le lien vers la facture Stripe",
    variables: JSON.stringify(['userName', 'creditsAmount', 'totalPrice', 'invoiceUrl']),
    category: 'payments',
    icon: '💳',
    isSystem: true,
  },
  {
    name: 'inactivity_warning',
    label: 'Avertissement Inactivite',
    description: "Envoye 30 jours avant la suppression d'un compte inactif (3 ans sans connexion)",
    variables: JSON.stringify(['userName', 'loginUrl', 'lastActivityDate', 'deletionDate']),
    category: 'account',
    icon: '⚠️',
    isSystem: true,
  },
];

// ============================================================================
// 2. EMAIL TEMPLATES (chargés depuis prisma/email-templates/)
// ============================================================================
const EMAIL_TEMPLATES_DIR = path.join(__dirname, 'email-templates');

function loadEmailTemplates() {
  const templates = [];
  if (!fs.existsSync(EMAIL_TEMPLATES_DIR)) {
    console.log(`  ${COLORS.yellow}Warning: ${EMAIL_TEMPLATES_DIR} not found${COLORS.reset}`);
    return templates;
  }

  const files = fs.readdirSync(EMAIL_TEMPLATES_DIR).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(EMAIL_TEMPLATES_DIR, file), 'utf8');
      const data = JSON.parse(content);
      templates.push({
        name: data.name,
        triggerName: data.triggerName,
        subject: data.subject,
        variables: data.variables,
        htmlContent: data.htmlContent,
        designJson: data.designJson,
        isActive: data.isActive ?? true,
        isDefault: data.isDefault ?? false,
      });
    } catch (error) {
      console.log(`  ${COLORS.yellow}Warning: Failed to load ${file}${COLORS.reset}`);
    }
  }
  return templates;
}

// ============================================================================
// 3. CREDIT PACKS (Données DEV)
// ============================================================================
const CREDIT_PACKS = [
  { name: '15 Crédits', creditAmount: 15, price: 4.99, priceCurrency: 'EUR', isActive: true },
  { name: '50 Crédits', creditAmount: 50, price: 14.99, priceCurrency: 'EUR', isActive: true },
  { name: '100 Crédits', creditAmount: 100, price: 26.99, priceCurrency: 'EUR', isActive: true },
  { name: '150 Crédits', creditAmount: 150, price: 35.99, priceCurrency: 'EUR', isActive: true },
];

// ============================================================================
// 4. SUBSCRIPTION PLANS (Données DEV)
// ============================================================================
const SUBSCRIPTION_PLANS = [
  {
    name: 'Gratuit',
    description: '',
    isFree: true,
    tier: 0,
    isPopular: false,
    priceMonthly: 0,
    priceYearly: 0,
    yearlyDiscountPercent: 0,
    priceCurrency: 'EUR',
    features: {
      create_cv_manual: { enabled: true, limit: -1 },
      edit_cv: { enabled: true, limit: -1 },
      export_cv: { enabled: false, limit: 0 },
      generate_from_job_title: { enabled: false, limit: 0 },
      gpt_cv_generation: { enabled: false, limit: 0 },
      import_pdf: { enabled: false, limit: 0 },
      match_score: { enabled: false, limit: 0 },
      optimize_cv: { enabled: false, limit: 0 },
      translate_cv: { enabled: false, limit: 0 },
    },
  },
  {
    name: 'Pro',
    description: 'Plan professionnel avec toutes les fonctionnalités',
    isFree: false,
    tier: 1,
    isPopular: true,
    priceMonthly: 9.99,
    priceYearly: 99.99,
    yearlyDiscountPercent: 16.59,
    priceCurrency: 'EUR',
    features: {
      create_cv_manual: { enabled: true, limit: -1 },
      edit_cv: { enabled: true, limit: -1 },
      export_cv: { enabled: true, limit: -1 },
      generate_from_job_title: { enabled: true, limit: 25 },
      gpt_cv_generation: { enabled: true, limit: 25 },
      import_pdf: { enabled: true, limit: 25 },
      match_score: { enabled: true, limit: 25 },
      optimize_cv: { enabled: true, limit: 25 },
      translate_cv: { enabled: true, limit: 25 },
    },
  },
  {
    name: 'Premium',
    description: 'Plan premium avec accès illimité à toutes les fonctionnalités',
    isFree: false,
    tier: 2,
    isPopular: false,
    priceMonthly: 19.99,
    priceYearly: 199.99,
    yearlyDiscountPercent: 16.63,
    priceCurrency: 'EUR',
    features: {
      create_cv_manual: { enabled: true, limit: -1 },
      edit_cv: { enabled: true, limit: -1 },
      export_cv: { enabled: true, limit: -1 },
      generate_from_job_title: { enabled: true, limit: 60 },
      gpt_cv_generation: { enabled: true, limit: 60 },
      import_pdf: { enabled: true, limit: 60 },
      match_score: { enabled: true, limit: 60 },
      optimize_cv: { enabled: true, limit: 60 },
      translate_cv: { enabled: true, limit: 60 },
    },
  },
]

// ============================================================================
// 5. OPENAI PRICING (Données DEV - prix/MTok)
// ============================================================================
const OPENAI_PRICING = [
  // GPT-4.1 series
  {
    modelName: 'gpt-4.1-2025-04-14',
    inputPricePerMToken: 2.00,
    outputPricePerMToken: 8.00,
    cachePricePerMToken: 0.5,
    description: 'GPT-4.1 - Improved reasoning model',
    isActive: true,
  },
  {
    modelName: 'gpt-4.1-mini-2025-04-14',
    inputPricePerMToken: 0.4,
    outputPricePerMToken: 1.6,
    cachePricePerMToken: 0.1,
    description: 'GPT-4.1 Mini - Compact reasoning model',
    isActive: true,
  },
  {
    modelName: 'gpt-4.1-nano',
    inputPricePerMToken: 0.1,
    outputPricePerMToken: 0.4,
    cachePricePerMToken: 0.025,
    description: '',
    isActive: true,
  },
  // GPT-4o series
  {
    modelName: 'gpt-4o',
    inputPricePerMToken: 2.50,
    outputPricePerMToken: 10.00,
    cachePricePerMToken: 1.25,
    description: 'GPT-4o - Multimodal flagship model',
    isActive: true,
  },
  {
    modelName: 'gpt-4o-mini',
    inputPricePerMToken: 0.15,
    outputPricePerMToken: 0.60,
    cachePricePerMToken: 0.075,
    description: 'GPT-4o Mini - Affordable and intelligent small model',
    isActive: true,
  },
  {
    modelName: 'gpt-4o-mini-tts',
    inputPricePerMToken: 0.15,
    outputPricePerMToken: 0.60,
    cachePricePerMToken: 0.075,
    description: 'GPT-4o Mini TTS - Text-to-speech model',
    isActive: true,
  },
  {
    modelName: 'gpt-4o-mini-transcribe',
    inputPricePerMToken: 0.15,
    outputPricePerMToken: 0.60,
    cachePricePerMToken: 0.075,
    description: 'GPT-4o Mini Transcribe - Audio transcription model',
    isActive: true,
  },
  // GPT-5 series
  {
    modelName: 'gpt-5-2025-08-07',
    inputPricePerMToken: 1.25,
    outputPricePerMToken: 10.00,
    cachePricePerMToken: 0.125,
    description: 'GPT-5 - Advanced model with extended context',
    isActive: true,
  },
  {
    modelName: 'gpt-5-mini-2025-08-07',
    inputPricePerMToken: 0.25,
    outputPricePerMToken: 2.00,
    cachePricePerMToken: 0.025,
    description: 'GPT-5 Mini - Standard model for most tasks',
    isActive: true,
  },
  {
    modelName: 'gpt-5-mini',
    inputPricePerMToken: 0.25,
    outputPricePerMToken: 2.00,
    cachePricePerMToken: 0.025,
    description: '',
    isActive: true,
  },
  {
    modelName: 'gpt-5-nano-2025-08-07',
    inputPricePerMToken: 0.05,
    outputPricePerMToken: 0.40,
    cachePricePerMToken: 0.005,
    description: 'GPT-5 Nano - Fast and economical model',
    isActive: true,
  },
  {
    modelName: 'gpt-5-nano',
    inputPricePerMToken: 0.05,
    outputPricePerMToken: 0.40,
    cachePricePerMToken: 0.005,
    description: '',
    isActive: true,
  },
  // o-series (reasoning models)
  {
    modelName: 'o3',
    inputPricePerMToken: 2.00,
    outputPricePerMToken: 8.00,
    cachePricePerMToken: 0.5,
    description: '',
    isActive: true,
  },
  {
    modelName: 'o3-deep-research',
    inputPricePerMToken: 10.00,
    outputPricePerMToken: 40.00,
    cachePricePerMToken: 2.5,
    description: '',
    isActive: true,
  },
  {
    modelName: 'o3-deep-research-2025-06-26',
    inputPricePerMToken: 10.00,
    outputPricePerMToken: 40.00,
    cachePricePerMToken: 2.5,
    description: 'o3 - Advanced deep research reasoning model',
    isActive: true,
  },
  {
    modelName: 'o4-mini',
    inputPricePerMToken: 1.1,
    outputPricePerMToken: 4.4,
    cachePricePerMToken: 0.275,
    description: '',
    isActive: true,
  },
  {
    modelName: 'o4-mini-deep-research-2025-06-26',
    inputPricePerMToken: 2.00,
    outputPricePerMToken: 8.00,
    cachePricePerMToken: 0.5,
    description: 'o4 Mini - Compact deep research reasoning model',
    isActive: true,
  },
];

// ============================================================================
// 6. OPENAI ALERTS
// ============================================================================
const OPENAI_ALERTS = [
  {
    type: 'user_daily',
    threshold: 5.0,
    enabled: false,
    name: 'User Daily Limit',
    description: 'Alert when a user exceeds $5/day',
  },
  {
    type: 'user_monthly',
    threshold: 50.0,
    enabled: false,
    name: 'User Monthly Limit',
    description: 'Alert when a user exceeds $50/month',
  },
  {
    type: 'global_daily',
    threshold: 100.0,
    enabled: false,
    name: 'Global Daily Limit',
    description: 'Alert when total daily cost exceeds $100',
  },
  {
    type: 'global_monthly',
    threshold: 1000.0,
    enabled: false,
    name: 'Global Monthly Limit',
    description: 'Alert when total monthly cost exceeds $1000',
  },
];

// ============================================================================
// 7. SETTINGS - AI MODELS (Données DEV)
// ============================================================================
const AI_MODEL_SETTINGS = [
  {
    settingName: 'model_cv_generation',
    value: 'gpt-4.1-mini-2025-04-14',
    category: 'ai_models',
    description: 'Modèle utilisé pour la génération de CV',
  },
  // NOTE: model_cv_planning a été supprimé (obsolète)
  {
    settingName: 'model_match_score',
    value: 'gpt-4.1-mini-2025-04-14',
    category: 'ai_models',
    description: 'Modèle pour calcul du score de correspondance',
  },
  {
    settingName: 'model_translate_cv',
    value: 'gpt-4.1-mini-2025-04-14',
    category: 'ai_models',
    description: 'Modèle pour traduction de CV',
  },
  {
    settingName: 'model_extract_job_offer',
    value: 'gpt-4o-mini',
    category: 'ai_models',
    description: "Modèle pour extraction d'offres d'emploi",
  },
  {
    settingName: 'model_generate_from_job_title',
    value: 'gpt-4.1-mini-2025-04-14',
    category: 'ai_models',
    description: 'Modèle pour génération de CV depuis titre de poste',
  },
  {
    settingName: 'model_import_pdf',
    value: 'gpt-4.1-mini-2025-04-14',
    category: 'ai_models',
    description: 'Modèle pour import de CV depuis PDF',
  },
  {
    settingName: 'model_first_import_pdf',
    value: 'gpt-4.1-mini-2025-04-14',
    category: 'ai_models',
    description: "Modèle IA utilisé pour le premier import PDF d'un utilisateur (sans historique d'import)",
  },
  {
    settingName: 'model_optimize_cv',
    value: 'gpt-4o',
    category: 'ai_models',
    description: 'Modèle pour optimisation de CV',
  },
  {
    settingName: 'model_detect_language',
    value: 'gpt-4o-mini',
    category: 'ai_models',
    description: 'Modèle pour détection de langue de CV (léger, 50 chars max)',
  },
  // Pipeline Adaptation CV - Models par phase
  {
    settingName: 'model_cv_classify',
    value: 'gpt-4o',
    category: 'ai_models',
    description: 'Pipeline Adaptation: Modèle pour la phase classification (KEEP/REMOVE/MOVE)',
  },
  {
    settingName: 'model_cv_batch_experience',
    value: 'gpt-4o',
    category: 'ai_models',
    description: 'Pipeline Adaptation: Modèle pour adaptation des expériences',
  },
  {
    settingName: 'model_cv_batch_projects',
    value: 'gpt-4o',
    category: 'ai_models',
    description: 'Pipeline Adaptation: Modèle pour adaptation des projets',
  },
  {
    settingName: 'model_cv_batch_extras',
    value: 'gpt-4o',
    category: 'ai_models',
    description: 'Pipeline Adaptation: Modèle pour adaptation des extras',
  },
  {
    settingName: 'model_cv_batch_education',
    value: 'gpt-4o-mini',
    category: 'ai_models',
    description: 'Pipeline Adaptation: Modèle pour traduction des formations',
  },
  {
    settingName: 'model_cv_batch_languages',
    value: 'gpt-4o-mini',
    category: 'ai_models',
    description: 'Pipeline Adaptation: Modèle pour adaptation des langues',
  },
  {
    settingName: 'model_cv_batch_skills',
    value: 'gpt-4o-mini',
    category: 'ai_models',
    description: 'Pipeline Adaptation: Modèle pour déduction des compétences',
  },
  {
    settingName: 'model_cv_batch_summary',
    value: 'gpt-4o-mini',
    category: 'ai_models',
    description: 'Pipeline Adaptation: Modèle pour génération du summary',
  },
  // Pipeline Amélioration CV - Models par stage
  {
    settingName: 'model_improve_preprocess',
    value: 'gpt-4o',
    category: 'ai_models',
    description: 'Pipeline Amélioration: Modèle pour classifier les suggestions',
  },
  {
    settingName: 'model_improve_experience',
    value: 'gpt-4.1-2025-04-14',
    category: 'ai_models',
    description: 'Pipeline Amélioration: Modèle pour améliorer une expérience',
  },
  {
    settingName: 'model_improve_project',
    value: 'gpt-4.1-2025-04-14',
    category: 'ai_models',
    description: 'Pipeline Amélioration: Modèle pour améliorer ou créer un projet',
  },
  {
    settingName: 'model_improve_summary',
    value: 'gpt-4.1-mini-2025-04-14',
    category: 'ai_models',
    description: 'Pipeline Amélioration: Modèle pour mettre à jour le summary',
  },
  {
    settingName: 'model_improve_classify_skills',
    value: 'gpt-4o',
    category: 'ai_models',
    description: 'Pipeline Amélioration: Modèle pour classifier les skills ajoutées',
  },
  {
    settingName: 'model_improve_languages',
    value: 'gpt-4.1-mini-2025-04-14',
    category: 'ai_models',
    description: 'Pipeline Amélioration: Modèle pour améliorer les langues',
  },
  {
    settingName: 'model_improve_extras',
    value: 'gpt-4.1-mini-2025-04-14',
    category: 'ai_models',
    description: 'Pipeline Amélioration: Modèle pour améliorer les extras (certifications, hobbies)',
  },
];

// ============================================================================
// 8. SETTINGS - CREDITS (Données DEV)
// ============================================================================
const CREDIT_SETTINGS = [
  {
    settingName: 'credits_create_cv_manual',
    value: '0',
    category: 'credits',
    description: 'Crédits pour création manuelle CV',
  },
  {
    settingName: 'credits_edit_cv',
    value: '0',
    category: 'credits',
    description: 'Crédits pour édition CV',
  },
  {
    settingName: 'credits_export_cv',
    value: '1',
    category: 'credits',
    description: 'Crédits pour export PDF',
  },
  {
    settingName: 'credits_match_score',
    value: '1',
    category: 'credits',
    description: 'Crédits pour score de matching',
  },
  {
    settingName: 'credits_translate_cv',
    value: '1',
    category: 'credits',
    description: 'Crédits pour traduction CV',
  },
  {
    settingName: 'credits_gpt_cv_generation',
    value: '3',
    category: 'credits',
    description: 'Crédits pour génération CV',
  },
  {
    settingName: 'credits_optimize_cv',
    value: '2',
    category: 'credits',
    description: 'Crédits pour optimisation CV',
  },
  {
    settingName: 'credits_generate_from_job_title',
    value: '1',
    category: 'credits',
    description: 'Crédits pour génération depuis titre',
  },
  {
    settingName: 'credits_import_pdf',
    value: '2',
    category: 'credits',
    description: 'Crédits pour import PDF',
  },
  {
    settingName: 'welcome_credits',
    value: '15',
    category: 'credits',
    description: "Crédits offerts à l'inscription (mode crédits uniquement)",
  },
];

// ============================================================================
// 9. SETTINGS - FEATURES
// ============================================================================
const FEATURE_SETTINGS = [
  {
    settingName: 'feature_manual_cv',
    value: '1',
    category: 'features',
    description: 'Permet la création manuelle de CV (bouton Add)',
  },
  {
    settingName: 'feature_ai_generation',
    value: '1',
    category: 'features',
    description: 'Permet la génération de CV avec IA (bouton GPT)',
  },
  {
    settingName: 'feature_import',
    value: '1',
    category: 'features',
    description: "Permet l'import de CV depuis PDF",
  },
  {
    settingName: 'feature_export',
    value: '1',
    category: 'features',
    description: "Permet l'export de CV en PDF",
  },
  {
    settingName: 'feature_match_score',
    value: '1',
    category: 'features',
    description: 'Affiche le score de correspondance pour les CV',
  },
  {
    settingName: 'feature_optimize',
    value: '1',
    category: 'features',
    description: "Affiche le bouton d'optimisation de CV",
  },
  {
    settingName: 'feature_history',
    value: '1',
    category: 'features',
    description: "Affiche l'historique des liens dans le générateur",
  },
  {
    settingName: 'feature_search_bar',
    value: '1',
    category: 'features',
    description: 'Affiche la barre de recherche par titre de poste',
  },
  {
    settingName: 'feature_translate',
    value: '1',
    category: 'features',
    description: 'Permet la traduction de CV',
  },
  {
    settingName: 'feature_language_switcher',
    value: '1',
    category: 'features',
    description: 'Affiche le sélecteur de langue du site',
  },
  {
    settingName: 'feature_edit_mode',
    value: '1',
    category: 'features',
    description: 'Permet le mode édition des CV',
  },
  {
    settingName: 'feature_feedback',
    value: '1',
    category: 'features',
    description: 'Affiche le système de feedback utilisateur',
  },
];

// ============================================================================
// 10. SETTINGS - SYSTEM (Données DEV)
// ============================================================================
const SYSTEM_SETTINGS = [
  {
    settingName: 'registration_enabled',
    value: '1',
    category: 'system',
    description: 'Active ou désactive les inscriptions (1 = activé, 0 = désactivé)',
  },
  {
    settingName: 'maintenance_enabled',
    value: '0',
    category: 'system',
    description: 'Mode maintenance - bloque tous les utilisateurs non-admin (1 = activé, 0 = désactivé)',
  },
  {
    settingName: 'subscription_mode_enabled',
    value: '0',
    category: 'system',
    description: 'Mode abonnement activé (1) ou mode crédits uniquement (0)',
  },
  {
    settingName: 'cv_max_versions',
    value: '5',
    category: 'system',
    description: 'Nombre maximum de versions historisées par CV (optimisation IA)',
  },
];

// ============================================================================
// 11. SETTINGS - PDF IMPORT (Données DEV)
// ============================================================================
const PDF_IMPORT_SETTINGS = [
  {
    settingName: 'pdf_image_max_width',
    value: '1000',
    category: 'pdf_import',
    description: 'Largeur max image PDF (px)',
  },
  {
    settingName: 'pdf_image_density',
    value: '92',
    category: 'pdf_import',
    description: 'DPI conversion PDF',
  },
  {
    settingName: 'pdf_image_quality',
    value: '65',
    category: 'pdf_import',
    description: 'Qualité JPEG (1-100)',
  },
  {
    settingName: 'pdf_vision_detail',
    value: 'auto',
    category: 'pdf_import',
    description: 'Détail Vision API (low/auto/high)',
  },
  {
    settingName: 'temperature_import_pdf',
    value: '0',
    category: 'pdf_import',
    description: 'Température GPT pour import PDF (0=déterministe, 2=créatif)',
  },
  {
    settingName: 'top_p_import_pdf',
    value: '1',
    category: 'pdf_import',
    description: 'Top P (nucleus sampling) pour import PDF (0-1)',
  },
  {
    settingName: 'seed_import_pdf',
    value: '447',
    category: 'pdf_import',
    description: 'Seed pour reproductibilité (0 = désactivé)',
  },
];

// ============================================================================
// 12. SETTINGS - OPENAI (Données DEV)
// ============================================================================
const OPENAI_SETTINGS = [
  {
    settingName: 'openai_priority_mode',
    value: 'false',
    category: 'openai',
    description: 'Si activé, utilise les tarifs Priority OpenAI (~70% plus cher). Désactiver pour les tarifs Standard.',
  },
];

// ============================================================================
// 13. SETTINGS - CV DISPLAY (Données DEV)
// ============================================================================
const CV_DISPLAY_SETTINGS = [
  {
    settingName: 'cv_section_order',
    value: '["header","summary","skills","experience","education","languages","extras","projects"]',
    category: 'cv_display',
    description: 'Ordre affichage sections CV',
  },
];


// ============================================================================
// HEADER DISPLAY
// ============================================================================
function showHeader() {
  const dbUrl = process.env.DATABASE_URL || '';
  const isProduction = dbUrl.includes('fitmycv_prod') || process.env.NODE_ENV === 'production';
  const dbName = dbUrl.split('/').pop()?.split('?')[0] || 'unknown';

  console.log('\n🌱 FitMyCV Database Seeding');
  console.log('────────────────────────────────────────────────────');
  console.log(`📊 Database: ${COLORS.cyan}${dbName}${COLORS.reset}`);
  console.log(`🔧 Environment: ${isProduction ? `${COLORS.yellow}PRODUCTION${COLORS.reset}` : `${COLORS.green}DEVELOPMENT${COLORS.reset}`}`);
  console.log('────────────────────────────────────────────────────\n');
}

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================
async function main() {
  showHeader();

  const results = [];
  let totalCreated = 0;
  let totalSkipped = 0;

  // ===== 1. Email Triggers (insertIfNotExists) =====
  let triggersCreated = 0;
  let triggersSkipped = 0;
  const triggerMap = {}; // Store trigger IDs for template association
  for (const trigger of EMAIL_TRIGGERS) {
    try {
      const existing = await prisma.emailTrigger.findUnique({ where: { name: trigger.name } });
      if (!existing) {
        const result = await prisma.emailTrigger.create({ data: trigger });
        triggerMap[trigger.name] = result.id;
        triggersCreated++;
      } else {
        triggerMap[trigger.name] = existing.id;
        triggersSkipped++;
      }
    } catch (error) { /* ignore */ }
  }
  console.log(formatLine('🎯', 'Email Triggers', triggersCreated, EMAIL_TRIGGERS.length));
  results.push({ created: triggersCreated, skipped: triggersSkipped });

  // ===== 2. Email Templates (insertIfNotExists - chargés depuis fichiers JSON) =====
  const emailTemplates = loadEmailTemplates();
  let templatesCreated = 0;
  let templatesSkipped = 0;
  for (const template of emailTemplates) {
    try {
      const existing = await prisma.emailTemplate.findFirst({ where: { name: template.name } });
      if (!existing) {
        const triggerId = template.triggerName ? triggerMap[template.triggerName] : null;
        await prisma.emailTemplate.create({
          data: {
            name: template.name,
            subject: template.subject,
            variables: template.variables,
            htmlContent: template.htmlContent,
            designJson: template.designJson,
            isActive: true,
            isDefault: template.isDefault,
            triggerId: triggerId,
          },
        });
        templatesCreated++;
      } else {
        templatesSkipped++;
      }
    } catch (error) { /* ignore */ }
  }
  console.log(formatLine('📧', 'Email Templates', templatesCreated, emailTemplates.length));
  results.push({ created: templatesCreated, skipped: templatesSkipped });

  // ===== 3. Credit Packs (insertIfNotExists, Stripe sync après) =====
  let packsCreated = 0;
  let packsSkipped = 0;
  for (const pack of CREDIT_PACKS) {
    try {
      const existing = await prisma.creditPack.findFirst({ where: { name: pack.name } });
      if (!existing) {
        await prisma.creditPack.create({ data: pack });
        packsCreated++;
      } else {
        packsSkipped++;
      }
    } catch (error) { /* ignore */ }
  }
  console.log(formatLine('💰', 'Credit Packs', packsCreated, CREDIT_PACKS.length));
  results.push({ created: packsCreated, skipped: packsSkipped });

  // ===== 4. Subscription Plans (insertIfNotExists - ne jamais écraser les plans existants) =====
  let plansCreated = 0;
  let plansSkipped = 0;
  for (const planData of SUBSCRIPTION_PLANS) {
    try {
      const existing = await prisma.subscriptionPlan.findUnique({ where: { name: planData.name } });

      if (!existing) {
        // Create new plan only if it doesn't exist
        await prisma.subscriptionPlan.create({
          data: {
            name: planData.name,
            description: planData.description,
            isFree: planData.isFree,
            tier: planData.tier,
            isPopular: planData.isPopular,
            priceMonthly: planData.priceMonthly,
            priceYearly: planData.priceYearly,
            yearlyDiscountPercent: planData.yearlyDiscountPercent,
            priceCurrency: planData.priceCurrency,
            featureLimits: {
              create: Object.entries(planData.features).map(([featureName, config]) => ({
                featureName,
                isEnabled: config.enabled,
                usageLimit: config.limit,
              })),
            },
          },
        });
        plansCreated++;
      } else {
        plansSkipped++;
      }
    } catch (error) { /* ignore */ }
  }
  console.log(formatLine('💳', 'Subscription Plans', plansCreated, SUBSCRIPTION_PLANS.length));
  results.push({ created: plansCreated, skipped: plansSkipped });

  // ===== 5. Stripe Sync =====
  let stripeSynced = false;
  if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_TODO') {
    stripeSynced = await runStripeSync();
  }
  console.log(formatStripeLine(stripeSynced));

  // ===== 6. OpenAI Pricing (insertIfNotExists) =====
  let pricingCreated = 0;
  let pricingSkipped = 0;
  for (const pricing of OPENAI_PRICING) {
    try {
      const existing = await prisma.openAIPricing.findUnique({ where: { modelName: pricing.modelName } });
      if (!existing) {
        await prisma.openAIPricing.create({ data: pricing });
        pricingCreated++;
      } else {
        pricingSkipped++;
      }
    } catch (error) { /* ignore */ }
  }
  console.log(formatLine('🤖', 'OpenAI Pricing', pricingCreated, OPENAI_PRICING.length));
  results.push({ created: pricingCreated, skipped: pricingSkipped });

  // ===== 7. OpenAI Alerts (insertIfNotExists) =====
  let alertsCreated = 0;
  let alertsSkipped = 0;
  for (const alert of OPENAI_ALERTS) {
    try {
      const existing = await prisma.openAIAlert.findFirst({ where: { type: alert.type } });
      if (!existing) {
        await prisma.openAIAlert.create({ data: alert });
        alertsCreated++;
      } else {
        alertsSkipped++;
      }
    } catch (error) { /* ignore */ }
  }
  console.log(formatLine('🔔', 'OpenAI Alerts', alertsCreated, OPENAI_ALERTS.length));
  results.push({ created: alertsCreated, skipped: alertsSkipped });

  // ===== 8. Settings (insertIfNotExists - ne jamais écraser les valeurs existantes) =====
  const allSettings = [
    ...AI_MODEL_SETTINGS,
    ...CREDIT_SETTINGS,
    ...FEATURE_SETTINGS,
    ...SYSTEM_SETTINGS,
    ...PDF_IMPORT_SETTINGS,
    ...OPENAI_SETTINGS,
    ...CV_DISPLAY_SETTINGS,
  ];
  let settingsCreated = 0;
  let settingsSkipped = 0;
  for (const setting of allSettings) {
    try {
      const existing = await prisma.setting.findUnique({
        where: { settingName: setting.settingName },
      });
      if (!existing) {
        await prisma.setting.create({ data: setting });
        settingsCreated++;
      } else {
        settingsSkipped++;
      }
    } catch (error) { /* ignore */ }
  }
  console.log(formatLine('⚙️ ', 'Settings', settingsCreated, allSettings.length));
  results.push({ created: settingsCreated, skipped: settingsSkipped });

  // ===== Summary =====
  totalCreated = results.reduce((sum, r) => sum + (r.created || 0), 0);
  totalSkipped = results.reduce((sum, r) => sum + (r.skipped || 0), 0);
  const totalUpdated = results.reduce((sum, r) => sum + (r.updated || 0), 0);

  console.log('\n────────────────────────────────────────────────────');
  console.log(`✨ Seeding complete! ${COLORS.green}${totalCreated} created${COLORS.reset}, ${COLORS.cyan}${totalUpdated} updated${COLORS.reset}, ${COLORS.dim}${totalSkipped} skipped${COLORS.reset}\n`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Erreur lors du seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
