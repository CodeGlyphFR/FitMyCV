#!/usr/bin/env node

/**
 * Script de migration SQLite → PostgreSQL simplifié
 * Migre uniquement les tables principales avec gestion automatique des types
 */

const { PrismaClient } = require('@prisma/client');
const Database = require('better-sqlite3');
const path = require('path');

const prisma = new PrismaClient();
const sqliteDb = new Database(path.join(__dirname, '../prisma/dev.db'), { readonly: true });

// Convertir les timestamps et booleans SQLite vers PostgreSQL
const convertRow = (row, tableName = '') => {
  const converted = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      converted[key] = value;
    } else if (key === 'createdAt' && tableName === 'BackgroundTask') {
      // BackgroundTask.createdAt est BigInt
      converted[key] = BigInt(value);
    } else if (key.includes('At') || key.includes('Date') || key.includes('Verified') || key === 'expires' || key === 'timestamp' || key === 'date' || key.includes('Period')) {
      // Champs de date/datetime
      converted[key] = new Date(value);
    } else if (typeof value === 'number' && (value === 0 || value === 1)) {
      // Potentiellement un boolean
      const boolFields = ['hasCompletedOnboarding', 'isTranslated', 'blocked', 'createdWithCredit',
                         'creditUsed', 'shouldUpdateCvList', 'cancelAtPeriodEnd', 'refunded',
                         'processed', 'isActive', 'isPopular', 'isFree', 'isEnabled'];
      if (boolFields.includes(key)) {
        converted[key] = Boolean(value);
      } else {
        converted[key] = value;
      }
    } else {
      converted[key] = value;
    }
  }
  // Supprimer les champs obsolètes
  delete converted.onboardingProgress;
  delete converted.hasCompletedOnboarding;
  delete converted.onboardingCompletedAt;
  delete converted.viewedTooltips;

  return converted;
};

async function migrate() {
  console.log('🚀 Migration SQLite → PostgreSQL (Simplified)\n');
  console.log('='.repeat(60));

  try {
    const tables = [
      { name: 'User', unique: 'id' },
      { name: 'Account', unique: { provider_providerAccountId: (r) => ({ provider: r.provider, providerAccountId: r.providerAccountId }) } },
      { name: 'SubscriptionPlan', unique: 'id' },
      { name: 'Subscription', unique: 'id' },
      { name: 'CreditPack', unique: 'id' },
      { name: 'CreditBalance', unique: 'id' },
      { name: 'CreditTransaction', unique: 'id' },
      { name: 'CvFile', unique: { userId_filename: (r) => ({ userId: r.userId, filename: r.filename }) } },
      { name: 'BackgroundTask', unique: 'id' },
      { name: 'TelemetryEvent', unique: 'id' },
      { name: 'FeatureUsage', unique: 'id' },
      { name: 'OpenAIUsage', unique: 'id' },
      { name: 'FeatureUsageCounter', unique: 'id' },
      { name: 'Referral', unique: 'id' },
      { name: 'SubscriptionPlanFeatureLimit', unique: 'id' },
    ];

    for (const table of tables) {
      try {
        console.log(`\n📋 Migration ${table.name}...`);
        const rows = sqliteDb.prepare(`SELECT * FROM ${table.name}`).all();

        if (rows.length === 0) {
          console.log(`⚠️  Aucune donnée dans ${table.name}`);
          continue;
        }

        const modelName = table.name.charAt(0).toLowerCase() + table.name.slice(1);

        for (const row of rows) {
          const data = convertRow(row, table.name);

          const whereClause = typeof table.unique === 'string'
            ? { [table.unique]: data[table.unique] }
            : Object.fromEntries(
                Object.entries(table.unique).map(([key, fn]) => [key, fn(data)])
              );

          await prisma[modelName].upsert({
            where: whereClause,
            update: data,
            create: data
          });
        }

        console.log(`✅ ${rows.length} enregistrements migrés`);
      } catch (error) {
        console.log(`⚠️  Table ${table.name} ignorée (${error.message})`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 Migration terminée !');
    console.log('\nℹ️  Informations :');
    console.log('• Les CVs chiffrés sont dans data/users/ ✅');
    console.log('• CV_ENCRYPTION_KEY doit être identique');
    console.log('\nProchaine étape : node scripts/verify-migration.js');

  } catch (error) {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  } finally {
    sqliteDb.close();
    await prisma.$disconnect();
  }
}

migrate();
