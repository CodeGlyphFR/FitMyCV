/**
 * Script de seed pour initialiser les plans d'abonnement par défaut
 * Usage: node prisma/seed-subscription-plans.js
 */

// Charger les variables d'environnement depuis .env.local
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Macro-features pour la gestion des abonnements
// Note: Les micro-features restent pour le tracking OpenAI, mais la gestion des abonnements
// utilise ces macro-features qui regroupent les micro-features logiquement
const MACRO_FEATURES = [
  'gpt_cv_generation',    // Regroupe: generate_cv_url, generate_cv_pdf, extract_job_offer_*, create_template_cv_*
  'import_pdf',           // Regroupe: import_pdf, first_import_pdf, import_cv
  'translate_cv',
  'match_score',
  'optimize_cv',
  'generate_from_job_title',
  'export_cv',
  'edit_cv',
  'create_cv_manual',
];

// Plans d'abonnement par défaut
const defaultPlans = [
  {
    name: 'Gratuit',
    description: 'Plan gratuit avec fonctionnalités de base',
    priceMonthly: 0,
    priceYearly: 0,
    yearlyDiscountPercent: 0,
    priceCurrency: 'EUR',
    maxCvCount: 3,
    tokenCount: 5,
    features: {
      // Macro-features avec limites réduites
      gpt_cv_generation: { enabled: true, limit: 3, requiresToken: false, analysisLevels: ['rapid'] },
      import_pdf: { enabled: true, limit: 2, requiresToken: false },
      generate_from_job_title: { enabled: true, limit: 5, requiresToken: false },
      export_cv: { enabled: true, limit: 5 },
      translate_cv: { enabled: false, limit: 0, requiresToken: false },
      match_score: { enabled: true, limit: 3, requiresToken: false },
      optimize_cv: { enabled: false, limit: 0, requiresToken: false },
      edit_cv: { enabled: true, limit: -1 },
      create_cv_manual: { enabled: true, limit: 3 },
    },
  },
  {
    name: 'Pro',
    description: 'Plan professionnel avec toutes les fonctionnalités',
    priceMonthly: 9.99,
    priceYearly: 99.99, // ~17% de réduction
    yearlyDiscountPercent: 16.67,
    priceCurrency: 'EUR',
    maxCvCount: 20,
    tokenCount: 50,
    features: {
      // Toutes les macro-features activées avec mode token
      gpt_cv_generation: { enabled: true, limit: -1, requiresToken: true, analysisLevels: ['rapid', 'medium'] },
      import_pdf: { enabled: true, limit: -1, requiresToken: true },
      generate_from_job_title: { enabled: true, limit: -1, requiresToken: true },
      export_cv: { enabled: true, limit: 100 },
      translate_cv: { enabled: true, limit: -1, requiresToken: true },
      match_score: { enabled: true, limit: -1, requiresToken: true },
      optimize_cv: { enabled: true, limit: -1, requiresToken: true },
      edit_cv: { enabled: true, limit: -1 },
      create_cv_manual: { enabled: true, limit: 20 },
    },
  },
  {
    name: 'Premium',
    description: 'Plan premium avec accès illimité à toutes les fonctionnalités',
    priceMonthly: 29.99,
    priceYearly: 299.99, // ~17% de réduction
    yearlyDiscountPercent: 16.67,
    priceCurrency: 'EUR',
    maxCvCount: -1, // Illimité
    tokenCount: 200,
    features: {
      // Toutes les macro-features en illimité avec tous les niveaux d'analyse
      gpt_cv_generation: { enabled: true, limit: -1, requiresToken: true, analysisLevels: ['rapid', 'medium', 'deep'] },
      import_pdf: { enabled: true, limit: -1, requiresToken: true },
      generate_from_job_title: { enabled: true, limit: -1, requiresToken: true },
      export_cv: { enabled: true, limit: -1 },
      translate_cv: { enabled: true, limit: -1, requiresToken: true },
      match_score: { enabled: true, limit: -1, requiresToken: true },
      optimize_cv: { enabled: true, limit: -1, requiresToken: true },
      edit_cv: { enabled: true, limit: -1 },
      create_cv_manual: { enabled: true, limit: -1 },
    },
  },
];

async function seed() {
  console.log('🌱 Début du seed des plans d\'abonnement...');

  let created = 0;
  let skipped = 0;

  for (const planData of defaultPlans) {
    try {
      // Vérifier si le plan existe déjà
      const existing = await prisma.subscriptionPlan.findUnique({
        where: { name: planData.name },
      });

      if (existing) {
        console.log(`⏭️  Plan "${planData.name}" existe déjà (ID: ${existing.id})`);
        skipped++;
        continue;
      }

      // Créer le plan avec ses features
      const plan = await prisma.subscriptionPlan.create({
        data: {
          name: planData.name,
          description: planData.description,
          priceMonthly: planData.priceMonthly,
          priceYearly: planData.priceYearly,
          yearlyDiscountPercent: planData.yearlyDiscountPercent,
          priceCurrency: planData.priceCurrency,
          maxCvCount: planData.maxCvCount,
          tokenCount: planData.tokenCount,
          featureLimits: {
            create: Object.entries(planData.features).map(([featureName, config]) => ({
              featureName,
              isEnabled: config.enabled,
              usageLimit: config.limit,
              requiresToken: config.requiresToken || false,
              allowedAnalysisLevels: config.analysisLevels ? JSON.stringify(config.analysisLevels) : null,
            })),
          },
        },
        include: {
          featureLimits: true,
        },
      });

      console.log(`✅ Plan "${planData.name}" créé avec succès (ID: ${plan.id}, ${plan.featureLimits.length} features configurées)`);
      created++;
    } catch (error) {
      console.error(`❌ Erreur lors de la création du plan "${planData.name}":`, error.message);
    }
  }

  console.log('\n📊 Résumé:');
  console.log(`   - Créés: ${created}`);
  console.log(`   - Ignorés (déjà existants): ${skipped}`);
  console.log(`   - Total: ${defaultPlans.length}`);
  console.log('\n✨ Seed terminé avec succès!');
}

seed()
  .catch((error) => {
    console.error('❌ Erreur fatale lors du seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
