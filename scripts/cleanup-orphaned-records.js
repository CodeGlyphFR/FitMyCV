/**
 * Script de nettoyage des enregistrements orphelins dans la base de données
 *
 * Recherche et supprime les enregistrements qui référencent des utilisateurs inexistants
 *
 * Usage:
 *   node scripts/cleanup-orphaned-records.js           # Mode diagnostic (dry-run)
 *   node scripts/cleanup-orphaned-records.js --delete  # Mode nettoyage (suppression)
 */

require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

const DELETE_MODE = process.argv.includes('--delete');

// Statistiques globales
const stats = {
  totalOrphans: 0,
  totalDeleted: 0,
  filesDeleted: 0,
  errors: 0,
};

/**
 * Vérifie et nettoie les enregistrements orphelins pour une table donnée
 */
async function cleanupOrphanedRecords(tableName, queryFn, deleteFn, customCleanup = null) {
  console.log(`\n🔍 Vérification de la table: ${tableName}`);

  try {
    // Récupérer les enregistrements orphelins
    const orphans = await queryFn();

    if (orphans.length === 0) {
      console.log(`   ✅ Aucun enregistrement orphelin`);
      return;
    }

    console.log(`   ⚠️  ${orphans.length} enregistrement(s) orphelin(s) trouvé(s)`);
    stats.totalOrphans += orphans.length;

    // Afficher quelques exemples
    const samplesToShow = Math.min(3, orphans.length);
    for (let i = 0; i < samplesToShow; i++) {
      const orphan = orphans[i];
      console.log(`      - ID: ${orphan.id}, userId: ${orphan.userId || orphan.referrerId || 'N/A'}`);
    }
    if (orphans.length > samplesToShow) {
      console.log(`      ... et ${orphans.length - samplesToShow} autre(s)`);
    }

    // Supprimer si mode delete activé
    if (DELETE_MODE) {
      console.log(`   🗑️  Suppression en cours...`);

      // Nettoyage personnalisé si fourni (ex: fichiers physiques)
      if (customCleanup) {
        await customCleanup(orphans);
      }

      // Supprimer de la base de données
      const result = await deleteFn(orphans);
      stats.totalDeleted += result.count || orphans.length;
      console.log(`   ✅ ${result.count || orphans.length} enregistrement(s) supprimé(s)`);
    }
  } catch (error) {
    console.error(`   ❌ Erreur lors du traitement de ${tableName}:`, error.message);
    stats.errors++;
  }
}

/**
 * Supprime les fichiers CV physiques du disque
 */
async function deleteCvFiles(cvFiles) {
  for (const cvFile of cvFiles) {
    try {
      const cvPath = path.join(process.cwd(), 'cvs', cvFile.userId, cvFile.filename);
      await fs.unlink(cvPath);
      stats.filesDeleted++;
      console.log(`      - Fichier supprimé: cvs/${cvFile.userId}/${cvFile.filename}`);
    } catch (error) {
      // Ignore si le fichier n'existe pas
      if (error.code !== 'ENOENT') {
        console.error(`      ⚠️  Erreur suppression fichier ${cvFile.filename}:`, error.message);
      }
    }
  }
}

