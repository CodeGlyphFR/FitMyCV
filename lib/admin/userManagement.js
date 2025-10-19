/**
 * Utilitaires pour la gestion des utilisateurs dans le dashboard admin
 */

import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

const BASE_DIR = process.env.CV_BASE_DIR || 'data/users';

/**
 * Supprime complètement un utilisateur (DB + fichiers)
 * @param {string} userId - ID de l'utilisateur à supprimer
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteUserCompletely(userId) {
  try {
    // 1. Supprimer le dossier utilisateur dans /data/users/{userId}
    const userDir = path.join(process.cwd(), BASE_DIR, userId);

    try {
      await fs.rm(userDir, { recursive: true, force: true });
      console.log(`[userManagement] Dossier utilisateur supprimé: ${userDir}`);
    } catch (fsError) {
      // Si le dossier n'existe pas, continuer quand même
      console.warn(`[userManagement] Dossier utilisateur introuvable ou déjà supprimé: ${userDir}`, fsError.message);
    }

    // 2. Supprimer l'utilisateur en DB
    // Les relations (cvs, sessions, accounts, etc.) seront supprimées automatiquement
    // grâce aux onDelete: Cascade configurés dans le schema Prisma
    await prisma.user.delete({
      where: { id: userId },
    });

    console.log(`[userManagement] Utilisateur supprimé de la DB: ${userId}`);

    return { success: true };
  } catch (error) {
    console.error('[userManagement] Erreur lors de la suppression complète:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors de la suppression de l\'utilisateur'
    };
  }
}

/**
 * Crée un utilisateur manuellement avec un mot de passe aléatoire
 * @param {Object} params
 * @param {string} params.email - Email de l'utilisateur (unique)
 * @param {string} params.name - Nom de l'utilisateur (optionnel)
 * @param {string} params.role - Rôle (USER ou ADMIN)
 * @returns {Promise<{success: boolean, user?: object, error?: string}>}
 */
export async function createManualUser({ email, name, role = 'USER' }) {
  try {
    // Validation
    if (!email || typeof email !== 'string') {
      return { success: false, error: 'Email requis' };
    }

    if (!['USER', 'ADMIN'].includes(role)) {
      return { success: false, error: 'Rôle invalide (USER ou ADMIN attendu)' };
    }

    // Vérifier que l'email n'existe pas déjà
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return { success: false, error: 'Cet email est déjà utilisé' };
    }

    // Générer un mot de passe aléatoire sécurisé (32 caractères)
    const randomPassword = crypto.randomBytes(16).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 12);

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name?.trim() || null,
        role,
        passwordHash,
        emailVerified: new Date(), // Email vérifié par défaut (ajout manuel par admin)
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    console.log(`[userManagement] Utilisateur créé manuellement: ${user.email} (${user.id})`);

    return { success: true, user };
  } catch (error) {
    console.error('[userManagement] Erreur lors de la création manuelle:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors de la création de l\'utilisateur'
    };
  }
}

/**
 * Valide manuellement l'email d'un utilisateur et supprime les tokens en attente
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function validateUserEmailManually(userId) {
  try {
    // Marquer l'email comme vérifié
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: new Date() },
    });

    // Supprimer tous les tokens de vérification en attente pour cet utilisateur
    await prisma.emailVerificationToken.deleteMany({
      where: { userId },
    });

    console.log(`[userManagement] Email validé manuellement pour: ${userId}`);

    return { success: true };
  } catch (error) {
    console.error('[userManagement] Erreur lors de la validation manuelle:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors de la validation de l\'email'
    };
  }
}
