const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Templates email par défaut avec placeholders {{variable}}
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
      ⚠️ Attention
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
      ⚠️ Important
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

// Mapping des features entre Setting, OpenAICall et SubscriptionPlanFeatureLimit
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
    settingNames: ['model_analysis_rapid', 'model_analysis_medium', 'model_analysis_deep', 'model_extract_job_offer'],
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
    featureKey: 'detect_language',
    displayName: 'Détection langue',
    settingNames: ['model_detect_language'],
    openAICallNames: ['detect_cv_language'],
    planFeatureNames: ['match_score', 'gpt_cv_generation', 'import_pdf'], // Utilisé par ces features
  },
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

  // ===== 2b. Seed des settings de crédits par feature =====
  console.log('\n💳 Création des settings de crédits par feature...');
  const creditSettings = [
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
      settingName: 'credits_gpt_cv_generation_rapid',
      value: '1',
      category: 'credits',
      description: 'Crédits pour génération CV rapide',
    },
    {
      settingName: 'credits_gpt_cv_generation_medium',
      value: '2',
      category: 'credits',
      description: 'Crédits pour génération CV normal',
    },
    {
      settingName: 'credits_gpt_cv_generation_deep',
      value: '0',
      category: 'credits',
      description: '0 = Abonnement Premium requis',
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

  for (const setting of creditSettings) {
    await prisma.setting.upsert({
      where: { settingName: setting.settingName },
      update: {
        value: setting.value,
        description: setting.description,
      },
      create: setting,
    });
    console.log(`  ✅ ${setting.settingName} = ${setting.value} crédit(s)`);
  }

  // ===== 3. Seed du mapping des features =====
  console.log('\n🔗 Création du mapping des features...');

  let mappingsCreated = 0;
  let mappingsUpdated = 0;

  for (const mapping of FEATURE_MAPPINGS) {
    try {
      const result = await prisma.featureMapping.upsert({
        where: { featureKey: mapping.featureKey },
        update: {
          displayName: mapping.displayName,
          settingNames: mapping.settingNames,
          openAICallNames: mapping.openAICallNames,
          planFeatureNames: mapping.planFeatureNames,
        },
        create: {
          featureKey: mapping.featureKey,
          displayName: mapping.displayName,
          settingNames: mapping.settingNames,
          openAICallNames: mapping.openAICallNames,
          planFeatureNames: mapping.planFeatureNames,
        },
      });

      // Check if it was created or updated based on createdAt vs updatedAt
      const wasCreated = result.createdAt.getTime() === result.updatedAt.getTime();
      if (wasCreated) {
        console.log(`  ✅ Mapping "${mapping.featureKey}" créé`);
        mappingsCreated++;
      } else {
        console.log(`  🔄 Mapping "${mapping.featureKey}" mis à jour`);
        mappingsUpdated++;
      }
    } catch (error) {
      console.error(`  ❌ Erreur mapping "${mapping.featureKey}":`, error.message);
    }
  }

  console.log(`\n  📊 Mappings: ${mappingsCreated} créés, ${mappingsUpdated} mis à jour (${FEATURE_MAPPINGS.length} total)`);

  // ===== 4. Seed des templates email =====
  console.log('\n📧 Création des templates email...');

  let templatesCreated = 0;
  let templatesSkipped = 0;

  for (const template of EMAIL_TEMPLATES) {
    try {
      const existing = await prisma.emailTemplate.findUnique({
        where: { name: template.name },
      });

      if (existing) {
        console.log(`  ⏭️  Template "${template.name}" existe déjà (ID: ${existing.id})`);
        templatesSkipped++;
        continue;
      }

      const created = await prisma.emailTemplate.create({
        data: template,
      });

      console.log(`  ✅ Template "${template.name}" créé (ID: ${created.id})`);
      templatesCreated++;
    } catch (error) {
      console.error(`  ❌ Erreur template "${template.name}":`, error.message);
    }
  }

  console.log(`\n  📊 Templates: ${templatesCreated} créés, ${templatesSkipped} ignorés (${EMAIL_TEMPLATES.length} total)`);

  console.log('\n✨ Seeding terminé avec succès !');
  console.log('\n📝 Résumé :');
  console.log(`   - Plans d'abonnement : ${plansCreated} créés, ${plansSkipped} ignorés`);
  console.log(`   - Settings IA : ${aiModelSettings.length} configurés`);
  console.log(`   - Settings crédits : ${creditSettings.length} configurés`);
  console.log(`   - Feature Mappings : ${mappingsCreated} créés, ${mappingsUpdated} mis à jour`);
  console.log(`   - Templates email : ${templatesCreated} créés, ${templatesSkipped} ignorés`);
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
