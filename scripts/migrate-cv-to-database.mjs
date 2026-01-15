#!/usr/bin/env node
/**
 * Script de migration CV Filesystem → Database
 *
 * Migre le contenu des CV JSON depuis les fichiers chiffrés sur filesystem
 * vers la colonne CvFile.content dans PostgreSQL.
 *
 * Usage:
 *   node scripts/migrate-cv-to-database.mjs           # Migration complète
 *   node scripts/migrate-cv-to-database.mjs --dry-run # Preview sans modification
 *   node scripts/migrate-cv-to-database.mjs --user=<userId> # Migrer un seul user
 *
 * Les fichiers sont conservés comme backup permanent.
 */

import { config } from 'dotenv';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Charger les variables d'environnement
config({ path: resolve(__dirname, '../.env') });

// Parse arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const userArg = args.find((a) => a.startsWith('--user='));
const targetUserId = userArg ? userArg.split('=')[1] : null;

// Vérifier les prérequis
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL non configuré dans .env');
  process.exit(1);
}

if (!process.env.CV_ENCRYPTION_KEY) {
  console.error('❌ CV_ENCRYPTION_KEY non configuré dans .env (nécessaire pour déchiffrer)');
  process.exit(1);
}

// Configuration crypto (dupliqué de lib/cv/crypto.js pour éviter les imports ESM)
const KEY_BASE64 = process.env.CV_ENCRYPTION_KEY;
let encryptionKey;
try {
  encryptionKey = Buffer.from(KEY_BASE64, 'base64');
  if (encryptionKey.length !== 32) {
    throw new Error('Clé invalide');
  }
} catch {
  console.error('❌ CV_ENCRYPTION_KEY doit être une clé base64 de 32 octets');
  process.exit(1);
}

const PREFIX = Buffer.from('cv1');
const IV_LENGTH = 12;

function decryptString(base64Payload) {
  const buffer = Buffer.from(base64Payload, 'base64');
  if (buffer.length < PREFIX.length + IV_LENGTH + 16) {
    throw new Error('Payload chiffré invalide.');
  }
  const prefix = buffer.subarray(0, PREFIX.length);
  if (!prefix.equals(PREFIX)) {
    throw new Error('Version de payload chiffré incompatible.');
  }
  const iv = buffer.subarray(PREFIX.length, PREFIX.length + IV_LENGTH);
  const authTag = buffer.subarray(PREFIX.length + IV_LENGTH, PREFIX.length + IV_LENGTH + 16);
  const ciphertext = buffer.subarray(PREFIX.length + IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

// Résolution du chemin base CV
function resolveCvBaseDir() {
  const baseDir = process.env.CV_BASE_DIR || 'data/users';
  if (baseDir.startsWith('/') || baseDir.match(/^[A-Z]:\\/i)) {
    return baseDir;
  }
  return resolve(__dirname, '..', baseDir);
}

function getUserCvPath(userId) {
  return join(resolveCvBaseDir(), userId, 'cvs');
}

// Import Prisma dynamiquement après dotenv
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

// Stats
const stats = {
  total: 0,
  success: 0,
  skipped: 0,
  errors: [],
  alreadyMigrated: 0,
};

console.log('\n🔄 Migration CV Filesystem → Database\n');
console.log('─────────────────────────────────────────────');
console.log(`📊 Mode: ${dryRun ? 'DRY-RUN (preview)' : 'PRODUCTION'}`);
console.log(`📁 CV_BASE_DIR: ${resolveCvBaseDir()}`);
console.log(`🗄️  Database: ${process.env.DATABASE_URL.split('@')[1]?.split('/')[1] || 'unknown'}`);
if (targetUserId) {
  console.log(`👤 User cible: ${targetUserId}`);
}
console.log('─────────────────────────────────────────────\n');

async function migrateUserCvs(userId) {
  const cvDir = getUserCvPath(userId);

  // Vérifier si le dossier existe
  try {
    await fs.access(cvDir);
  } catch {
    // Pas de dossier CV pour cet utilisateur
    return { migrated: 0, skipped: 0, errors: [] };
  }

  // Lire les fichiers JSON
  const files = await fs.readdir(cvDir);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));

  const result = { migrated: 0, skipped: 0, errors: [] };

  for (const filename of jsonFiles) {
    stats.total++;

    // Vérifier si déjà migré
    const existing = await prisma.cvFile.findUnique({
      where: { userId_filename: { userId, filename } },
      select: { content: true },
    });

    if (existing?.content) {
      stats.alreadyMigrated++;
      result.skipped++;
      continue;
    }

    // Lire et déchiffrer le fichier
    const filePath = join(cvDir, filename);
    let content;

    try {
      const fileData = await fs.readFile(filePath, 'utf-8');

      // Essayer de déchiffrer, sinon utiliser le contenu brut (legacy non chiffré)
      try {
        content = decryptString(fileData);
      } catch {
        content = fileData;
      }

      // Valider que c'est du JSON
      const jsonContent = JSON.parse(content);

      if (!dryRun) {
        // Créer ou mettre à jour l'entrée dans la DB
        await prisma.cvFile.upsert({
          where: { userId_filename: { userId, filename } },
          update: {
            content: jsonContent,
            contentVersion: 1,
          },
          create: {
            userId,
            filename,
            content: jsonContent,
            contentVersion: 1,
          },
        });
      }

      stats.success++;
      result.migrated++;
      console.log(`  ✅ ${filename}`);
    } catch (error) {
      const errMsg = `${filename}: ${error.message}`;
      stats.errors.push({ userId, filename, error: error.message });
      result.errors.push(errMsg);
      console.log(`  ❌ ${errMsg}`);
    }
  }

  return result;
}

async function main() {
  try {
    let users;

    if (targetUserId) {
      // Migrer un seul utilisateur
      const user = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, email: true },
      });

      if (!user) {
        console.error(`❌ Utilisateur non trouvé: ${targetUserId}`);
        process.exit(1);
      }

      users = [user];
    } else {
      // Récupérer tous les utilisateurs qui ont des CvFile
      users = await prisma.user.findMany({
        where: {
          cvs: { some: {} },
        },
        select: { id: true, email: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    console.log(`👥 ${users.length} utilisateur(s) à traiter\n`);

    for (const user of users) {
      console.log(`\n📂 ${user.email || user.id}:`);
      await migrateUserCvs(user.id);
    }

    // Rapport final
    console.log('\n─────────────────────────────────────────────');
    console.log('📋 RAPPORT DE MIGRATION\n');
    console.log(`  Total fichiers traités: ${stats.total}`);
    console.log(`  ✅ Migrés avec succès: ${stats.success}`);
    console.log(`  ⏭️  Déjà migrés: ${stats.alreadyMigrated}`);
    console.log(`  ❌ Erreurs: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Fichiers en erreur:');
      stats.errors.forEach((e) => {
        console.log(`    - ${e.userId}/${e.filename}: ${e.error}`);
      });
    }

    if (dryRun) {
      console.log('\n⚠️  DRY-RUN: Aucune modification effectuée');
      console.log('   Relancez sans --dry-run pour appliquer la migration\n');
    } else {
      console.log('\n✅ Migration terminée!\n');
      console.log('📝 Les fichiers filesystem sont conservés comme backup.\n');
    }

    process.exit(stats.errors.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Erreur fatale:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
