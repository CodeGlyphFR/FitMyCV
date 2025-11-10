/**
 * Service d'envoi d'emails avec Resend
 */

import { Resend } from 'resend';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

const resend = new Resend(process.env.RESEND_API_KEY);

// Email FROM configurable via variable d'environnement
// Par défaut: onboarding@resend.dev (email de test Resend)
// En production: utiliser un email de votre domaine vérifié
const FROM_EMAIL = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

/**
 * Génère un token de vérification sécurisé
 * @returns {string} - Token unique
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
  // Supprimer les anciens tokens de l'utilisateur
  await prisma.emailVerificationToken.deleteMany({
    where: { userId },
  });

  // Générer un nouveau token
  const token = generateVerificationToken();
  const expires = new Date();
  expires.setHours(expires.getHours() + 24); // Expire dans 24h

  // Sauvegarder en base
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      token,
      expires,
    },
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

  // Vérifier l'expiration
  if (record.expires < new Date()) {
    // Token expiré, le supprimer
    await prisma.emailVerificationToken.delete({
      where: { token },
    });
    return { valid: false, error: 'Token expiré' };
  }

  return { valid: true, userId: record.userId };
}

/**
 * Supprime un token de vérification après utilisation
 * @param {string} token - Token à supprimer
 */
export async function deleteVerificationToken(token) {
  await prisma.emailVerificationToken.deleteMany({
    where: { token },
  });
}

/**
 * Template HTML pour l'email de vérification
 * @param {string} verificationUrl - URL de vérification
 * @param {string} userName - Nom de l'utilisateur
 * @returns {string} - HTML de l'email
 */
function getVerificationEmailTemplate(verificationUrl, userName) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vérifiez votre adresse email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">FitMyCv.ai</h1>
  </div>

  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Bienvenue ${userName} !</h2>

    <p style="font-size: 16px; color: #555;">
      Merci de vous être inscrit sur FitMyCv.ai. Pour commencer à utiliser votre compte, veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous.
    </p>

    <div style="text-align: center; margin: 40px 0;">
      <a href="${verificationUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 16px; display: inline-block;">
        Vérifier mon email
      </a>
    </div>

    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      Si le bouton ne fonctionne pas, vous pouvez copier et coller ce lien dans votre navigateur :
    </p>

    <p style="font-size: 13px; color: #667eea; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 5px;">
      ${verificationUrl}
    </p>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

    <p style="font-size: 12px; color: #999;">
      Ce lien expire dans 24 heures. Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.
    </p>
  </div>

  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} FitMyCv.ai. Tous droits réservés.</p>
  </div>
