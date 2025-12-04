#!/usr/bin/env node
/**
 * Script de synchronisation Stripe
 * Synchronise les plans d'abonnement et packs de crédits avec Stripe
 *
 * Usage: node scripts/sync-stripe.mjs
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Charger les variables d'environnement depuis .env
config({ path: resolve(__dirname, '../.env') });

// Vérifier les prérequis
if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_TODO') {
  console.error('❌ STRIPE_SECRET_KEY non configuré dans .env');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL non configuré dans .env');
  process.exit(1);
}

console.log('🔄 Synchronisation Stripe en cours...\n');
console.log(`📊 Database: ${process.env.DATABASE_URL.split('@')[1]?.split('/')[1] || 'unknown'}`);
console.log(`🔑 Stripe: ${process.env.STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'Mode TEST' : 'Mode LIVE'}\n`);

// Import dynamique pour que dotenv soit chargé avant
const { syncStripeProductsInternal } = await import('../lib/subscription/stripeSync.js');

try {
  const result = await syncStripeProductsInternal();

  console.log('\n✅ Synchronisation terminée!\n');
  console.log('📋 Résultats:');
  console.log('─────────────────────────────────');
  console.log(`Plans d'abonnement:`);
  console.log(`  • Créés: ${result.results.plans.created}`);
  console.log(`  • Mis à jour: ${result.results.plans.updated}`);
  console.log(`  • Ignorés: ${result.results.plans.skipped}`);
  if (result.results.plans.errors.length > 0) {
    console.log(`  • Erreurs: ${result.results.plans.errors.length}`);
    result.results.plans.errors.forEach((e) => console.log(`    - ${e.planName}: ${e.error}`));
  }

  console.log(`\nPacks de crédits:`);
  console.log(`  • Créés: ${result.results.packs.created}`);
  console.log(`  • Mis à jour: ${result.results.packs.updated}`);
  console.log(`  • Ignorés: ${result.results.packs.skipped}`);
  if (result.results.packs.errors.length > 0) {
    console.log(`  • Erreurs: ${result.results.packs.errors.length}`);
    result.results.packs.errors.forEach((e) => console.log(`    - ${e.packName}: ${e.error}`));
  }
  console.log('─────────────────────────────────\n');

} catch (error) {
  console.error('\n❌ Erreur lors de la synchronisation:', error.message);
  process.exit(1);
}
