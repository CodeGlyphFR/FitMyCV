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
    <h1 style="color: white; margin: 0; font-size: 28px;">CV Builder</h1>
  </div>

  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Bienvenue ${userName} !</h2>

    <p style="font-size: 16px; color: #555;">
      Merci de vous être inscrit sur CV Builder. Pour commencer à utiliser votre compte, veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous.
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
    <p>© ${new Date().getFullYear()} CV Builder. Tous droits réservés.</p>
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
      subject: 'Vérifiez votre adresse email - CV Builder',
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
