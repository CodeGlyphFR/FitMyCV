#!/usr/bin/env node

/**
 * Script de migration SQLite → PostgreSQL (version 2)
 *
 * Cette version utilise sqlite3 directement pour lire SQLite
 * et Prisma pour écrire dans PostgreSQL
 */

const { PrismaClient } = require('@prisma/client');
const Database = require('better-sqlite3');
const path = require('path');

const prisma = new PrismaClient(); // PostgreSQL
const sqliteDb = new Database(path.join(__dirname, '../prisma/dev.db'), { readonly: true });

async function migrate() {
  console.log('🚀 Début de la migration SQLite → PostgreSQL\n');
  console.log('=' .repeat(60));

  try {
    // Helper function to convert SQLite data to PostgreSQL format
    const convertDates = (obj, dateFields) => {
      const converted = { ...obj };
      for (const field of dateFields) {
        if (converted[field] !== null && converted[field] !== undefined) {
          converted[field] = new Date(converted[field]);
        }
      }
      // Convert boolean fields (SQLite stores as 0/1)
      for (const key in converted) {
        if (typeof converted[key] === 'number' && (converted[key] === 0 || converted[key] === 1)) {
          const boolFields = ['hasCompletedOnboarding', 'isTranslated', 'blocked', 'createdWithCredit', 'creditUsed', 'shouldUpdateCvList'];
          if (boolFields.includes(key)) {
            converted[key] = Boolean(converted[key]);
          }
        }
      }
      return converted;
    };

    // 1. Migrer les utilisateurs
    console.log('\n📋 Migration des utilisateurs...');
    const users = sqliteDb.prepare('SELECT * FROM User').all();

    for (const user of users) {
      const userData = convertDates(user, ['emailVerified', 'resetTokenExpiry', 'createdAt', 'updatedAt']);
      // Supprimer les champs qui n'existent plus dans le nouveau schéma
      delete userData.onboardingProgress;
      delete userData.hasCompletedOnboarding;
      delete userData.onboardingCompletedAt;
      delete userData.viewedTooltips;

      await prisma.user.upsert({
        where: { id: userData.id },
        update: userData,
        create: userData
      });
    }
    console.log(`✅ ${users.length} utilisateurs migrés`);

    // 2. Migrer les comptes OAuth
    console.log('\n📋 Migration des comptes OAuth...');
    const accounts = sqliteDb.prepare('SELECT * FROM Account').all();

    for (const account of accounts) {
      const accountData = convertDates(account, ['createdAt', 'updatedAt']);
      await prisma.account.upsert({
        where: {
          provider_providerAccountId: {
            provider: accountData.provider,
            providerAccountId: accountData.providerAccountId
          }
        },
        update: accountData,
        create: accountData
      });
    }
    console.log(`✅ ${accounts.length} comptes migrés`);

    // 3. Migrer les plans d'abonnement
    console.log('\n📋 Migration des plans d\'abonnement...');
    const plans = sqliteDb.prepare('SELECT * FROM SubscriptionPlan').all();

    for (const plan of plans) {
      await prisma.subscriptionPlan.upsert({
        where: { id: plan.id },
        update: plan,
        create: plan
      });
    }
    console.log(`✅ ${plans.length} plans migrés`);

    // 4. Migrer les abonnements
    console.log('\n📋 Migration des abonnements...');
    const subscriptions = sqliteDb.prepare('SELECT * FROM Subscription').all();

    for (const sub of subscriptions) {
      await prisma.subscription.upsert({
        where: { id: sub.id },
        update: sub,
        create: sub
      });
    }
    console.log(`✅ ${subscriptions.length} abonnements migrés`);

    // 5. Migrer les CVs
    console.log('\n📋 Migration des CVs...');
    const cvs = sqliteDb.prepare('SELECT * FROM CvFile').all();

    for (const cv of cvs) {
      await prisma.cvFile.upsert({
        where: {
          userId_filename: {
            userId: cv.userId,
            filename: cv.filename
          }
        },
        update: cv,
        create: cv
      });
    }
    console.log(`✅ ${cvs.length} CVs migrés`);

    // 6. Migrer les crédits
    console.log('\n📋 Migration des soldes de crédits...');
    const creditBalances = sqliteDb.prepare('SELECT * FROM CreditBalance').all();

    for (const balance of creditBalances) {
      await prisma.creditBalance.upsert({
        where: { id: balance.id },
        update: balance,
        create: balance
      });
    }
    console.log(`✅ ${creditBalances.length} soldes migrés`);

    // 7. Migrer les transactions de crédits
    console.log('\n📋 Migration des transactions de crédits...');
    const creditTransactions = sqliteDb.prepare('SELECT * FROM CreditTransaction').all();

    for (const transaction of creditTransactions) {
      await prisma.creditTransaction.upsert({
        where: { id: transaction.id },
        update: transaction,
        create: transaction
      });
    }
    console.log(`✅ ${creditTransactions.length} transactions migrées`);

    // 8. Migrer les packs de crédits
    console.log('\n📋 Migration des packs de crédits...');
    const creditPacks = sqliteDb.prepare('SELECT * FROM CreditPack').all();

    for (const pack of creditPacks) {
      await prisma.creditPack.upsert({
        where: { id: pack.id },
        update: pack,
        create: pack
      });
    }
    console.log(`✅ ${creditPacks.length} packs migrés`);

    // 9. Migrer les tâches en arrière-plan
    console.log('\n📋 Migration des tâches en arrière-plan...');
    const tasks = sqliteDb.prepare('SELECT * FROM BackgroundTask').all();

    for (const task of tasks) {
      await prisma.backgroundTask.upsert({
        where: { id: task.id },
        update: task,
        create: task
      });
    }
    console.log(`✅ ${tasks.length} tâches migrées`);

    // 10. Migrer la télémétrie
    console.log('\n📋 Migration des événements de télémétrie...');
    const telemetryEvents = sqliteDb.prepare('SELECT * FROM TelemetryEvent').all();

    for (const event of telemetryEvents) {
      await prisma.telemetryEvent.upsert({
        where: { id: event.id },
        update: event,
        create: event
      });
    }
    console.log(`✅ ${telemetryEvents.length} événements migrés`);

    // 11. Migrer feature usage
    console.log('\n📋 Migration des feature usage...');
    const featureUsage = sqliteDb.prepare('SELECT * FROM FeatureUsage').all();

    for (const usage of featureUsage) {
      await prisma.featureUsage.upsert({
        where: { id: usage.id },
        update: usage,
        create: usage
      });
    }
    console.log(`✅ ${featureUsage.length} feature usage migrés`);

    // 12. Migrer OpenAI usage
    console.log('\n📋 Migration des OpenAI usage...');
    const openAIUsage = sqliteDb.prepare('SELECT * FROM OpenAIUsage').all();

    for (const usage of openAIUsage) {
      await prisma.openAIUsage.upsert({
        where: { id: usage.id },
        update: usage,
        create: usage
      });
    }
    console.log(`✅ ${openAIUsage.length} OpenAI usage migrés`);

    // 13. Migrer FeatureUsageCounter
    console.log('\n📋 Migration des compteurs de features...');
    const featureCounters = sqliteDb.prepare('SELECT * FROM FeatureUsageCounter').all();

    for (const counter of featureCounters) {
      await prisma.featureUsageCounter.upsert({
        where: { id: counter.id },
        update: counter,
        create: counter
      });
    }
    console.log(`✅ ${featureCounters.length} compteurs migrés`);

    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 Migration terminée avec succès !');
    console.log('\n⚠️  N\'oubliez pas de :');
    console.log('1. Les CVs chiffrés sont déjà dans data/users/ ✅');
    console.log('2. Vérifier CV_ENCRYPTION_KEY est identique en production');
    console.log('3. Tester la connexion et l\'accès aux CVs');
    console.log('4. Exécuter: node scripts/verify-migration.js');

  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error);
    process.exit(1);
  } finally {
    sqliteDb.close();
    await prisma.$disconnect();
  }
}

migrate();
