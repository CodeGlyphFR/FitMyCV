import prisma from "@/lib/prisma";

/**
 * Enregistre ou met à jour la source d'un CV dans la base de données
 * @param {string} userId - ID de l'utilisateur
 * @param {string} filename - Nom du fichier CV
 * @param {string|null} sourceType - Type de source: 'link', 'pdf', ou null pour manuel
 * @param {string|null} sourceValue - Valeur de la source: URL ou nom de fichier PDF
 */
export async function setCvSource(userId, filename, sourceType, sourceValue) {
  if (!userId || !filename) {
    throw new Error("userId et filename sont requis");
  }

  try {
    await prisma.cvFile.upsert({
      where: {
        userId_filename: {
          userId,
          filename,
        },
      },
      update: {
        sourceType,
        sourceValue,
      },
      create: {
        userId,
        filename,
        sourceType,
        sourceValue,
      },
    });
  } catch (error) {
    console.error(`Erreur lors de l'enregistrement de la source pour ${filename}:`, error);
    throw error;
  }
}

/**
 * Récupère la source d'un CV
 * @param {string} userId - ID de l'utilisateur
 * @param {string} filename - Nom du fichier CV
 * @returns {Promise<{sourceType: string|null, sourceValue: string|null}>}
 */
export async function getCvSource(userId, filename) {
  if (!userId || !filename) {
    return { sourceType: null, sourceValue: null };
  }

  try {
    const cvFile = await prisma.cvFile.findUnique({
      where: {
        userId_filename: {
          userId,
          filename,
        },
      },
      select: {
        sourceType: true,
        sourceValue: true,
      },
    });

    return cvFile || { sourceType: null, sourceValue: null };
  } catch (error) {
    console.error(`Erreur lors de la récupération de la source pour ${filename}:`, error);
    return { sourceType: null, sourceValue: null };
  }
}
