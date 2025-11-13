#!/usr/bin/env node

/**
 * Script de vérification post-migration PostgreSQL
 *
 * Usage: node scripts/verify-migration.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyMigration() {
  console.log('🔍 Vérification de la migration PostgreSQL\n');
  console.log('=' .repeat(60));

  try {
    // Vérifier la connexion
    console.log('\n📡 Test de connexion...');
    await prisma.$connect();
    console.log('✅ Connexion PostgreSQL réussie');

    // Obtenir les statistiques
    console.log('\n📊 Statistiques de la base de données:\n');

    const stats = {
      users: await prisma.user.count(),
      accounts: await prisma.account.count(),
      cvFiles: await prisma.cvFile.count(),
      backgroundTasks: await prisma.backgroundTask.count(),
      subscriptionPlans: await prisma.subscriptionPlan.count(),
      subscriptions: await prisma.subscription.count(),
      creditBalances: await prisma.creditBalance.count(),
      creditTransactions: await prisma.creditTransaction.count(),
      creditPacks: await prisma.creditPack.count(),
      telemetryEvents: await prisma.telemetryEvent.count(),
      featureUsage: await prisma.featureUsage.count(),
      openAIUsage: await prisma.openAIUsage.count(),
    };

    // Afficher les statistiques
    Object.entries(stats).forEach(([table, count]) => {
      const icon = count > 0 ? '✅' : '⚠️ ';
      console.log(`${icon} ${table.padEnd(25)} : ${count}`);
    });

    // Vérifications spécifiques
    console.log('\n🔎 Vérifications détaillées:\n');

    // 1. Vérifier les utilisateurs avec leurs relations
    const usersWithRelations = await prisma.user.findMany({
      include: {
        _count: {
          select: {
            accounts: true,
            cvs: true,
            backgroundTasks: true,
            creditTransactions: true,
          }
        }
      },
      take: 5
    });

    if (usersWithRelations.length > 0) {
      console.log('✅ Utilisateurs avec relations:');
      usersWithRelations.forEach(user => {
        console.log(`   - ${user.email || user.id}`);
        console.log(`     Accounts: ${user._count.accounts}, CVs: ${user._count.cvs}`);
        console.log(`     Tasks: ${user._count.backgroundTasks}, Transactions: ${user._count.creditTransactions}`);
      });
    } else {
      console.log('⚠️  Aucun utilisateur trouvé');
    }

    // 2. Vérifier les plans d'abonnement
    const plans = await prisma.subscriptionPlan.findMany();
    console.log('\n✅ Plans d\'abonnement:');
    plans.forEach(plan => {
      console.log(`   - ${plan.name} (${plan.stripePriceIdMonthly || plan.stripePriceIdYearly || 'N/A'})`);
    });

    // 3. Vérifier les tâches récentes
    const recentTasks = await prisma.backgroundTask.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        user: {
          select: { email: true, id: true }
        }
      }
    });

    if (recentTasks.length > 0) {
      console.log('\n✅ Tâches récentes:');
      recentTasks.forEach(task => {
        const createdDate = new Date(Number(task.createdAt));
        console.log(`   - ${task.title} | ${task.status}`);
        console.log(`     User: ${task.user?.email || task.user?.id || task.userId || 'N/A'}`);
        console.log(`     Créée: ${createdDate.toISOString()}`);
      });
    }

    // 4. Vérifier l'intégrité des données
    console.log('\n🔗 Vérification de l\'intégrité:');

    const usersCount = stats.users;
    const accountsCount = stats.accounts;
    const cvsCount = stats.cvFiles;

    if (accountsCount > 0 && accountsCount >= usersCount) {
      console.log('✅ Comptes OAuth: OK');
    } else if (accountsCount === 0) {
      console.log('⚠️  Aucun compte OAuth (utilisation email/password)');
    }

    if (cvsCount > 0) {
      console.log(`✅ CVs chiffrés: ${cvsCount} fichier(s)`);
    } else {
      console.log('⚠️  Aucun CV trouvé');
    }

    if (stats.subscriptions > 0) {
      console.log('✅ Abonnements: OK');
    }

    // Résumé final
    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 Résumé de la migration:\n');

    const totalRecords = Object.values(stats).reduce((sum, count) => sum + count, 0);
    console.log(`📦 Total d'enregistrements: ${totalRecords}`);

    if (totalRecords === 0) {
      console.log('\n⚠️  ATTENTION: Aucune donnée trouvée!');
      console.log('   Vérifiez que la migration s\'est bien exécutée.');
    } else if (stats.users > 0) {
      console.log('\n✅ Migration réussie!');
      console.log('\n📋 Prochaines étapes:');
      console.log('   1. Copier prisma/cv_data/ vers la production');
      console.log('   2. Vérifier CV_ENCRYPTION_KEY identique');
      console.log('   3. Tester l\'accès aux CV chiffrés');
      console.log('   4. Configurer les backups PostgreSQL');
    } else {
      console.log('\n⚠️  Migration partielle détectée');
      console.log('   Certaines tables ont des données, mais pas d\'utilisateurs.');
    }

    // Informations sur la base de données
    console.log('\n💾 Informations de connexion:');
    try {
      const dbInfo = await prisma.$queryRaw`SELECT version() as version`;
      console.log(`   PostgreSQL: ${dbInfo[0].version.split(',')[0]}`);
    } catch (err) {
      // SQLite n'a pas la fonction version()
      console.log(`   Base de données: SQLite (vérifier DATABASE_URL pour PostgreSQL)`);
    }

  } catch (error) {
    console.error('\n❌ Erreur lors de la vérification:', error.message);

    if (error.message.includes('connect')) {
      console.log('\n💡 Suggestions:');
      console.log('   - Vérifiez DATABASE_URL dans .env');
      console.log('   - Assurez-vous que PostgreSQL est démarré');
      console.log('   - Vérifiez les credentials de connexion');
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyMigration();