</body>
</html>
  `;
}

/**
 * Envoie un email de vérification
 * @param {Object} params
 * @param {string} params.email - Email du destinataire
 * @param {string} params.name - Nom de l'utilisateur
 * @param {string} params.token - Token de vérification
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendVerificationEmail({ email, name, token }) {
  if (!process.env.RESEND_API_KEY) {
    console.error('[emailService] RESEND_API_KEY non configurée');
    return { success: false, error: 'Service d\'email non configuré' };
  }

  const verificationUrl = `${SITE_URL}/auth/verify-email?token=${token}`;

  console.log('[emailService] Tentative d\'envoi d\'email de vérification:', {
    to: email,
    from: FROM_EMAIL,
    siteUrl: SITE_URL,
    hasToken: !!token,
  });

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Vérifiez votre adresse email - FitMyCv.ai',
      html: getVerificationEmailTemplate(verificationUrl, name),
    });

    if (error) {
      console.error('[emailService] Erreur Resend:', {
        error,
        message: error.message,
        name: error.name,
        statusCode: error.statusCode,
      });
      return { success: false, error: error.message || 'Erreur lors de l\'envoi de l\'email' };
    }

    console.log('[emailService] Email de vérification envoyé avec succès:', {
      to: email,
      id: data?.id,
    });
    return { success: true, data };
  } catch (error) {
    console.error('[emailService] Exception lors de l\'envoi:', {
      error,
      message: error.message,
      stack: error.stack,
    });
    return { success: false, error: error.message || 'Erreur inconnue' };
  }
}

/**
 * Vérifie si un utilisateur a un email vérifié
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<boolean>}
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
 * @param {string} userId - ID de l'utilisateur
 */
export async function markEmailAsVerified(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: new Date() },
  });
}

/**
 * Crée un token de réinitialisation de mot de passe
 * @param {string} email - Email de l'utilisateur
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function createPasswordResetToken(email) {
  // Vérifier si l'utilisateur existe
  const user = await prisma.user.findUnique({
    where: { email },
    include: { accounts: true },
  });

  if (!user) {
    // Pour des raisons de sécurité, ne pas révéler que l'email n'existe pas
    return { success: true };
  }

  // Vérifier si l'utilisateur a un mot de passe (pas OAuth uniquement)
  if (!user.passwordHash) {
    return {
      success: false,
      error: 'oauth_only',
      message: 'Cet email est associé à un compte OAuth. Veuillez vous connecter avec votre fournisseur (Google, GitHub, Apple).'
    };
  }

  // Générer un nouveau token
  const token = generateVerificationToken();
  const expires = new Date();
  expires.setHours(expires.getHours() + 1); // Expire dans 1h

  // Sauvegarder en base
  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken: token,
      resetTokenExpiry: expires,
    },
  });

  return { success: true, token, userId: user.id };
}

/**
 * Vérifie un token de réinitialisation de mot de passe
 * @param {string} token - Token à vérifier
 * @returns {Promise<{valid: boolean, userId?: string, error?: string}>}
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

  // Vérifier l'expiration
  if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    // Token expiré, le supprimer
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
 * @param {string} userId - ID de l'utilisateur
 */
export async function deletePasswordResetToken(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { resetToken: null, resetTokenExpiry: null },
  });
}

/**
 * Template HTML pour l'email de réinitialisation de mot de passe
 * @param {string} resetUrl - URL de réinitialisation
 * @param {string} userName - Nom de l'utilisateur
 * @returns {string} - HTML de l'email
 */
function getPasswordResetEmailTemplate(resetUrl, userName) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Réinitialisation de votre mot de passe</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">FitMyCv.ai</h1>
  </div>

  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Bonjour ${userName} !</h2>

    <p style="font-size: 16px; color: #555;">
      Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe.
    </p>

    <div style="text-align: center; margin: 40px 0;">
      <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 16px; display: inline-block;">
        Réinitialiser mon mot de passe
      </a>
    </div>

    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      Si le bouton ne fonctionne pas, vous pouvez copier et coller ce lien dans votre navigateur :
    </p>

    <p style="font-size: 13px; color: #667eea; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 5px;">
      ${resetUrl}
    </p>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

    <p style="font-size: 14px; color: #e63946; font-weight: 600;">
      ⚠️ Attention
    </p>

    <p style="font-size: 13px; color: #666;">
      Ce lien expire dans 1 heure. Si vous n'avez pas demandé de réinitialisation de mot de passe, vous pouvez ignorer cet email en toute sécurité.
    </p>
  </div>

  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} FitMyCv.ai. Tous droits réservés.</p>
  </div>
</body>
</html>
  `;
}

/**
 * Envoie un email de réinitialisation de mot de passe
 * @param {Object} params
 * @param {string} params.email - Email du destinataire
 * @param {string} params.name - Nom de l'utilisateur
 * @param {string} params.token - Token de réinitialisation
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendPasswordResetEmail({ email, name, token }) {
  if (!process.env.RESEND_API_KEY) {
    console.error('[emailService] RESEND_API_KEY non configurée');
    return { success: false, error: 'Service d\'email non configuré' };
  }

  const resetUrl = `${SITE_URL}/auth/reset-password?token=${token}`;

  console.log('[emailService] Tentative d\'envoi d\'email de réinitialisation:', {
    to: email,
    from: FROM_EMAIL,
    siteUrl: SITE_URL,
    hasToken: !!token,
  });

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Réinitialisation de votre mot de passe - FitMyCv.ai',
      html: getPasswordResetEmailTemplate(resetUrl, name),
    });

    if (error) {
      console.error('[emailService] Erreur Resend:', {
        error,
        message: error.message,
        name: error.name,
        statusCode: error.statusCode,
      });
      return { success: false, error: error.message || 'Erreur lors de l\'envoi de l\'email' };
    }

    console.log('[emailService] Email de réinitialisation envoyé avec succès:', {
      to: email,
      id: data?.id,
    });
    return { success: true, data };
  } catch (error) {
    console.error('[emailService] Exception lors de l\'envoi:', {
      error,
      message: error.message,
      stack: error.stack,
    });
    return { success: false, error: error.message || 'Erreur inconnue' };
  }
}

/**
 * Crée une demande de changement d'email
 * @param {string} userId - ID de l'utilisateur
 * @param {string} newEmail - Nouvelle adresse email
 * @returns {Promise<string>} - Token généré
 */
