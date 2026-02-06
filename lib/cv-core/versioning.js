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
    select: {
      id: true,
      content: true,
      contentVersion: true,
      // Scores à copier dans la version
      matchScore: true,
      scoreBreakdown: true,
      improvementSuggestions: true,
      missingSkills: true,
      matchingSkills: true,
    },
  });

  if (!cvFile || !cvFile.content) {
    throw new Error(`CV not found or has no content: ${filename}`);
  }

  const newVersion = cvFile.contentVersion + 1;
  const maxVersions = await getNumericSettingValue('cv_max_versions', 5);

  await prisma.$transaction(async (tx) => {
    // 1. Créer la version (sauvegarde du contenu ET scores AVANT modification)
    await tx.cvVersion.create({
      data: {
        cvFileId: cvFile.id,
        version: cvFile.contentVersion, // Version actuelle (avant modif)
        content: cvFile.content,
        changelog,
        // Copier les scores actuels dans la version
        matchScore: cvFile.matchScore,
        scoreBreakdown: cvFile.scoreBreakdown,
        improvementSuggestions: cvFile.improvementSuggestions,
        missingSkills: cvFile.missingSkills,
        matchingSkills: cvFile.matchingSkills,
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

/**
 * Créer une version avec tracking du type de modification
 * Version enrichie de createCvVersion avec changeType et sourceFile
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} filename - Nom du fichier CV
 * @param {string} changelog - Description de la modification
 * @param {string} changeType - Type: 'optimization' | 'adaptation' | 'restore'
 * @param {string} sourceFile - Pour adaptation: nom du CV source (optionnel)
 * @returns {Promise<number>} Le nouveau numéro de version
 */
export async function createCvVersionWithTracking(userId, filename, changelog, changeType, sourceFile = null) {
  const cvFile = await prisma.cvFile.findUnique({
    where: { userId_filename: { userId, filename } },
    select: {
      id: true,
      content: true,
      contentVersion: true,
      // Scores à copier dans la version
      matchScore: true,
      scoreBreakdown: true,
      improvementSuggestions: true,
      missingSkills: true,
      matchingSkills: true,
    },
  });

  if (!cvFile || !cvFile.content) {
    throw new Error(`CV not found or has no content: ${filename}`);
  }

  const newVersion = cvFile.contentVersion + 1;
  const maxVersions = await getNumericSettingValue('cv_max_versions', 5);

  await prisma.$transaction(async (tx) => {
    // 1. Créer la version avec métadonnées enrichies ET scores
    await tx.cvVersion.create({
      data: {
        cvFileId: cvFile.id,
        version: cvFile.contentVersion,
        content: cvFile.content,
        changelog,
        changeType,
        sourceFile,
        // Copier les scores actuels dans la version
        matchScore: cvFile.matchScore,
        scoreBreakdown: cvFile.scoreBreakdown,
        improvementSuggestions: cvFile.improvementSuggestions,
        missingSkills: cvFile.missingSkills,
        matchingSkills: cvFile.matchingSkills,
      },
    });

    // 2. Incrémenter le numéro de version
    await tx.cvFile.update({
      where: { id: cvFile.id },
      data: { contentVersion: newVersion },
    });

    // 3. Rotation des anciennes versions
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
 * Restauration destructive: remplace la version actuelle par une version antérieure
 * Supprime la version actuelle sans créer de sauvegarde
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} filename - Nom du fichier CV
 * @param {number} targetVersion - Numéro de version à restaurer
 * @returns {Promise<Object>} Le contenu restauré
 */
export async function restoreCvVersionDestructive(userId, filename, targetVersion) {
  const cvFile = await prisma.cvFile.findUnique({
    where: { userId_filename: { userId, filename } },
    include: {
      versions: {
        where: { version: targetVersion },
        select: {
          content: true,
          // Récupérer les scores de la version à restaurer
          matchScore: true,
          scoreBreakdown: true,
          improvementSuggestions: true,
          missingSkills: true,
          matchingSkills: true,
        },
      },
    },
  });

  if (!cvFile) {
    throw new Error(`CV not found: ${filename}`);
  }

  const targetVersionRecord = cvFile.versions?.[0];
  if (!targetVersionRecord) {
    throw new Error(`Version ${targetVersion} not found for CV: ${filename}`);
  }

  const restoredContent = targetVersionRecord.content;

  await prisma.$transaction(async (tx) => {
    // 1. Remplacer le contenu actuel par la version restaurée ET restaurer les scores
    await tx.cvFile.update({
      where: { id: cvFile.id },
      data: {
        content: restoredContent,
        contentVersion: targetVersion,
        // Effacer les changements pending (ils ne sont plus valides)
        pendingChanges: [],
        pendingSourceVersion: null,
        // Restaurer les scores depuis la version (au lieu de les effacer)
        scoreBefore: null, // Pas de scoreBefore après restauration
        matchScore: targetVersionRecord.matchScore,
        matchScoreUpdatedAt: targetVersionRecord.matchScore ? new Date() : null,
        scoreBreakdown: targetVersionRecord.scoreBreakdown,
        improvementSuggestions: targetVersionRecord.improvementSuggestions,
        missingSkills: targetVersionRecord.missingSkills,
        matchingSkills: targetVersionRecord.matchingSkills,
      },
    });

    // 2. Supprimer la version restaurée de l'historique (elle est maintenant "current")
    await tx.cvVersion.delete({
      where: {
        cvFileId_version: {
          cvFileId: cvFile.id,
          version: targetVersion,
        },
      },
    });

    // 3. Supprimer toutes les versions plus récentes que la version restaurée
    await tx.cvVersion.deleteMany({
      where: {
        cvFileId: cvFile.id,
        version: { gt: targetVersion },
      },
    });
  });

  return restoredContent;
}

/**
 * Récupérer les versions avec métadonnées enrichies
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} filename - Nom du fichier CV
 * @param {boolean} includeContent - Inclure le contenu des versions
 * @returns {Promise<Array>} Liste des versions
 */
export async function getCvVersionsWithDetails(userId, filename, includeContent = false) {
  const cvFile = await prisma.cvFile.findUnique({
    where: { userId_filename: { userId, filename } },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        select: {
          id: true,
          version: true,
          changelog: true,
          changeType: true,
          sourceFile: true,
          createdAt: true,
          matchScore: true, // Inclure le score pour affichage dans VersionSelector
          ...(includeContent && { content: true }),
        },
      },
    },
  });

  return cvFile?.versions || [];
}