/**
 * Fonction principale
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧹 NETTOYAGE DES ENREGISTREMENTS ORPHELINS');
  console.log('═══════════════════════════════════════════════════════════');

  if (DELETE_MODE) {
    console.log('\n⚠️  MODE SUPPRESSION ACTIVÉ - Les données seront supprimées !');
  } else {
    console.log('\n📋 MODE DIAGNOSTIC - Aucune suppression (ajoutez --delete pour supprimer)');
  }

  console.log('\n📊 Analyse en cours...\n');

  // 1. CvFile - Avec suppression des fichiers physiques
  await cleanupOrphanedRecords(
    'CvFile',
    async () => {
      // Trouver tous les userId uniques dans CvFile
      const cvFiles = await prisma.cvFile.findMany({
        select: { id: true, userId: true, filename: true },
      });

      // Vérifier lesquels n'ont pas d'utilisateur correspondant
      const orphans = [];
      for (const cvFile of cvFiles) {
        const userExists = await prisma.user.findUnique({
          where: { id: cvFile.userId },
          select: { id: true },
        });
        if (!userExists) {
          orphans.push(cvFile);
        }
      }
      return orphans;
    },
    async (orphans) => {
      const ids = orphans.map((o) => o.id);
      return await prisma.cvFile.deleteMany({
        where: { id: { in: ids } },
      });
    },
    deleteCvFiles // Nettoyage personnalisé pour supprimer les fichiers
  );

  // 2. FeatureUsage
  await cleanupOrphanedRecords(
    'FeatureUsage',
    async () => {
      const records = await prisma.featureUsage.findMany({
        select: { id: true, userId: true, featureName: true },
      });

      const orphans = [];
      for (const record of records) {
        const userExists = await prisma.user.findUnique({
          where: { id: record.userId },
          select: { id: true },
        });
        if (!userExists) {
          orphans.push(record);
        }
      }
      return orphans;
    },
    async (orphans) => {
      const ids = orphans.map((o) => o.id);
      return await prisma.featureUsage.deleteMany({
        where: { id: { in: ids } },
      });
    }
  );

  // 3. Account
  await cleanupOrphanedRecords(
    'Account',
    async () => {
      const records = await prisma.account.findMany({
        select: { id: true, userId: true, provider: true },
      });

      const orphans = [];
      for (const record of records) {
        const userExists = await prisma.user.findUnique({
          where: { id: record.userId },
          select: { id: true },
        });
        if (!userExists) {
          orphans.push(record);
        }
      }
      return orphans;
    },
    async (orphans) => {
      const ids = orphans.map((o) => o.id);
      return await prisma.account.deleteMany({
        where: { id: { in: ids } },
      });
    }
  );

  // 4. LinkHistory
  await cleanupOrphanedRecords(
    'LinkHistory',
    async () => {
      const records = await prisma.linkHistory.findMany({
        select: { id: true, userId: true, url: true },
      });

      const orphans = [];
      for (const record of records) {
        const userExists = await prisma.user.findUnique({
          where: { id: record.userId },
          select: { id: true },
        });
        if (!userExists) {
          orphans.push(record);
        }
      }
      return orphans;
    },
    async (orphans) => {
      const ids = orphans.map((o) => o.id);
      return await prisma.linkHistory.deleteMany({
        where: { id: { in: ids } },
      });
    }
  );

  // 5. Feedback
  await cleanupOrphanedRecords(
    'Feedback',
    async () => {
      const records = await prisma.feedback.findMany({
        select: { id: true, userId: true, rating: true },
      });

      const orphans = [];
      for (const record of records) {
        const userExists = await prisma.user.findUnique({
          where: { id: record.userId },
          select: { id: true },
        });
        if (!userExists) {
          orphans.push(record);
        }
      }
      return orphans;
    },
    async (orphans) => {
      const ids = orphans.map((o) => o.id);
      return await prisma.feedback.deleteMany({
        where: { id: { in: ids } },
      });
    }
  );

  // 6. ConsentLog
  await cleanupOrphanedRecords(
    'ConsentLog',
    async () => {
      const records = await prisma.consentLog.findMany({
        select: { id: true, userId: true },
      });

      const orphans = [];
      for (const record of records) {
        const userExists = await prisma.user.findUnique({
          where: { id: record.userId },
          select: { id: true },
        });
        if (!userExists) {
          orphans.push(record);
        }
      }
      return orphans;
    },
    async (orphans) => {
      const ids = orphans.map((o) => o.id);
      return await prisma.consentLog.deleteMany({
        where: { id: { in: ids } },
      });
    }
  );

  // 7. TelemetryEvent (userId nullable, skip si null)
  await cleanupOrphanedRecords(
    'TelemetryEvent',
    async () => {
      const records = await prisma.telemetryEvent.findMany({
        where: { userId: { not: null } },
        select: { id: true, userId: true, type: true },
      });

      const orphans = [];
      for (const record of records) {
        if (record.userId) {
          const userExists = await prisma.user.findUnique({
            where: { id: record.userId },
            select: { id: true },
          });
          if (!userExists) {
            orphans.push(record);
          }
        }
      }
      return orphans;
    },
    async (orphans) => {
      const ids = orphans.map((o) => o.id);
      return await prisma.telemetryEvent.deleteMany({
        where: { id: { in: ids } },
      });
    }
  );

  // 8. OpenAIUsage
  await cleanupOrphanedRecords(
    'OpenAIUsage',
    async () => {
      const records = await prisma.openAIUsage.findMany({
        select: { id: true, userId: true, featureName: true },
      });

      const orphans = [];
      for (const record of records) {
        const userExists = await prisma.user.findUnique({
          where: { id: record.userId },
          select: { id: true },
        });
        if (!userExists) {
          orphans.push(record);
        }
      }
      return orphans;
    },
    async (orphans) => {
      const ids = orphans.map((o) => o.id);
      return await prisma.openAIUsage.deleteMany({
        where: { id: { in: ids } },
      });
    }
  );

  // 9. OpenAICall
  await cleanupOrphanedRecords(
    'OpenAICall',
    async () => {
      const records = await prisma.openAICall.findMany({
        select: { id: true, userId: true, featureName: true },
      });

      const orphans = [];
      for (const record of records) {
        const userExists = await prisma.user.findUnique({
          where: { id: record.userId },
          select: { id: true },
        });
        if (!userExists) {
          orphans.push(record);
        }
      }
      return orphans;
    },
    async (orphans) => {
      const ids = orphans.map((o) => o.id);
      return await prisma.openAICall.deleteMany({
        where: { id: { in: ids } },
      });
    }
  );

  // 10. Subscription
  await cleanupOrphanedRecords(
    'Subscription',
    async () => {
      const records = await prisma.subscription.findMany({
        select: { id: true, userId: true, status: true },
      });

      const orphans = [];
      for (const record of records) {
        const userExists = await prisma.user.findUnique({
          where: { id: record.userId },
          select: { id: true },
        });
        if (!userExists) {
          orphans.push(record);
        }
      }
      return orphans;
    },
    async (orphans) => {
      const ids = orphans.map((o) => o.id);
      return await prisma.subscription.deleteMany({
        where: { id: { in: ids } },
      });
    }
  );

  // 11. CreditBalance
  await cleanupOrphanedRecords(
    'CreditBalance',
    async () => {
      const records = await prisma.creditBalance.findMany({
        select: { id: true, userId: true, balance: true },
      });

      const orphans = [];
      for (const record of records) {
        const userExists = await prisma.user.findUnique({
          where: { id: record.userId },
          select: { id: true },
        });
        if (!userExists) {
          orphans.push(record);
        }
      }
      return orphans;
    },
    async (orphans) => {
      const ids = orphans.map((o) => o.id);
      return await prisma.creditBalance.deleteMany({
        where: { id: { in: ids } },
      });
    }
  );

  // 12. CreditTransaction
  await cleanupOrphanedRecords(
    'CreditTransaction',
    async () => {
      const records = await prisma.creditTransaction.findMany({
        select: { id: true, userId: true, type: true },
      });

      const orphans = [];
      for (const record of records) {
        const userExists = await prisma.user.findUnique({
          where: { id: record.userId },
          select: { id: true },
        });
        if (!userExists) {
          orphans.push(record);
        }
      }
      return orphans;
    },
    async (orphans) => {
      const ids = orphans.map((o) => o.id);
      return await prisma.creditTransaction.deleteMany({
        where: { id: { in: ids } },
      });
    }
  );

  // 13. FeatureUsageCounter
  await cleanupOrphanedRecords(
    'FeatureUsageCounter',
    async () => {
      const records = await prisma.featureUsageCounter.findMany({
        select: { id: true, userId: true, featureName: true },
      });

      const orphans = [];
      for (const record of records) {
        const userExists = await prisma.user.findUnique({
          where: { id: record.userId },
          select: { id: true },
        });
        if (!userExists) {
          orphans.push(record);
        }
      }
      return orphans;
    },
    async (orphans) => {
      const ids = orphans.map((o) => o.id);
      return await prisma.featureUsageCounter.deleteMany({
        where: { id: { in: ids } },
      });
    }
  );

  // 14. BackgroundTask (userId nullable)
  await cleanupOrphanedRecords(
    'BackgroundTask',
    async () => {
      const records = await prisma.backgroundTask.findMany({
        where: { userId: { not: null } },
        select: { id: true, userId: true, type: true },
      });

      const orphans = [];
      for (const record of records) {
        if (record.userId) {
          const userExists = await prisma.user.findUnique({
            where: { id: record.userId },
            select: { id: true },
          });
          if (!userExists) {
            orphans.push(record);
          }
        }
      }
      return orphans;
    },
    async (orphans) => {
      const ids = orphans.map((o) => o.id);
      return await prisma.backgroundTask.deleteMany({
        where: { id: { in: ids } },
      });
    }
  );

  // 15. Referral (2 relations: referrer et referred)
  await cleanupOrphanedRecords(
    'Referral',
    async () => {
      const records = await prisma.referral.findMany({
        select: { id: true, referrerId: true, referredUserId: true },
      });

      const orphans = [];
      for (const record of records) {
        const referrerExists = await prisma.user.findUnique({
          where: { id: record.referrerId },
          select: { id: true },
        });
        const referredExists = await prisma.user.findUnique({
          where: { id: record.referredUserId },
          select: { id: true },
        });

        // Orphelin si l'un des deux utilisateurs n'existe pas
        if (!referrerExists || !referredExists) {
          orphans.push(record);
        }
      }
      return orphans;
    },
    async (orphans) => {
      const ids = orphans.map((o) => o.id);
      return await prisma.referral.deleteMany({
        where: { id: { in: ids } },
      });
    }
  );

  // Rapport final
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 RAPPORT FINAL');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Total d'enregistrements orphelins trouvés: ${stats.totalOrphans}`);

  if (DELETE_MODE) {
    console.log(`Total d'enregistrements supprimés: ${stats.totalDeleted}`);
    console.log(`Total de fichiers CV supprimés: ${stats.filesDeleted}`);
    console.log(`Erreurs rencontrées: ${stats.errors}`);

    if (stats.totalDeleted > 0) {
      console.log('\n✅ Nettoyage terminé avec succès !');
      console.log('💡 Vous pouvez maintenant ouvrir Prisma Studio sans erreur.');
    } else {
      console.log('\n✅ Aucun enregistrement à supprimer.');
    }
  } else {
    if (stats.totalOrphans > 0) {
      console.log('\n⚠️  Pour supprimer ces enregistrements orphelins, exécutez:');
      console.log('   node scripts/cleanup-orphaned-records.js --delete');
    } else {
      console.log('\n✅ Aucun enregistrement orphelin trouvé !');
      console.log('💡 Votre base de données est propre.');
    }
  }

  console.log('═══════════════════════════════════════════════════════════\n');
}

main()
  .catch((error) => {
    console.error('\n❌ Erreur fatale lors de l\'exécution:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
