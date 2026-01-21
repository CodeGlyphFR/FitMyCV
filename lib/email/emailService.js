/**
 * Service d'envoi d'emails avec SMTP OVH (primary) et Resend (fallback)
 */

import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { getNumericSettingValue } from '@/lib/settings/settingsUtils';
import { createEmailSender, SITE_URL } from './emailSenderFactory';
import {
  getVerificationEmailTemplate,
  getPasswordResetEmailTemplate,
  getEmailChangeTemplate,
  getWelcomeEmailTemplate,
  getPurchaseCreditsEmailTemplate,
} from './templates/fallbackTemplates';

// ============================================================================
// TOKEN MANAGEMENT UTILITIES
// ============================================================================

/**
 * Génère un token de vérification sécurisé
 */
function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Crée un token de vérification dans la base de données
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<string>} - Token généré
 */
export async function createVerificationToken(userId) {
  await prisma.emailVerificationToken.deleteMany({
    where: { userId },
  });

  const token = generateVerificationToken();
  const expires = new Date();
  expires.setHours(expires.getHours() + 24);

  await prisma.emailVerificationToken.create({
    data: { userId, token, expires },
  });

  return token;
}

/**
 * Vérifie un token de vérification
 * @param {string} token - Token à vérifier
 * @returns {Promise<{valid: boolean, userId?: string, error?: string}>}
 */
export async function verifyToken(token) {
  if (!token) {
    return { valid: false, error: 'Token manquant' };
  }

  const record = await prisma.emailVerificationToken.findUnique({
    where: { token },
  });

  if (!record) {
    return { valid: false, error: 'Token invalide' };
  }

  if (record.expires < new Date()) {
    await prisma.emailVerificationToken.delete({
      where: { token },
    });
    return { valid: false, error: 'Token expiré' };
  }

  return { valid: true, userId: record.userId };
}

/**
 * Supprime un token de vérification après utilisation
 */
export async function deleteVerificationToken(token) {
  await prisma.emailVerificationToken.deleteMany({
    where: { token },
  });
}

// ============================================================================
// EMAIL VERIFICATION STATUS
// ============================================================================

/**
 * Vérifie si un utilisateur a un email vérifié
 */
export async function isEmailVerified(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  });
  return !!user?.emailVerified;
}

/**
 * Marque l'email d'un utilisateur comme vérifié
 */
export async function markEmailAsVerified(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: new Date() },
  });
}

// ============================================================================
// PASSWORD RESET TOKEN MANAGEMENT
// ============================================================================

/**
 * Crée un token de réinitialisation de mot de passe
 */
export async function createPasswordResetToken(email) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { accounts: true },
  });

  if (!user) {
    return { success: true };
  }

  if (!user.passwordHash) {
    return {
      success: false,
      error: 'oauth_only',
      message: 'Cet email est associé à un compte OAuth. Veuillez vous connecter avec votre fournisseur (Google, GitHub, Apple).'
    };
  }

  const token = generateVerificationToken();
  const expires = new Date();
  expires.setHours(expires.getHours() + 1);

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExpiry: expires },
  });

  return { success: true, token, userId: user.id };
}

/**
 * Vérifie un token de réinitialisation de mot de passe
 */
export async function verifyPasswordResetToken(token) {
  if (!token) {
    return { valid: false, error: 'Token manquant' };
  }

  const user = await prisma.user.findFirst({
    where: { resetToken: token },
  });

  if (!user) {
    return { valid: false, error: 'Token invalide' };
  }

  if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: null, resetTokenExpiry: null },
    });
    return { valid: false, error: 'Token expiré' };
  }

  return { valid: true, userId: user.id };
}

/**
 * Supprime le token de réinitialisation après utilisation
 */
export async function deletePasswordResetToken(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { resetToken: null, resetTokenExpiry: null },
  });
}

// ============================================================================
// EMAIL CHANGE REQUEST MANAGEMENT
// ============================================================================

/**
 * Crée une demande de changement d'email
 */
