#!/usr/bin/env node

/**
 * Script de migration pour recalculer les compteurs de télémétrie
 * basés sur les CV existants dans la base de données.
 *
 * Usage: node scripts/recalculate-telemetry.js
 */

import prisma from '../lib/prisma.js';

// Mapping des types de création vers les features
const CREATED_BY_TO_FEATURE = {
  'generate-cv': 'generate_cv',
  'generate-cv-job-title': 'generate_cv', // Job title = génération de CV
  'create-template': 'generate_cv', // Template = génération de CV
  'import-pdf': 'import_pdf',
  'translate-cv': 'translate_cv',
  null: 'create_cv_manual', // null = création manuelle
  '': 'create_cv_manual',
};

async function recalculateTelemetry() {
  console.log('🔄 Début du recalcul des compteurs de télémétrie...\n');

  try {
    // 1. Récupérer tous les CV groupés par userId et createdBy
    const cvsByUser = await prisma.cvFile.groupBy({
      by: ['userId', 'createdBy'],
      _count: {
        id: true,
      },
    });

    console.log(`📊 ${cvsByUser.length} groupes de CV trouvés\n`);

    // 2. Construire un mapping userId -> feature -> count
    const userFeatureCounts = {};

    for (const group of cvsByUser) {
      const { userId, createdBy, _count } = group;
      const featureName = CREATED_BY_TO_FEATURE[createdBy] || 'create_cv_manual';

      if (!userFeatureCounts[userId]) {
        userFeatureCounts[userId] = {};
      }

      if (!userFeatureCounts[userId][featureName]) {
        userFeatureCounts[userId][featureName] = 0;
      }

      userFeatureCounts[userId][featureName] += _count.id;
    }

    console.log('📋 Compteurs recalculés par utilisateur :');
    for (const [userId, features] of Object.entries(userFeatureCounts)) {
      console.log(`\n  User: ${userId}`);
      for (const [feature, count] of Object.entries(features)) {
        console.log(`    ${feature}: ${count}`);
      }
    }

    // 3. Mettre à jour ou créer les entrées FeatureUsage
    console.log('\n💾 Mise à jour de la base de données...\n');

    let updatedCount = 0;
    let createdCount = 0;

    for (const [userId, features] of Object.entries(userFeatureCounts)) {
      for (const [featureName, count] of Object.entries(features)) {
        const existing = await prisma.featureUsage.findUnique({
          where: {
            userId_featureName: {
              userId,
              featureName,
            },
          },
        });

        if (existing) {
          // Mettre à jour uniquement si le count est différent
          if (existing.usageCount !== count) {
            await prisma.featureUsage.update({
              where: {
                userId_featureName: {
                  userId,
                  featureName,
                },
              },
              data: {
                usageCount: count,
              },
            });
            console.log(`  ✅ Mis à jour: ${featureName} pour ${userId} (${existing.usageCount} → ${count})`);
            updatedCount++;
          }
        } else {
          // Créer une nouvelle entrée
          await prisma.featureUsage.create({
            data: {
              userId,
              featureName,
              usageCount: count,
              lastUsedAt: new Date(),
            },
          });
          console.log(`  ✨ Créé: ${featureName} pour ${userId} (count: ${count})`);
          createdCount++;
        }
      }
    }

    console.log('\n✅ Recalcul terminé avec succès !');
    console.log(`  - ${updatedCount} compteur(s) mis à jour`);
    console.log(`  - ${createdCount} compteur(s) créé(s)`);

  } catch (error) {
    console.error('❌ Erreur lors du recalcul:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
recalculateTelemetry();
