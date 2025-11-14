import fs from "fs/promises";
import path from "path";
import prisma from "@/lib/prisma";
import { getUserRootPath } from "@/lib/utils/paths";

/**
 * Supprime un utilisateur de la base de données et son dossier de données
 * @param {string} userId - ID de l'utilisateur à supprimer
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteUser(userId) {
  if (!userId) {
    return { success: false, error: "userId manquant" };
  }

  try {
    // 1. Supprimer les données utilisateur dans la DB
    console.log(`[deleteUser] Suppression de l'utilisateur ${userId} de la DB...`);

    // Supprimer dans l'ordre pour respecter les contraintes FK
    await prisma.cvSource.deleteMany({ where: { userId } });
    await prisma.cvFile.deleteMany({ where: { userId } });
    await prisma.backgroundTask.deleteMany({ where: { userId } });
    await prisma.account.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });

    console.log(`[deleteUser] Utilisateur ${userId} supprimé de la DB`);

    // 2. Supprimer le dossier utilisateur
    const userDir = getUserRootPath(userId);

    try {
      await fs.access(userDir);
      await fs.rm(userDir, { recursive: true, force: true });
      console.log(`[deleteUser] Dossier utilisateur ${userDir} supprimé`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`[deleteUser] Dossier utilisateur ${userDir} n'existe pas`);
      } else {
        console.error(`[deleteUser] Erreur lors de la suppression du dossier:`, error);
        return { success: false, error: `Utilisateur supprimé de la DB mais erreur lors de la suppression du dossier: ${error.message}` };
      }
    }

    return { success: true };
  } catch (error) {
    console.error(`[deleteUser] Erreur lors de la suppression de l'utilisateur ${userId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Supprime le dossier utilisateur uniquement (pas la DB)
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteUserFolder(userId) {
  if (!userId) {
    return { success: false, error: "userId manquant" };
  }

  try {
    const userDir = getUserRootPath(userId);

    await fs.access(userDir);
    await fs.rm(userDir, { recursive: true, force: true });
    console.log(`[deleteUserFolder] Dossier ${userDir} supprimé`);

    return { success: true };
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`[deleteUserFolder] Dossier utilisateur n'existe pas`);
      return { success: true };
    }
    console.error(`[deleteUserFolder] Erreur:`, error);
    return { success: false, error: error.message };
  }
}
