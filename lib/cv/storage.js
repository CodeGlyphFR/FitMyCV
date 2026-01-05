/**
 * CV Storage Layer - Database Implementation
 *
 * Ce module gère le stockage des CV dans PostgreSQL.
 * Les fonctions conservent leur signature d'origine pour compatibilité
 * avec le reste du codebase.
 *
 * Migration depuis filesystem: Les fichiers sont conservés comme backup
 * mais toutes les opérations passent maintenant par la base de données.
 */

import prisma from '@/lib/prisma';
import { removeNullBytes } from '@/lib/utils/textSanitization';

/**
 * Assure que le "répertoire" CV d'un utilisateur existe.
 * No-op dans l'implémentation DB - conservé pour compatibilité API.
 *
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<string>} Chemin virtuel vers le répertoire
 */
export async function ensureUserCvDir(userId) {
  // No-op - la DB gère automatiquement les entrées
  return `db://users/${userId}/cvs`;
}

/**
 * Liste tous les fichiers CV d'un utilisateur
 *
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<string[]>} Liste des noms de fichiers (.json)
 */
export async function listUserCvFiles(userId) {
  const files = await prisma.cvFile.findMany({
    where: { userId },
    select: { filename: true },
    orderBy: { createdAt: 'desc' },
  });
  return files.map((f) => f.filename);
}

/**
 * Lit le contenu d'un fichier CV
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} filename - Nom du fichier CV
 * @returns {Promise<string>} Contenu JSON du CV (stringifié)
 * @throws {Error} Si le fichier n'existe pas
 */
export async function readUserCvFile(userId, filename) {
  const cvFile = await prisma.cvFile.findUnique({
    where: { userId_filename: { userId, filename } },
    select: { content: true },
  });

  if (!cvFile?.content) {
    throw new Error(`CV file not found: ${filename}`);
  }

  // Retourner en string pour compatibilité avec le code existant
  return JSON.stringify(cvFile.content);
}

/**
 * Lit un fichier CV avec ses métadonnées depuis la DB
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} filename - Nom du fichier CV
 * @returns {Promise<{content: Object, language: string|null, createdAt: Date, updatedAt: Date}>}
 * @throws {Error} Si le fichier n'existe pas
 */
export async function readUserCvFileWithMeta(userId, filename) {
  const cvFile = await prisma.cvFile.findUnique({
    where: { userId_filename: { userId, filename } },
    select: {
      content: true,
      language: true,
      contentVersion: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!cvFile?.content) {
    throw new Error(`CV file not found: ${filename}`);
  }

  return {
    content: cvFile.content,
    language: cvFile.language,
    contentVersion: cvFile.contentVersion,
    createdAt: cvFile.createdAt,
    updatedAt: cvFile.updatedAt,
  };
}

/**
 * Écrit le contenu d'un fichier CV (sans versioning)
 *
 * Cette fonction écrase directement le contenu, sans créer de version.
 * Pour créer une version (optimisation IA), utiliser createCvVersion()
 * depuis lib/cv/versioning.js AVANT d'appeler cette fonction.
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} filename - Nom du fichier CV
 * @param {string|Object} content - Contenu JSON du CV
 * @returns {Promise<string>} Chemin virtuel vers le fichier
 */
export async function writeUserCvFile(userId, filename, content) {
  const rawData = typeof content === 'string' ? JSON.parse(content) : content;
  // Sanitize null bytes - PostgreSQL doesn't support \u0000 in text/json columns
  const cvData = removeNullBytes(rawData);

  await prisma.cvFile.upsert({
    where: { userId_filename: { userId, filename } },
    update: {
      content: cvData,
      updatedAt: new Date(),
    },
    create: {
      userId,
      filename,
      content: cvData,
      contentVersion: 1,
    },
  });

  return `db://users/${userId}/cvs/${filename}`;
}

/**
 * Détecte les nouveaux fichiers créés depuis une liste de référence
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string[]} before - Liste des fichiers avant l'opération
 * @returns {Promise<string[]>} Liste des nouveaux fichiers
 */
export async function detectNewFiles(userId, before) {
  const after = await listUserCvFiles(userId);
  const beforeSet = new Set(before);
  return after.filter((name) => !beforeSet.has(name));
}

/**
 * Vérifie si un fichier CV existe
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} filename - Nom du fichier CV
 * @returns {Promise<boolean>} true si le fichier existe
 */
export async function cvFileExists(userId, filename) {
  const cvFile = await prisma.cvFile.findUnique({
    where: { userId_filename: { userId, filename } },
    select: { id: true },
  });
  return !!cvFile;
}

/**
 * Supprime un fichier CV
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} filename - Nom du fichier CV
 * @returns {Promise<boolean>} true si supprimé, false si n'existait pas
 */
export async function deleteUserCvFile(userId, filename) {
  try {
    await prisma.cvFile.delete({
      where: { userId_filename: { userId, filename } },
    });
    return true;
  } catch (error) {
    // P2025 = Record not found
    if (error.code === 'P2025') {
      return false;
    }
    throw error;
  }
}
