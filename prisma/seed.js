const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Macro-features pour la gestion des abonnements
const MACRO_FEATURES = [
  'gpt_cv_generation',
  'import_pdf',
  'translate_cv',
  'match_score',
  'optimize_cv',
  'generate_from_job_title',
  'export_cv',
  'edit_cv',
  'create_cv_manual',
];

// Plans d'abonnement par défaut
const DEFAULT_PLANS = [
  {
    name: 'Gratuit',
    description: 'Plan gratuit avec fonctionnalités de base',
    priceMonthly: 0,
    priceYearly: 0,
    yearlyDiscountPercent: 0,
    priceCurrency: 'EUR',
    features: {
      gpt_cv_generation: { enabled: true, limit: 3, analysisLevels: ['rapid'] },
      import_pdf: { enabled: true, limit: 2 },
      generate_from_job_title: { enabled: true, limit: 5 },
      export_cv: { enabled: true, limit: 5 },
      translate_cv: { enabled: false, limit: 0 },
      match_score: { enabled: true, limit: 3 },
      optimize_cv: { enabled: false, limit: 0 },
      edit_cv: { enabled: true, limit: -1 },
      create_cv_manual: { enabled: true, limit: -1 },
    },
  },
  {
    name: 'Pro',
    description: 'Plan professionnel avec toutes les fonctionnalités',
    priceMonthly: 9.99,
    priceYearly: 99.99,
    yearlyDiscountPercent: 16.67,
    priceCurrency: 'EUR',
    features: {
      gpt_cv_generation: { enabled: true, limit: -1, analysisLevels: ['rapid', 'medium'] },
      import_pdf: { enabled: true, limit: -1 },
      generate_from_job_title: { enabled: true, limit: -1 },
      export_cv: { enabled: true, limit: 100 },
      translate_cv: { enabled: true, limit: -1 },
      match_score: { enabled: true, limit: -1 },
      optimize_cv: { enabled: true, limit: -1 },
      edit_cv: { enabled: true, limit: -1 },
      create_cv_manual: { enabled: true, limit: -1 },
    },
  },
  {
    name: 'Premium',
    description: 'Plan premium avec accès illimité à toutes les fonctionnalités',
    priceMonthly: 29.99,
    priceYearly: 299.99,
    yearlyDiscountPercent: 16.67,
    priceCurrency: 'EUR',
    features: {
      gpt_cv_generation: { enabled: true, limit: -1, analysisLevels: ['rapid', 'medium', 'deep'] },
      import_pdf: { enabled: true, limit: -1 },
      generate_from_job_title: { enabled: true, limit: -1 },
      export_cv: { enabled: true, limit: -1 },
      translate_cv: { enabled: true, limit: -1 },
      match_score: { enabled: true, limit: -1 },
      optimize_cv: { enabled: true, limit: -1 },
      edit_cv: { enabled: true, limit: -1 },
      create_cv_manual: { enabled: true, limit: -1 },
    },
  },
];

async function main() {
  console.log('🌱 Début du seeding...');

  // ===== 1. Seed des plans d'abonnement (CRITIQUE pour le fonctionnement) =====
  console.log('\n💳 Création des plans d\'abonnement...');

  let plansCreated = 0;
  let plansSkipped = 0;

  for (const planData of DEFAULT_PLANS) {
    try {
      // Vérifier si le plan existe déjà
      const existingPlan = await prisma.subscriptionPlan.findUnique({
        where: { name: planData.name },
      });

      if (existingPlan) {
        console.log(`  ⏭️  Plan "${planData.name}" existe déjà (ID: ${existingPlan.id})`);
        plansSkipped++;
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
          featureLimits: {
            create: Object.entries(planData.features).map(([featureName, config]) => ({
              featureName,
              isEnabled: config.enabled,
              usageLimit: config.limit,
              allowedAnalysisLevels: config.analysisLevels ? JSON.stringify(config.analysisLevels) : null,
            })),
          },
        },
        include: {
          featureLimits: true,
        },
      });

      console.log(`  ✅ Plan "${planData.name}" créé (ID: ${plan.id}, ${plan.featureLimits.length} features)`);
      plansCreated++;
    } catch (error) {
      console.error(`  ❌ Erreur plan "${planData.name}":`, error.message);
    }
  }

  console.log(`\n  📊 Plans: ${plansCreated} créés, ${plansSkipped} ignorés (${DEFAULT_PLANS.length} total)`);

  // ===== 2. Seed des settings de modèles IA =====
  console.log('\n🤖 Création des settings de modèles IA...');
  const aiModelSettings = [
    // Niveaux d'analyse partagés (utilisés par generateCv, improveCv, importPdf, createTemplate)
    {
      settingName: 'model_analysis_rapid',
      value: 'gpt-5-nano-2025-08-07',
      category: 'ai_models',
      description: 'Modèle rapide et économique pour analyse rapide'
    },
    {
      settingName: 'model_analysis_medium',
      value: 'gpt-5-mini-2025-08-07',
      category: 'ai_models',
      description: 'Modèle standard pour analyse équilibrée'
    },
    {
      settingName: 'model_analysis_deep',
      value: 'gpt-5-2025-08-07',
      category: 'ai_models',
      description: 'Modèle avancé pour analyse approfondie'
    },

    // Modèles dédiés pour features spécifiques
    {
      settingName: 'model_match_score',
      value: 'gpt-4o-mini',
      category: 'ai_models',
      description: 'Modèle pour calcul du score de correspondance'
    },
    {
      settingName: 'model_translate_cv',
      value: 'gpt-4o-mini',
      category: 'ai_models',
      description: 'Modèle pour traduction de CV'
    },
    {
      settingName: 'model_extract_job_offer',
      value: 'gpt-4o-mini',
      category: 'ai_models',
      description: 'Modèle pour extraction d\'offres d\'emploi'
    },
    {
      settingName: 'model_generate_from_job_title',
      value: 'gpt-5-mini-2025-08-07',
      category: 'ai_models',
      description: 'Modèle pour génération de CV depuis titre de poste'
    },
    {
      settingName: 'model_import_pdf',
      value: 'gpt-5-nano-2025-08-07',
      category: 'ai_models',
      description: 'Modèle pour import de CV depuis PDF'
    },
    {
      settingName: 'model_optimize_cv',
      value: 'gpt-5-mini-2025-08-07',
      category: 'ai_models',
      description: 'Modèle pour optimisation de CV'
    },
    {
      settingName: 'model_detect_language',
      value: 'gpt-4o-mini',
      category: 'ai_models',
      description: 'Modèle pour détection de langue de CV (léger, 50 chars max)'
    }
  ];

  for (const setting of aiModelSettings) {
    await prisma.setting.upsert({
      where: { settingName: setting.settingName },
      update: {
        value: setting.value,
        description: setting.description,
      },
      create: setting,
    });
    console.log(`  ✅ ${setting.settingName} = ${setting.value}`);
  }

  console.log('\n✨ Seeding terminé avec succès !');
  console.log('\n📝 Résumé :');
  console.log(`   - Plans d'abonnement : ${plansCreated} créés, ${plansSkipped} ignorés`);
  console.log(`   - Settings IA : ${aiModelSettings.length} configurés`);
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