export async function createEmailChangeRequest(userId, newEmail) {
  await prisma.emailChangeRequest.deleteMany({
    where: { userId },
  });

  const token = generateVerificationToken();
  const expires = new Date();
  expires.setHours(expires.getHours() + 24);

  await prisma.emailChangeRequest.create({
    data: { userId, newEmail, token, expires },
  });

  return token;
}

/**
 * Vérifie un token de changement d'email
 */
export async function verifyEmailChangeToken(token) {
  if (!token) {
    return { valid: false, error: 'Token manquant' };
  }

  const record = await prisma.emailChangeRequest.findUnique({
    where: { token },
  });

  if (!record) {
    return { valid: false, error: 'Token invalide' };
  }

  if (record.expires < new Date()) {
    await prisma.emailChangeRequest.delete({
      where: { token },
    });
    return { valid: false, error: 'Token expiré' };
  }

  return { valid: true, userId: record.userId, newEmail: record.newEmail };
}

/**
 * Supprime une demande de changement d'email après utilisation
 */
export async function deleteEmailChangeRequest(token) {
  await prisma.emailChangeRequest.deleteMany({
    where: { token },
  });
}

// ============================================================================
// EMAIL SENDING FUNCTIONS (using factory pattern)
// ============================================================================

/**
 * Envoie un email de vérification
 */
export const sendVerificationEmail = createEmailSender('email_verification', {
  templateName: 'verification',
  defaultSubject: 'Vérifiez votre adresse email - FitMyCV.io',
  buildVariables: ({ name, token }, siteUrl) => ({
    userName: name,
    verificationUrl: `${siteUrl}/auth/verify-email?token=${token}`,
  }),
  getFallbackHtml: getVerificationEmailTemplate,
});

/**
 * Envoie un email de réinitialisation de mot de passe
 */
export const sendPasswordResetEmail = createEmailSender('password_reset', {
  templateName: 'password_reset',
  defaultSubject: 'Réinitialisation de votre mot de passe - FitMyCV.io',
  buildVariables: ({ name, token }, siteUrl) => ({
    userName: name,
    resetUrl: `${siteUrl}/auth/reset-password?token=${token}`,
  }),
  getFallbackHtml: getPasswordResetEmailTemplate,
});

/**
 * Envoie un email de confirmation de changement d'adresse
 */
export const sendEmailChangeVerification = createEmailSender('email_change', {
  templateName: 'email_change',
  defaultSubject: 'Confirmez votre nouvelle adresse email - FitMyCV.io',
  buildVariables: ({ name, token, email }, siteUrl) => ({
    userName: name,
    verificationUrl: `${siteUrl}/auth/verify-email-change?token=${token}`,
    newEmail: email,
  }),
  getFallbackHtml: getEmailChangeTemplate,
});

/**
 * Envoie un email de bienvenue après vérification
 */
export const sendWelcomeEmail = createEmailSender('welcome', {
  templateName: 'welcome',
  defaultSubject: 'Bienvenue sur FitMyCV.io !',
  buildVariables: async ({ name }, siteUrl) => {
    const welcomeCredits = await getNumericSettingValue('welcome_credits', 0);
    return {
      userName: name,
      loginUrl: `${siteUrl}/auth/signin`,
      welcomeCredits: String(welcomeCredits),
    };
  },
  getFallbackHtml: getWelcomeEmailTemplate,
});

/**
 * Envoie un email de confirmation d'achat de crédits
 */
export const sendPurchaseCreditsEmail = createEmailSender('purchase_credits', {
  templateName: 'purchase_credits',
  defaultSubject: ({ creditsAmount }) => `Confirmation d'achat - ${creditsAmount} crédits`,
  buildVariables: ({ name, creditsAmount, totalPrice, invoiceUrl }) => ({
    userName: name,
    creditsAmount: String(creditsAmount),
    totalPrice,
    invoiceUrl: invoiceUrl || '',
  }),
  getFallbackHtml: getPurchaseCreditsEmailTemplate,
});
