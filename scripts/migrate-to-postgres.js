#!/usr/bin/env node

/**
 * Script de migration SQLite → PostgreSQL
 *
 * Usage:
 *   1. Configurer DATABASE_URL avec PostgreSQL dans .env
 *   2. Exécuter: node scripts/migrate-to-postgres.js
 */

const { PrismaClient: PrismaClientSQLite } = require('@prisma/client');
const { PrismaClient: PrismaClientPostgres } = require('@prisma/client');

// Client SQLite (source)
const sqlite = new PrismaClientSQLite({
  datasources: {
    db: {
      url: 'file:./dev.db'
    }
  }
});

// Client PostgreSQL (destination)
const postgres = new PrismaClientPostgres();

async function migrate() {
  console.log('🚀 Début de la migration SQLite → PostgreSQL\n');

  try {
    // 1. Migrer les utilisateurs
    console.log('📋 Migration des utilisateurs...');
    const users = await sqlite.user.findMany({
      include: {
        accounts: true,
        sessions: true,
        UserPlan: true,
        CreditPurchases: true,
        TelemetrySession: true
      }
    });

    for (const user of users) {
      const { accounts, sessions, UserPlan, CreditPurchases, TelemetrySession, ...userData } = user;

      await postgres.user.upsert({
        where: { id: user.id },
        update: userData,
        create: userData
      });

      // Migrer les comptes OAuth
      for (const account of accounts) {
        await postgres.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId
            }
          },
          update: account,
          create: account
        });
      }

      // Migrer les sessions
      for (const session of sessions) {
        await postgres.session.upsert({
          where: { sessionToken: session.sessionToken },
          update: session,
          create: session
        });
      }

      // Migrer les plans utilisateur
      for (const plan of UserPlan) {
        await postgres.userPlan.upsert({
          where: { id: plan.id },
          update: plan,
          create: plan
        });
      }

      // Migrer les achats de crédits
      for (const purchase of CreditPurchases) {
        await postgres.creditPurchase.upsert({
          where: { id: purchase.id },
          update: purchase,
          create: purchase
        });
      }

      // Migrer les sessions de télémétrie
      for (const telemetry of TelemetrySession) {
        await postgres.telemetrySession.upsert({
          where: { id: telemetry.id },
          update: telemetry,
          create: telemetry
        });
      }
    }
    console.log(`✅ ${users.length} utilisateurs migrés\n`);

    // 2. Migrer les plans d'abonnement
    console.log('📋 Migration des plans d\'abonnement...');
    const plans = await sqlite.subscriptionPlan.findMany();
    for (const plan of plans) {
      await postgres.subscriptionPlan.upsert({
        where: { id: plan.id },
        update: plan,
        create: plan
      });
    }
    console.log(`✅ ${plans.length} plans migrés\n`);

    // 3. Migrer les packs de crédits
    console.log('📋 Migration des packs de crédits...');
    const creditPacks = await sqlite.creditPack.findMany();
    for (const pack of creditPacks) {
      await postgres.creditPack.upsert({
        where: { id: pack.id },
        update: pack,
        create: pack
      });
    }
    console.log(`✅ ${creditPacks.length} packs de crédits migrés\n`);

    // 4. Migrer les tâches de génération de CV
    console.log('📋 Migration des tâches de génération...');
    const cvTasks = await sqlite.cvGenerationTask.findMany();
    for (const task of cvTasks) {
      await postgres.cvGenerationTask.upsert({
        where: { id: task.id },
        update: task,
        create: task
      });
    }
    console.log(`✅ ${cvTasks.length} tâches migrées\n`);

    // 5. Migrer les événements de télémétrie
    console.log('📋 Migration des événements de télémétrie...');
    const telemetryEvents = await sqlite.telemetryEvent.findMany();
    for (const event of telemetryEvents) {
      await postgres.telemetryEvent.upsert({
        where: { id: event.id },
        update: event,
        create: event
      });
    }
    console.log(`✅ ${telemetryEvents.length} événements de télémétrie migrés\n`);

    console.log('🎉 Migration terminée avec succès !');
    console.log('\n⚠️  N\'oubliez pas de :');
    console.log('1. Copier le dossier prisma/cv_data/ vers la production');
    console.log('2. Vérifier CV_ENCRYPTION_KEY est identique en production');
    console.log('3. Tester la connexion et l\'accès aux CV');

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  } finally {
    await sqlite.$disconnect();
    await postgres.$disconnect();
  }
}

migrate();
