/**
 * Script pour corriger les noms de features et ajouter les features manquantes
 * Usage: node scripts/fix-feature-names.js
 */

// Charger les variables d'environnement depuis .env.local
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Mapping des anciens noms vers les nouveaux
const FEATURE_RENAMES = {
  'match_score': 'calculate_match_score',
  'optimize_cv': 'improve_cv',
  'generate_from_job_title': 'generate_cv_from_job_title',
  'export_cv': 'export_pdf',
};

// Features manquantes à ajouter
const MISSING_FEATURES = {
  'Gratuit': {
    export_pdf: { enabled: true, limit: 5 },
    calculate_match_score: { enabled: true, limit: 3 },
    improve_cv: { enabled: false, limit: 0 },
    generate_cv_from_job_title: { enabled: true, limit: 5 },
  },
  'Pro': {
    export_pdf: { enabled: true, limit: 100 },
    calculate_match_score: { enabled: true, limit: -1 },
    improve_cv: { enabled: true, limit: -1 },
    generate_cv_from_job_title: { enabled: true, limit: -1 },
  },
  'Premium': {
    export_pdf: { enabled: true, limit: -1 },
    calculate_match_score: { enabled: true, limit: -1 },
    improve_cv: { enabled: true, limit: -1 },
    generate_cv_from_job_title: { enabled: true, limit: -1 },
  },
};

async function fixFeatureNames() {
  console.log('🔧 Début de la correction des noms de features...\n');

  try {
    // 1. Récupérer tous les plans
    const plans = await prisma.subscriptionPlan.findMany({
      include: {
        featureLimits: true,
      },
    });

    console.log(`📋 ${plans.length} plans trouvés\n`);

    for (const plan of plans) {
      console.log(`\n🔍 Traitement du plan "${plan.name}"...`);

      // 2. Renommer les features existantes
      for (const [oldName, newName] of Object.entries(FEATURE_RENAMES)) {
        const existingFeature = plan.featureLimits.find(f => f.featureName === oldName);

        if (existingFeature) {
          // Vérifier si la nouvelle feature existe déjà
          const newFeatureExists = plan.featureLimits.find(f => f.featureName === newName);

          if (newFeatureExists) {
            // Supprimer l'ancienne
            await prisma.subscriptionPlanFeatureLimit.delete({
              where: { id: existingFeature.id },
            });
            console.log(`   ❌ Supprimé "${oldName}" (doublon avec "${newName}")`);
          } else {
            // Renommer
            await prisma.subscriptionPlanFeatureLimit.update({
              where: { id: existingFeature.id },
              data: { featureName: newName },
            });
            console.log(`   ✅ Renommé "${oldName}" → "${newName}"`);
          }
        }
      }

      // 3. Recharger les features du plan après les renommages
      const updatedPlan = await prisma.subscriptionPlan.findUnique({
        where: { id: plan.id },
        include: { featureLimits: true },
      });

      // 4. Ajouter les features manquantes
      const missingForPlan = MISSING_FEATURES[plan.name] || {};

      for (const [featureName, config] of Object.entries(missingForPlan)) {
        const exists = updatedPlan.featureLimits.find(f => f.featureName === featureName);

        if (!exists) {
          await prisma.subscriptionPlanFeatureLimit.create({
            data: {
              planId: plan.id,
              featureName,
              isEnabled: config.enabled,
              usageLimit: config.limit,
              allowedAnalysisLevels: null,
            },
          });
          console.log(`   ➕ Ajouté "${featureName}" (limit: ${config.limit})`);
        } else {
          console.log(`   ⏭️  "${featureName}" existe déjà`);
        }
      }
    }

    console.log('\n\n✨ Correction terminée avec succès!');

    // Afficher un résumé
    console.log('\n📊 Résumé des features par plan:');
    const updatedPlans = await prisma.subscriptionPlan.findMany({
      include: {
        featureLimits: true,
      },
    });

    for (const plan of updatedPlans) {
      console.log(`\n   ${plan.name}: ${plan.featureLimits.length} features`);
      for (const feature of plan.featureLimits) {
        const limit = feature.usageLimit === -1 ? '∞' : feature.usageLimit;
        const status = feature.isEnabled ? '✅' : '❌';
        console.log(`      ${status} ${feature.featureName}: ${limit}`);
      }
    }

  } catch (error) {
    console.error('❌ Erreur lors de la correction:', error);
    throw error;
  }
}

fixFeatureNames()
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
