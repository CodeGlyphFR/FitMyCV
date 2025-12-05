/**
 * Gestion du versioning des CV pour l'optimisation IA
 *
 * Ce module gère l'historique des versions de CV, créées uniquement lors des
 * optimisations IA. Les éditions manuelles écrasent directement le contenu
 * sans créer de version.
 */

import prisma from '@/lib/prisma';
import { getNumericSettingValue } from '@/lib/settings/settingsUtils';

/**
 * Créer une version AVANT une optimisation IA
 * Sauvegarde le contenu actuel dans CvVersion avant modification
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} filename - Nom du fichier CV
 * @param {string} changelog - Description de la modification (défaut: 'Optimisation IA')
 * @returns {Promise<number>} Le nouveau numéro de version
 */
export async function createCvVersion(userId, filename, changelog = 'Optimisation IA') {
  const cvFile = await prisma.cvFile.findUnique({
    where: { userId_filename: { userId, filename } },
    select: { id: true, content: true, contentVersion: true },
  });

  if (!cvFile || !cvFile.content) {
    throw new Error(`CV not found or has no content: ${filename}`);
  }

  const newVersion = cvFile.contentVersion + 1;
  const maxVersions = await getNumericSettingValue('cv_max_versions', 5);

  await prisma.$transaction(async (tx) => {
    // 1. Créer la version (sauvegarde du contenu AVANT modification)
    await tx.cvVersion.create({
      data: {
        cvFileId: cvFile.id,
        version: cvFile.contentVersion, // Version actuelle (avant modif)
        content: cvFile.content,
        changelog,
      },
    });

    // 2. Incrémenter le numéro de version dans CvFile
    await tx.cvFile.update({
      where: { id: cvFile.id },
      data: { contentVersion: newVersion },
    });

    // 3. Rotation: supprimer les versions au-delà du max
    if (newVersion > maxVersions) {
      await tx.cvVersion.deleteMany({
        where: {
          cvFileId: cvFile.id,
          version: { lte: newVersion - maxVersions },
        },
      });
    }
  });

  return newVersion;
}

/**
 * Récupérer les versions d'un CV
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} filename - Nom du fichier CV
 * @returns {Promise<Array>} Liste des versions (triées par version décroissante)
 */
export async function getCvVersions(userId, filename) {
  const cvFile = await prisma.cvFile.findUnique({
    where: { userId_filename: { userId, filename } },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        select: {
          id: true,
          version: true,
          changelog: true,
          createdAt: true,
        },
      },
    },
  });

  return cvFile?.versions || [];
}

/**
 * Récupérer le contenu d'une version spécifique
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} filename - Nom du fichier CV
 * @param {number} targetVersion - Numéro de version à récupérer
 * @returns {Promise<Object|null>} Le contenu de la version ou null
 */
export async function getCvVersionContent(userId, filename, targetVersion) {
  const cvFile = await prisma.cvFile.findUnique({
    where: { userId_filename: { userId, filename } },
    include: {
      versions: {
        where: { version: targetVersion },
        select: { content: true },
      },
    },
  });

  return cvFile?.versions?.[0]?.content || null;
}

/**
 * Restaurer une version antérieure
 * Crée une nouvelle version avec le contenu actuel avant de restaurer
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} filename - Nom du fichier CV
 * @param {number} targetVersion - Numéro de version à restaurer
 * @returns {Promise<Object>} Le contenu restauré
 */
export async function restoreCvVersion(userId, filename, targetVersion) {
  const cvFile = await prisma.cvFile.findUnique({
    where: { userId_filename: { userId, filename } },
    include: {
      versions: {
        where: { version: targetVersion },
      },
    },
  });

  if (!cvFile?.versions?.[0]) {
    throw new Error(`Version ${targetVersion} not found for CV: ${filename}`);
  }

  const restoredContent = cvFile.versions[0].content;

  // Créer une version du contenu actuel avant restauration
  if (cvFile.content) {
    await createCvVersion(userId, filename, `Restauration depuis v${targetVersion}`);
  }

  // Écraser avec le contenu restauré
  await prisma.cvFile.update({
    where: { userId_filename: { userId, filename } },
    data: { content: restoredContent },
  });

  return restoredContent;
}

/**
 * Obtenir le nombre de versions d'un CV
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} filename - Nom du fichier CV
 * @returns {Promise<number>} Nombre de versions
 */
export async function getCvVersionCount(userId, filename) {
  const cvFile = await prisma.cvFile.findUnique({
    where: { userId_filename: { userId, filename } },
    select: { id: true },
  });

  if (!cvFile) return 0;

  return prisma.cvVersion.count({
    where: { cvFileId: cvFile.id },
  });
}
