/**
 * Utilitaires pour la gestion des utilisateurs dans le dashboard admin
 */

import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { assignDefaultPlan } from '@/lib/subscription/subscriptions';
import stripe from '@/lib/stripe';
import { getUserRootPath } from '@/lib/utils/paths';

/**
 * Supprime complètement un utilisateur (DB + fichiers)
 *
 * Grâce à l'activation des foreign keys SQLite et aux relations `onDelete: Cascade`
 * définies dans le schéma Prisma, la suppression de l'utilisateur supprimera
 * automatiquement toutes les données liées (cvFiles, accounts, feedbacks, etc.)
 *
 * @param {string} userId - ID de l'utilisateur à supprimer
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteUserCompletely(userId) {
  try {
    // 1. Récupérer les informations Stripe avant suppression
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      select: {
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    });

    // 2. Annuler l'abonnement et supprimer le customer Stripe
    if (subscription) {
      try {
        console.log(`[userManagement] Suppression des données Stripe pour user ${userId}`);

        // 2a. Annuler l'abonnement Stripe (sans remboursement)
        if (subscription.stripeSubscriptionId) {
          try {
            await stripe.subscriptions.cancel(subscription.stripeSubscriptionId, {
              prorate: false, // Pas de remboursement
            });
            console.log(`[userManagement] ✅ Abonnement Stripe ${subscription.stripeSubscriptionId} annulé`);
          } catch (stripeError) {
            console.warn(`[userManagement] ⚠️ Erreur annulation abonnement Stripe: ${stripeError.message}`);
            // Continuer même si l'annulation échoue
          }
        }

        // 2b. Supprimer le customer Stripe (supprime payment methods, adresses, etc.)
        if (subscription.stripeCustomerId) {
          try {
            await stripe.customers.del(subscription.stripeCustomerId);
            console.log(`[userManagement] ✅ Customer Stripe ${subscription.stripeCustomerId} supprimé (+ payment methods, adresses)`);
          } catch (stripeError) {
            console.warn(`[userManagement] ⚠️ Erreur suppression customer Stripe: ${stripeError.message}`);
            // Continuer même si la suppression échoue
          }
        }
      } catch (error) {
        console.error(`[userManagement] ❌ Erreur lors de la suppression Stripe: ${error.message}`);
        // Ne pas bloquer la suppression du compte si Stripe échoue
      }
    } else {
      console.log(`[userManagement] Aucune subscription Stripe trouvée pour user ${userId}`);
    }

    // 3. Supprimer le dossier utilisateur (CV_BASE_DIR/{userId})
    const userDir = getUserRootPath(userId);

    try {
      await fs.rm(userDir, { recursive: true, force: true });
      console.log(`[userManagement] Dossier utilisateur supprimé: ${userDir}`);
    } catch (fsError) {
      // Si le dossier n'existe pas, continuer quand même
      console.warn(`[userManagement] Dossier utilisateur introuvable ou déjà supprimé: ${userDir}`, fsError.message);
    }

    // 4. Supprimer l'utilisateur de la DB
    // Les foreign keys avec onDelete: Cascade supprimeront automatiquement :
    // - Accounts, CvFiles, BackgroundTasks, LinkHistory, Feedbacks
    // - ConsentLogs, TelemetryEvents, FeatureUsage, OpenAIUsage, OpenAICalls
    // - Subscriptions, CreditBalance, CreditTransactions, FeatureUsageCounters
    // - Referrals, EmailVerificationTokens, AutoSignInTokens, EmailChangeRequests
    console.log(`[userManagement] Suppression de l'utilisateur ${userId} (cascade automatique activé)`);

    await prisma.user.delete({ where: { id: userId } });

    console.log(`[userManagement] Utilisateur ${userId} supprimé avec succès (+ toutes données liées via cascade)`);

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
 * Crée un utilisateur manuellement avec un mot de passe personnalisé
 * @param {Object} params
 * @param {string} params.email - Email de l'utilisateur (unique)
 * @param {string} params.name - Nom de l'utilisateur
 * @param {string} params.password - Mot de passe de l'utilisateur
 * @param {string} params.role - Rôle (USER ou ADMIN)
 * @returns {Promise<{success: boolean, user?: object, error?: string}>}
 */
export async function createManualUser({ email, name, password, role = 'USER' }) {
  try {
    // Validation
    if (!email || typeof email !== 'string') {
      return { success: false, error: 'Email requis' };
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return { success: false, error: 'Nom requis' };
    }

    if (!password || typeof password !== 'string' || !password.trim()) {
      return { success: false, error: 'Mot de passe requis' };
    }

    if (password.trim().length < 8) {
      return { success: false, error: 'Le mot de passe doit contenir au moins 8 caractères' };
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

    // Hasher le mot de passe fourni
    const passwordHash = await bcrypt.hash(password.trim(), 12);

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name.trim(),
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

    // Attribuer le plan Gratuit par défaut
    try {
      const subscriptionResult = await assignDefaultPlan(user.id);
      if (subscriptionResult.success) {
        console.log(`[userManagement] Plan Gratuit attribué à user ${user.id}`);
      } else {
        console.warn('[userManagement] Échec attribution plan Gratuit:', subscriptionResult.error);
        // Ne pas bloquer la création de l'utilisateur
      }
    } catch (error) {
      console.error('[userManagement] Erreur attribution plan:', error);
      // Ne pas bloquer la création de l'utilisateur
    }

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
