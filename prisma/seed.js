const { PrismaClient } = require('@prisma/client');
const { spawn } = require('child_process');
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
// 1. EMAIL TEMPLATES
// ============================================================================
const EMAIL_TEMPLATES = [
  {
    name: 'verification',
    subject: 'Vérifiez votre adresse email - FitMyCV.io',
    variables: JSON.stringify(['userName', 'verificationUrl']),
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vérifiez votre adresse email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">FitMyCV.io</h1>
  </div>
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Bienvenue {{userName}} !</h2>
    <p style="font-size: 16px; color: #555;">
      Merci de vous être inscrit sur FitMyCV.io. Pour commencer à utiliser votre compte, veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous.
    </p>
    <div style="text-align: center; margin: 40px 0;">
      <a href="{{verificationUrl}}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 16px; display: inline-block;">
        Vérifier mon email
      </a>
    </div>
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      Si le bouton ne fonctionne pas, vous pouvez copier et coller ce lien dans votre navigateur :
    </p>
    <p style="font-size: 13px; color: #667eea; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 5px;">
      {{verificationUrl}}
    </p>
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
    <p style="font-size: 12px; color: #999;">
      Ce lien expire dans 24 heures. Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.
    </p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
    <p>© 2024 FitMyCV.io. Tous droits réservés.</p>
  </div>
</body>
</html>`,
    designJson: JSON.stringify({ body: { rows: [] } }),
  },
  {
    name: 'password_reset',
    subject: 'Réinitialisation de votre mot de passe - FitMyCV.io',
    variables: JSON.stringify(['userName', 'resetUrl']),
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Réinitialisation de votre mot de passe</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">FitMyCV.io</h1>
  </div>
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Bonjour {{userName}} !</h2>
    <p style="font-size: 16px; color: #555;">
      Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe.
    </p>
    <div style="text-align: center; margin: 40px 0;">
      <a href="{{resetUrl}}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 16px; display: inline-block;">
        Réinitialiser mon mot de passe
      </a>
    </div>
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      Si le bouton ne fonctionne pas, vous pouvez copier et coller ce lien dans votre navigateur :
    </p>
    <p style="font-size: 13px; color: #667eea; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 5px;">
      {{resetUrl}}
    </p>
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
    <p style="font-size: 14px; color: #e63946; font-weight: 600;">
      Attention
    </p>
    <p style="font-size: 13px; color: #666;">
      Ce lien expire dans 1 heure. Si vous n'avez pas demandé de réinitialisation de mot de passe, vous pouvez ignorer cet email en toute sécurité.
    </p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
    <p>© 2024 FitMyCV.io. Tous droits réservés.</p>
  </div>
</body>
</html>`,
    designJson: JSON.stringify({ body: { rows: [] } }),
  },
  {
    name: 'email_change',
    subject: 'Confirmez votre nouvelle adresse email - FitMyCV.io',
    variables: JSON.stringify(['userName', 'verificationUrl', 'newEmail']),
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmez votre nouvelle adresse email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">FitMyCV.io</h1>
  </div>
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Bonjour {{userName}} !</h2>
    <p style="font-size: 16px; color: #555;">
      Vous avez demandé à modifier votre adresse email. Pour confirmer ce changement, veuillez cliquer sur le bouton ci-dessous.
    </p>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #666;">Nouvelle adresse email :</p>
      <p style="margin: 5px 0 0; font-size: 16px; font-weight: 600; color: #333;">{{newEmail}}</p>
    </div>
    <div style="text-align: center; margin: 40px 0;">
      <a href="{{verificationUrl}}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 16px; display: inline-block;">
        Confirmer la modification
      </a>
    </div>
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      Si le bouton ne fonctionne pas, vous pouvez copier et coller ce lien dans votre navigateur :
    </p>
    <p style="font-size: 13px; color: #667eea; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 5px;">
      {{verificationUrl}}
    </p>
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
    <p style="font-size: 14px; color: #e63946; font-weight: 600;">
      Important
    </p>
    <p style="font-size: 13px; color: #666;">
      Ce lien expire dans 24 heures. Si vous n'avez pas demandé ce changement, veuillez ignorer cet email et votre adresse actuelle restera inchangée.
    </p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
    <p>© 2024 FitMyCV.io. Tous droits réservés.</p>
  </div>
</body>
</html>`,
    designJson: JSON.stringify({ body: { rows: [] } }),
  },
];

// ============================================================================
// 2. CREDIT PACKS (Données prod)
// ============================================================================
const CREDIT_PACKS = [
  { name: '15 Crédits', creditAmount: 15, price: 1.99, priceCurrency: 'EUR' },
  { name: '60 Crédits', creditAmount: 60, price: 6.99, priceCurrency: 'EUR' },
  { name: '150 Crédits', creditAmount: 150, price: 12.99, priceCurrency: 'EUR' },
  { name: '300 Crédits', creditAmount: 300, price: 19.99, priceCurrency: 'EUR' },
];

// ============================================================================
// 3. SUBSCRIPTION PLANS (Données prod)
// ============================================================================
const SUBSCRIPTION_PLANS = [
  {
    name: 'Gratuit',
    description: 'Plan gratuit avec fonctionnalités de base',
    isFree: true,
    tier: 0,
    isPopular: false,
    priceMonthly: 0,
    priceYearly: 0,
    yearlyDiscountPercent: 0,
    priceCurrency: 'EUR',
    features: {
      gpt_cv_generation: { enabled: true, limit: 5 },
      import_pdf: { enabled: true, limit: 5 },
      generate_from_job_title: { enabled: true, limit: 5 },
      export_cv: { enabled: true, limit: 5 },
      translate_cv: { enabled: true, limit: 5 },
      match_score: { enabled: true, limit: 5 },
      optimize_cv: { enabled: true, limit: 5 },
      edit_cv: { enabled: true, limit: -1 },
      create_cv_manual: { enabled: true, limit: 5 },
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
      gpt_cv_generation: { enabled: true, limit: 25 },
      import_pdf: { enabled: true, limit: 25 },
      generate_from_job_title: { enabled: true, limit: 25 },
      export_cv: { enabled: true, limit: -1 },
      translate_cv: { enabled: true, limit: 25 },
      match_score: { enabled: true, limit: 25 },
      optimize_cv: { enabled: true, limit: 25 },
      edit_cv: { enabled: true, limit: -1 },
      create_cv_manual: { enabled: true, limit: -1 },
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
      gpt_cv_generation: { enabled: true, limit: 60 },
      import_pdf: { enabled: true, limit: 60 },
      generate_from_job_title: { enabled: true, limit: 60 },
      export_cv: { enabled: true, limit: -1 },
      translate_cv: { enabled: true, limit: 60 },
      match_score: { enabled: true, limit: 60 },
      optimize_cv: { enabled: true, limit: 60 },
      edit_cv: { enabled: true, limit: -1 },
      create_cv_manual: { enabled: true, limit: -1 },
    },
  },
];

// ============================================================================
// 4. OPENAI PRICING (Données prod - prix/MTok)
// ============================================================================
const OPENAI_PRICING = [
  {
    modelName: 'gpt-5-nano-2025-08-07',
    inputPricePerMToken: 0.05,
    outputPricePerMToken: 0.40,
    cachePricePerMToken: 0.005,
    description: 'GPT-5 Nano - Fast and economical model',
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
    modelName: 'gpt-5-2025-08-07',
    inputPricePerMToken: 1.25,
    outputPricePerMToken: 10.00,
    cachePricePerMToken: 0.125,
    description: 'GPT-5 - Advanced model with extended context',
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
    modelName: 'gpt-4o',
    inputPricePerMToken: 2.50,
    outputPricePerMToken: 10.00,
    cachePricePerMToken: 1.25,
    description: 'GPT-4o - Multimodal flagship model',
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
  {
    modelName: 'gpt-4.1-2025-04-14',
    inputPricePerMToken: 2.00,
    outputPricePerMToken: 8.00,
    cachePricePerMToken: 1.00,
    description: 'GPT-4.1 - Improved reasoning model',
    isActive: true,
  },
  {
    modelName: 'gpt-4.1-mini-2025-04-14',
    inputPricePerMToken: 1.00,
    outputPricePerMToken: 4.00,
    cachePricePerMToken: 0.50,
    description: 'GPT-4.1 Mini - Compact reasoning model',
    isActive: true,
  },
  {
    modelName: 'o4-mini-deep-research-2025-06-26',
    inputPricePerMToken: 1.50,
    outputPricePerMToken: 6.00,
    cachePricePerMToken: 0.75,
    description: 'o4 Mini - Compact deep research reasoning model',
    isActive: true,
  },
  {
    modelName: 'o3-deep-research-2025-06-26',
    inputPricePerMToken: 5.00,
    outputPricePerMToken: 20.00,
    cachePricePerMToken: 2.50,
    description: 'o3 - Advanced deep research reasoning model',
    isActive: true,
  },
];

// ============================================================================
// 5. OPENAI ALERTS
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
// 6. SETTINGS - AI MODELS (Données prod)
// ============================================================================
const AI_MODEL_SETTINGS = [
  {
    settingName: 'model_cv_generation',
    value: 'gpt-4.1-2025-04-14',
    category: 'ai_models',
    description: 'Modèle utilisé pour la génération de CV',
  },
  {
    settingName: 'model_match_score',
    value: 'gpt-4o-mini',
    category: 'ai_models',
    description: 'Modèle pour calcul du score de correspondance',
  },
  {
    settingName: 'model_translate_cv',
    value: 'gpt-4o-mini',
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
    value: 'gpt-5-mini-2025-08-07',
    category: 'ai_models',
    description: 'Modèle pour génération de CV depuis titre de poste',
  },
  {
    settingName: 'model_import_pdf',
    value: 'gpt-4.1-2025-04-14',
    category: 'ai_models',
    description: 'Modèle pour import de CV depuis PDF',
  },
  {
    settingName: 'model_first_import_pdf',
    value: 'gpt-4.1-2025-04-14',
    category: 'ai_models',
    description: "Modèle IA utilisé pour le premier import PDF d'un utilisateur (sans historique d'import)",
  },
  {
    settingName: 'model_optimize_cv',
    value: 'gpt-5-mini-2025-08-07',
    category: 'ai_models',
    description: 'Modèle pour optimisation de CV',
  },
  {
    settingName: 'model_detect_language',
    value: 'gpt-4o-mini',
    category: 'ai_models',
    description: 'Modèle pour détection de langue de CV (léger, 50 chars max)',
  },
];

// ============================================================================
// 7. SETTINGS - CREDITS
// ============================================================================
const CREDIT_SETTINGS = [
  {
    settingName: 'credits_create_cv_manual',
    value: '1',
    category: 'credits',
    description: 'Crédits pour création manuelle CV',
  },
  {
    settingName: 'credits_edit_cv',
    value: '1',
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
    value: '2',
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
    value: '3',
    category: 'credits',
    description: 'Crédits pour génération depuis titre',
  },
  {
    settingName: 'credits_import_pdf',
    value: '5',
    category: 'credits',
    description: 'Crédits pour import PDF',
  },
];

// ============================================================================
// 8. SETTINGS - FEATURES
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
// 9. SETTINGS - SYSTEM
// ============================================================================
const SYSTEM_SETTINGS = [
  {
    settingName: 'registration_enabled',
    value: '1',
    category: 'system',
    description: 'Active ou désactive les inscriptions (1 = activé, 0 = désactivé)',
  },
];

// ============================================================================
// 10. SETTINGS - CV
// ============================================================================
const CV_SETTINGS = [
  {
    settingName: 'cv_max_versions',
    value: '5',
    category: 'cv',
    description: 'Nombre maximum de versions historisées par CV (optimisation IA)',
  },
];

// ============================================================================
// 11. FEATURE MAPPINGS (Complet avec features non-IA)
// ============================================================================
const FEATURE_MAPPINGS = [
  {
    featureKey: 'match_score',
    displayName: 'Score de matching',
    settingNames: ['model_match_score'],
    openAICallNames: ['match_score'],
    planFeatureNames: ['match_score'],
  },
  {
    featureKey: 'optimize_cv',
    displayName: 'Optimisation CV',
    settingNames: ['model_optimize_cv'],
    openAICallNames: ['optimize_cv'],
    planFeatureNames: ['optimize_cv'],
  },
  {
    featureKey: 'generate_from_job_title',
    displayName: 'Génération depuis titre',
    settingNames: ['model_generate_from_job_title'],
    openAICallNames: ['generate_from_job_title'],
    planFeatureNames: ['generate_from_job_title'],
  },
  {
    featureKey: 'translate_cv',
    displayName: 'Traduction CV',
    settingNames: ['model_translate_cv'],
    openAICallNames: ['translate_cv'],
    planFeatureNames: ['translate_cv'],
  },
  {
    featureKey: 'gpt_cv_generation',
    displayName: 'Génération CV',
    settingNames: ['model_cv_generation', 'model_extract_job_offer'],
    openAICallNames: ['generate_cv_url', 'generate_cv_pdf', 'extract_job_offer_url', 'extract_job_offer_pdf', 'create_template_cv_url', 'create_template_cv_pdf'],
    planFeatureNames: ['gpt_cv_generation'],
  },
  {
    featureKey: 'import_pdf',
    displayName: 'Import PDF',
    settingNames: ['model_import_pdf', 'model_first_import_pdf'],
    openAICallNames: ['import_pdf', 'first_import_pdf'],
    planFeatureNames: ['import_pdf'],
  },
  {
    featureKey: 'extract_job_offer',
    displayName: 'Extraction offre emploi',
    settingNames: ['model_extract_job_offer'],
    openAICallNames: ['extract_job_offer_url', 'extract_job_offer_pdf'],
    planFeatureNames: ['gpt_cv_generation'],
  },
  {
    featureKey: 'detect_language',
    displayName: 'Détection langue',
    settingNames: ['model_detect_language'],
    openAICallNames: ['detect_cv_language'],
    planFeatureNames: ['match_score', 'gpt_cv_generation', 'import_pdf'],
  },
  // Features non-IA (sans modèle OpenAI)
  {
    featureKey: 'create_cv_manual',
    displayName: 'Création manuelle CV',
    settingNames: [],
    openAICallNames: [],
    planFeatureNames: ['create_cv_manual'],
  },
  {
    featureKey: 'edit_cv',
    displayName: 'Édition CV',
    settingNames: [],
    openAICallNames: [],
    planFeatureNames: ['edit_cv'],
  },
  {
    featureKey: 'export_cv',
    displayName: 'Export PDF',
    settingNames: [],
    openAICallNames: [],
    planFeatureNames: ['export_cv'],
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

  // ===== 1. Email Templates =====
  let templatesCreated = 0;
  let templatesSkipped = 0;
  for (const template of EMAIL_TEMPLATES) {
    try {
      const existing = await prisma.emailTemplate.findUnique({ where: { name: template.name } });
      if (existing) { templatesSkipped++; continue; }
      await prisma.emailTemplate.create({ data: template });
      templatesCreated++;
    } catch (error) { /* ignore */ }
  }
  console.log(formatLine('📧', 'Email Templates', EMAIL_TEMPLATES.length, EMAIL_TEMPLATES.length));
  results.push({ created: templatesCreated, skipped: templatesSkipped });

  // ===== 2. Credit Packs =====
  let packsCreated = 0;
  let packsSkipped = 0;
  for (const pack of CREDIT_PACKS) {
    try {
      const existing = await prisma.creditPack.findUnique({ where: { creditAmount: pack.creditAmount } });
      if (existing) { packsSkipped++; continue; }
      await prisma.creditPack.create({ data: pack });
      packsCreated++;
    } catch (error) { /* ignore */ }
  }
  console.log(formatLine('💰', 'Credit Packs', CREDIT_PACKS.length, CREDIT_PACKS.length));
  results.push({ created: packsCreated, skipped: packsSkipped });

  // ===== 3. Subscription Plans =====
  let plansCreated = 0;
  let plansSkipped = 0;
  for (const planData of SUBSCRIPTION_PLANS) {
    try {
      const existing = await prisma.subscriptionPlan.findUnique({ where: { name: planData.name } });
      if (existing) { plansSkipped++; continue; }
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
    } catch (error) { /* ignore */ }
  }
  console.log(formatLine('💳', 'Subscription Plans', SUBSCRIPTION_PLANS.length, SUBSCRIPTION_PLANS.length));
  results.push({ created: plansCreated, skipped: plansSkipped });

  // ===== 4. Stripe Sync =====
  let stripeSynced = false;
  if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_TODO') {
    stripeSynced = await runStripeSync();
  }
  console.log(formatStripeLine(stripeSynced));

  // ===== 5. OpenAI Pricing =====
  let pricingCreated = 0;
  let pricingSkipped = 0;
  for (const pricing of OPENAI_PRICING) {
    try {
      const existing = await prisma.openAIPricing.findUnique({ where: { modelName: pricing.modelName } });
      if (existing) { pricingSkipped++; continue; }
      await prisma.openAIPricing.create({ data: pricing });
      pricingCreated++;
    } catch (error) { /* ignore */ }
  }
  console.log(formatLine('🤖', 'OpenAI Pricing', OPENAI_PRICING.length, OPENAI_PRICING.length));
  results.push({ created: pricingCreated, skipped: pricingSkipped });

  // ===== 6. OpenAI Alerts =====
  let alertsCreated = 0;
  let alertsSkipped = 0;
  for (const alert of OPENAI_ALERTS) {
    try {
      const existing = await prisma.openAIAlert.findFirst({ where: { type: alert.type } });
      if (existing) { alertsSkipped++; continue; }
      await prisma.openAIAlert.create({ data: alert });
      alertsCreated++;
    } catch (error) { /* ignore */ }
  }
  console.log(formatLine('🔔', 'OpenAI Alerts', OPENAI_ALERTS.length, OPENAI_ALERTS.length));
  results.push({ created: alertsCreated, skipped: alertsSkipped });

  // ===== 7. Settings =====
  const allSettings = [...AI_MODEL_SETTINGS, ...CREDIT_SETTINGS, ...FEATURE_SETTINGS, ...SYSTEM_SETTINGS, ...CV_SETTINGS];
  let settingsCreated = 0;
  let settingsSkipped = 0;
  for (const setting of allSettings) {
    try {
      const existing = await prisma.setting.findUnique({ where: { settingName: setting.settingName } });
      if (existing) { settingsSkipped++; continue; }
      await prisma.setting.create({ data: setting });
      settingsCreated++;
    } catch (error) { /* ignore */ }
  }
  console.log(formatLine('⚙️ ', 'Settings', allSettings.length, allSettings.length));
  results.push({ created: settingsCreated, skipped: settingsSkipped });

  // ===== 8. Feature Mappings =====
  let mappingsCreated = 0;
  let mappingsSkipped = 0;
  for (const mapping of FEATURE_MAPPINGS) {
    try {
      const existing = await prisma.featureMapping.findUnique({ where: { featureKey: mapping.featureKey } });
      if (existing) { mappingsSkipped++; continue; }
      await prisma.featureMapping.create({
        data: {
          featureKey: mapping.featureKey,
          displayName: mapping.displayName,
          settingNames: mapping.settingNames,
          openAICallNames: mapping.openAICallNames,
          planFeatureNames: mapping.planFeatureNames,
        },
      });
      mappingsCreated++;
    } catch (error) { /* ignore */ }
  }
  console.log(formatLine('🔗', 'Feature Mappings', FEATURE_MAPPINGS.length, FEATURE_MAPPINGS.length));
  results.push({ created: mappingsCreated, skipped: mappingsSkipped });

  // ===== Summary =====
  totalCreated = results.reduce((sum, r) => sum + r.created, 0);
  totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);

  console.log('\n────────────────────────────────────────────────────');
  console.log(`✨ Seeding complete! ${COLORS.green}${totalCreated} created${COLORS.reset}, ${COLORS.dim}${totalSkipped} skipped${COLORS.reset}\n`);
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
