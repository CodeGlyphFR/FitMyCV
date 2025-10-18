/**
 * Script de backfill de télémétrie
 *
 * Ce script importe les données historiques existantes dans le système de télémétrie
 * pour que le dashboard affiche les statistiques correctes dès maintenant.
 *
 * Usage: npm run backfill:telemetry
 *    ou: node scripts/backfill-telemetry.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Event types (copié depuis lib/telemetry/server.js)
const EventTypes = {
  // CV Management
  CV_GENERATED: 'CV_GENERATED',
  CV_IMPORTED: 'CV_IMPORTED',
  CV_EXPORTED: 'CV_EXPORTED',
  CV_CREATED_MANUAL: 'CV_CREATED_MANUAL',
  CV_EDITED: 'CV_EDITED',
  CV_DELETED: 'CV_DELETED',
  CV_TRANSLATED: 'CV_TRANSLATED',

  // Match Score & Optimization
  MATCH_SCORE_CALCULATED: 'MATCH_SCORE_CALCULATED',
  CV_OPTIMIZED: 'CV_OPTIMIZED',

  // Job Processing
  JOB_QUEUED: 'JOB_QUEUED',
  JOB_STARTED: 'JOB_STARTED',
  JOB_COMPLETED: 'JOB_COMPLETED',
  JOB_FAILED: 'JOB_FAILED',
  JOB_CANCELLED: 'JOB_CANCELLED',

  // Auth
  USER_REGISTERED: 'USER_REGISTERED',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',
  PASSWORD_RESET: 'PASSWORD_RESET',

  // Navigation & Interaction (Frontend)
  PAGE_VIEW: 'PAGE_VIEW',
  BUTTON_CLICK: 'BUTTON_CLICK',
  MODAL_OPENED: 'MODAL_OPENED',
  MODAL_CLOSED: 'MODAL_CLOSED',
  FORM_SUBMITTED: 'FORM_SUBMITTED',
};

console.log('🚀 Début du backfill de télémétrie...\n');

async function backfillUsers() {
  console.log('👥 Backfill des utilisateurs...');

  const users = await prisma.user.findMany({
    select: {
      id: true,
      createdAt: true,
      passwordHash: true,
    },
  });

  let count = 0;
  for (const user of users) {
    try {
      const provider = user.passwordHash ? 'credentials' : 'oauth';

      // Créer un événement de registration avec la date de création de l'utilisateur
      await prisma.telemetryEvent.create({
        data: {
          type: EventTypes.USER_REGISTERED,
          category: 'auth',
          userId: user.id,
          metadata: JSON.stringify({ provider }),
          status: 'success',
          timestamp: user.createdAt,
          createdAt: user.createdAt,
        },
      });

      count++;
    } catch (error) {
      console.error(`  ❌ Erreur pour user ${user.id}:`, error.message);
    }
  }

  console.log(`  ✅ ${count} utilisateurs importés\n`);
}

async function backfillCvFiles() {
  console.log('📄 Backfill des fichiers CV...');

  const cvFiles = await prisma.cvFile.findMany({
    select: {
      id: true,
      userId: true,
      filename: true,
      createdBy: true,
      sourceType: true,
      sourceValue: true,
      analysisLevel: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const stats = {
    generated: 0,
    imported: 0,
    manual: 0,
    translated: 0,
    optimized: 0,
  };

  for (const cvFile of cvFiles) {
    try {
      let eventType = null;
      let metadata = {};

      // Déterminer le type d'événement selon createdBy
      switch (cvFile.createdBy) {
        case 'generate-cv':
        case 'generate-cv-job-title':
          eventType = EventTypes.CV_GENERATED;
          metadata = {
            analysisLevel: cvFile.analysisLevel || 'medium',
            sourceType: cvFile.sourceType || 'link',
            sourceCount: 1,
          };
          stats.generated++;
          break;

        case 'import-pdf':
          eventType = EventTypes.CV_IMPORTED;
          metadata = {
            analysisLevel: cvFile.analysisLevel || 'medium',
            fileSize: 0, // Information non disponible
          };
          stats.imported++;
          break;

        case 'translate-cv':
          eventType = EventTypes.CV_TRANSLATED;
          metadata = {
            targetLanguage: 'unknown',
          };
          stats.translated++;
          break;

        case 'improve-cv':
          eventType = EventTypes.CV_OPTIMIZED;
          metadata = {
            analysisLevel: cvFile.analysisLevel || 'medium',
            changesCount: 0,
            sectionsModified: [],
          };
          stats.optimized++;
          break;

        case 'manual-edit':
        case null:
          eventType = EventTypes.CV_CREATED_MANUAL;
          metadata = {};
          stats.manual++;
          break;

        default:
          console.log(`  ⚠️  Type inconnu: ${cvFile.createdBy} pour ${cvFile.filename}`);
          continue;
      }

      if (eventType) {
        // Créer l'événement avec la date de création du CV
        await prisma.telemetryEvent.create({
          data: {
            type: eventType,
            category: 'cv_management',
            userId: cvFile.userId,
            metadata: JSON.stringify(metadata),
            status: 'success',
            timestamp: cvFile.createdAt,
            createdAt: cvFile.createdAt,
          },
        });

        // Mettre à jour FeatureUsage
        if (cvFile.userId) {
          await updateFeatureUsage(cvFile.userId, eventType, metadata, cvFile.createdAt);
        }
      }
    } catch (error) {
      console.error(`  ❌ Erreur pour CV ${cvFile.filename}:`, error.message);
    }
  }

  console.log(`  ✅ CVs importés:`);
  console.log(`    - Générés: ${stats.generated}`);
  console.log(`    - Importés PDF: ${stats.imported}`);
  console.log(`    - Créés manuellement: ${stats.manual}`);
  console.log(`    - Traduits: ${stats.translated}`);
  console.log(`    - Optimisés: ${stats.optimized}\n`);
}

async function backfillMatchScores() {
  console.log('🎯 Backfill des scores de match...');

  const cvFilesWithScore = await prisma.cvFile.findMany({
    where: {
      matchScore: { not: null },
    },
    select: {
      userId: true,
      matchScore: true,
      matchScoreUpdatedAt: true,
      createdAt: true,
    },
  });

  let count = 0;
  for (const cvFile of cvFilesWithScore) {
    try {
      await prisma.telemetryEvent.create({
        data: {
          type: EventTypes.MATCH_SCORE_CALCULATED,
          category: 'job_processing',
          userId: cvFile.userId,
          metadata: JSON.stringify({
            score: cvFile.matchScore,
            isAutomatic: false,
            tokensUsed: 1,
            tokensRemaining: 0,
          }),
          status: 'success',
          timestamp: cvFile.matchScoreUpdatedAt || cvFile.createdAt,
          createdAt: cvFile.matchScoreUpdatedAt || cvFile.createdAt,
        },
      });

      // Mettre à jour FeatureUsage
      await updateFeatureUsage(
        cvFile.userId,
        EventTypes.MATCH_SCORE_CALCULATED,
        {},
        cvFile.matchScoreUpdatedAt || cvFile.createdAt
      );

      count++;
    } catch (error) {
      console.error(`  ❌ Erreur pour score:`, error.message);
    }
  }

  console.log(`  ✅ ${count} scores de match importés\n`);
}

async function backfillBackgroundTasks() {
  console.log('⚙️  Backfill des tâches en arrière-plan...');

  const completedTasks = await prisma.backgroundTask.findMany({
    where: {
      status: 'completed',
    },
    select: {
      id: true,
      userId: true,
      type: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const stats = {
    jobs_completed: 0,
  };

  for (const task of completedTasks) {
    try {
      await prisma.telemetryEvent.create({
        data: {
          type: EventTypes.JOB_COMPLETED,
          category: 'job_processing',
          userId: task.userId,
          metadata: JSON.stringify({
            jobType: task.type,
          }),
          status: 'success',
          timestamp: task.updatedAt || task.createdAt,
          createdAt: task.updatedAt || task.createdAt,
        },
      });

      stats.jobs_completed++;
    } catch (error) {
      console.error(`  ❌ Erreur pour tâche ${task.id}:`, error.message);
    }
  }

  console.log(`  ✅ ${stats.jobs_completed} tâches complétées importées\n`);
}

async function updateFeatureUsage(userId, eventType, metadata, timestamp) {
  // Mapping des types d'événements vers les noms de features
  const featureMapping = {
    [EventTypes.CV_GENERATED]: 'generate_cv',
    [EventTypes.CV_IMPORTED]: 'import_pdf',
    [EventTypes.CV_EXPORTED]: 'export_pdf',
    [EventTypes.CV_CREATED_MANUAL]: 'create_cv_manual',
    [EventTypes.CV_EDITED]: 'edit_cv',
    [EventTypes.MATCH_SCORE_CALCULATED]: 'calculate_match_score',
    [EventTypes.CV_OPTIMIZED]: 'optimize_cv',
    [EventTypes.CV_TRANSLATED]: 'translate_cv',
  };

  const featureName = featureMapping[eventType];
  if (!featureName) return;

  try {
    // Vérifier si l'enregistrement existe
    const existing = await prisma.featureUsage.findUnique({
      where: {
        userId_featureName: {
          userId,
          featureName,
        },
      },
    });

    if (existing) {
      // Mettre à jour
      const currentMetadata = existing.metadata ? JSON.parse(existing.metadata) : {};
      const newMetadata = { ...currentMetadata };

      // Merger les métadonnées d'analysisLevel
      if (metadata?.analysisLevel) {
        newMetadata[metadata.analysisLevel] = (newMetadata[metadata.analysisLevel] || 0) + 1;
      }

      await prisma.featureUsage.update({
        where: {
          userId_featureName: {
            userId,
            featureName,
          },
        },
        data: {
          usageCount: {
            increment: 1,
          },
          lastUsedAt: timestamp,
          metadata: JSON.stringify(newMetadata),
        },
      });
    } else {
      // Créer
      const initialMetadata = {};
      if (metadata?.analysisLevel) {
        initialMetadata[metadata.analysisLevel] = 1;
      }

      await prisma.featureUsage.create({
        data: {
          userId,
          featureName,
          usageCount: 1,
          lastUsedAt: timestamp,
          totalDuration: 0,
          metadata: Object.keys(initialMetadata).length > 0 ? JSON.stringify(initialMetadata) : null,
        },
      });
    }
  } catch (error) {
    // Ignorer les erreurs silencieusement pour ne pas bloquer le backfill
    console.debug(`  ⚠️  Impossible de mettre à jour FeatureUsage pour ${userId}/${featureName}`);
  }
}

async function cleanupExistingTelemetry() {
  console.log('🧹 Nettoyage des données de télémétrie existantes...');

  const deleteEvents = await prisma.telemetryEvent.deleteMany({});
  const deleteFeatureUsage = await prisma.featureUsage.deleteMany({});

  console.log(`  ✅ ${deleteEvents.count} événements supprimés`);
  console.log(`  ✅ ${deleteFeatureUsage.count} enregistrements FeatureUsage supprimés\n`);
}

async function displayStats() {
  console.log('📊 Statistiques finales:');

  const eventCount = await prisma.telemetryEvent.count();
  const featureUsageCount = await prisma.featureUsage.count();
  const userCount = await prisma.user.count();

  console.log(`  - ${eventCount} événements de télémétrie`);
  console.log(`  - ${featureUsageCount} enregistrements de FeatureUsage`);
  console.log(`  - ${userCount} utilisateurs\n`);

  // Détail par type d'événement
  const eventsByType = await prisma.telemetryEvent.groupBy({
    by: ['type'],
    _count: true,
  });

  console.log('  Événements par type:');
  for (const { type, _count } of eventsByType) {
    console.log(`    - ${type}: ${_count}`);
  }
  console.log('');
}

async function main() {
  try {
    console.log('📦 Connexion à la base de données...\n');

    // 1. Nettoyer les données existantes (optionnel - décommenter si besoin)
    // await cleanupExistingTelemetry();

    // 2. Backfill des utilisateurs
    await backfillUsers();

    // 3. Backfill des CVs
    await backfillCvFiles();

    // 4. Backfill des scores de match
    await backfillMatchScores();

    // 5. Backfill des tâches en arrière-plan
    await backfillBackgroundTasks();

    // 6. Afficher les statistiques
    await displayStats();

    console.log('✅ Backfill terminé avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors du backfill:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