export async function createEmailChangeRequest(userId, newEmail) {
  // Supprimer les anciennes demandes de l'utilisateur
  await prisma.emailChangeRequest.deleteMany({
    where: { userId },
  });

  // Générer un nouveau token
  const token = generateVerificationToken();
  const expires = new Date();
  expires.setHours(expires.getHours() + 24); // Expire dans 24h

  // Sauvegarder en base
  await prisma.emailChangeRequest.create({
    data: {
      userId,
      newEmail,
      token,
      expires,
    },
  });

  return token;
}

/**
 * Vérifie un token de changement d'email
 * @param {string} token - Token à vérifier
 * @returns {Promise<{valid: boolean, userId?: string, newEmail?: string, error?: string}>}
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

  // Vérifier l'expiration
  if (record.expires < new Date()) {
    // Token expiré, le supprimer
    await prisma.emailChangeRequest.delete({
      where: { token },
    });
    return { valid: false, error: 'Token expiré' };
  }

  return { valid: true, userId: record.userId, newEmail: record.newEmail };
}

/**
 * Supprime une demande de changement d'email après utilisation
 * @param {string} token - Token à supprimer
 */
export async function deleteEmailChangeRequest(token) {
  await prisma.emailChangeRequest.deleteMany({
    where: { token },
  });
}

/**
 * Template HTML pour l'email de changement d'adresse
 * @param {string} verificationUrl - URL de vérification
 * @param {string} userName - Nom de l'utilisateur
 * @param {string} newEmail - Nouvelle adresse email
 * @returns {string} - HTML de l'email
 */
function getEmailChangeTemplate(verificationUrl, userName, newEmail) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmez votre nouvelle adresse email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">FitMyCv.ai</h1>
  </div>

  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Bonjour ${userName} !</h2>

    <p style="font-size: 16px; color: #555;">
      Vous avez demandé à modifier votre adresse email. Pour confirmer ce changement, veuillez cliquer sur le bouton ci-dessous.
    </p>

    <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #666;">Nouvelle adresse email :</p>
      <p style="margin: 5px 0 0; font-size: 16px; font-weight: 600; color: #333;">${newEmail}</p>
    </div>

    <div style="text-align: center; margin: 40px 0;">
      <a href="${verificationUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 16px; display: inline-block;">
        Confirmer la modification
      </a>
    </div>

    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      Si le bouton ne fonctionne pas, vous pouvez copier et coller ce lien dans votre navigateur :
    </p>

    <p style="font-size: 13px; color: #667eea; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 5px;">
      ${verificationUrl}
    </p>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

    <p style="font-size: 14px; color: #e63946; font-weight: 600;">
      ⚠️ Important
    </p>

    <p style="font-size: 13px; color: #666;">
      Ce lien expire dans 24 heures. Si vous n'avez pas demandé ce changement, veuillez ignorer cet email et votre adresse actuelle restera inchangée.
    </p>
  </div>

  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} FitMyCv.ai. Tous droits réservés.</p>
  </div>
</body>
</html>
  `;
}

/**
 * Envoie un email de confirmation de changement d'adresse
 * @param {Object} params
 * @param {string} params.email - Nouvelle adresse email du destinataire
 * @param {string} params.name - Nom de l'utilisateur
 * @param {string} params.token - Token de vérification
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendEmailChangeVerification({ email, name, token }) {
  if (!process.env.RESEND_API_KEY) {
    console.error('[emailService] RESEND_API_KEY non configurée');
    return { success: false, error: 'Service d\'email non configuré' };
  }

  const verificationUrl = `${SITE_URL}/auth/verify-email-change?token=${token}`;

  console.log('[emailService] Tentative d\'envoi d\'email de changement d\'adresse:', {
    to: email,
    from: FROM_EMAIL,
    siteUrl: SITE_URL,
    hasToken: !!token,
  });

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Confirmez votre nouvelle adresse email - FitMyCv.ai',
      html: getEmailChangeTemplate(verificationUrl, name, email),
    });

    if (error) {
      console.error('[emailService] Erreur Resend:', {
        error,
        message: error.message,
        name: error.name,
        statusCode: error.statusCode,
      });
      return { success: false, error: error.message || 'Erreur lors de l\'envoi de l\'email' };
    }

    console.log('[emailService] Email de changement d\'adresse envoyé avec succès:', {
      to: email,
      id: data?.id,
    });
    return { success: true, data };
  } catch (error) {
    console.error('[emailService] Exception lors de l\'envoi:', {
      error,
      message: error.message,
      stack: error.stack,
    });
    return { success: false, error: error.message || 'Erreur inconnue' };
  }
}
