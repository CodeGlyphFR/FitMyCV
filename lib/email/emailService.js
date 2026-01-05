/**
 * Service d'envoi d'emails avec Resend
 */

import { Resend } from 'resend';
import { render } from '@maily-to/render';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { getNumericSettingValue } from '@/lib/settings/settingsUtils';

const resend = new Resend(process.env.RESEND_API_KEY);

// Email FROM configurable via variable d'environnement
// Par défaut: noreply@fitmycv.io (email de test Resend)
// En production: utiliser un email de votre domaine vérifié
const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@fitmycv.io';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

/**
 * Charge un template email actif par nom de trigger
 * @param {string} triggerName - Nom du trigger (email_verification, password_reset, etc.)
 * @returns {Promise<Object|null>} - Template actif ou null si non trouve
 */
async function getTemplateByTrigger(triggerName) {
  try {
    const template = await prisma.emailTemplate.findFirst({
      where: {
        trigger: { name: triggerName },
        isActive: true,
      },
      include: { trigger: true },
    });
    return template;
  } catch (error) {
    console.error(`[emailService] Error loading template for trigger "${triggerName}":`, error);
    return null;
  }
}

/**
 * @deprecated Use getTemplateByTrigger instead
 * Charge un template email depuis la base de donnees par nom de template
 * @param {string} templateName - Nom du template (verification, password_reset, email_change)
 * @returns {Promise<Object|null>} - Template ou null si non trouve
 */
async function getEmailTemplate(templateName) {
  try {
    const template = await prisma.emailTemplate.findFirst({
      where: {
        name: templateName,
        isActive: true,
      },
    });
    return template;
  } catch (error) {
    console.error(`[emailService] Error loading template "${templateName}":`, error);
    return null;
  }
}

/**
 * Substitue les variables dans le contenu HTML
 * @param {string} html - Contenu HTML avec placeholders {{variable}}
 * @param {Object} variables - Objet avec les valeurs des variables
 * @returns {string} - HTML avec variables substituees
 */
function substituteVariables(html, variables) {
  let result = html;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  }
  return result;
}

/**
 * Render Maily template JSON to HTML with background color support
 * @param {string|Object} designJson - The Maily/TipTap JSON content
 * @returns {Promise<string>} Rendered HTML with background color wrapper
 */
async function renderMailyTemplate(designJson) {
  const json = typeof designJson === 'string' ? JSON.parse(designJson) : designJson;

  // Extract backgroundColor from designJson (default to white)
  const backgroundColor = json.backgroundColor || '#ffffff';

  // Remove backgroundColor from json before rendering (not a TipTap property)
  const { backgroundColor: _, ...contentJson } = json;

  // Render the content
  const contentHtml = await render(contentJson);

  // Wrap with background color styles (same pattern as EmailTemplatesTab preview/save)
  // Note: We exclude buttons (a tags) from the transparent rule to preserve button backgrounds
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    *:not(a):not(a *) { background-color: transparent !important; }
    body { background-color: ${backgroundColor} !important; }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${backgroundColor};">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: ${backgroundColor};">
    ${contentHtml}
  </div>
</body>
</html>`;
}

/**
 * Log un email envoye dans la base de donnees
 * @param {Object} params
 * @param {string} params.templateId - ID du template (optionnel)
 * @param {string} params.templateName - Nom du template
 * @param {string} params.recipientEmail - Email du destinataire
 * @param {string} params.recipientUserId - ID de l'utilisateur (optionnel)
 * @param {string} params.subject - Sujet de l'email
 * @param {string} params.status - Statut (sent, failed)
 * @param {string} params.error - Message d'erreur si echec (optionnel)
 * @param {string} params.resendId - ID Resend (optionnel)
 */
async function logEmail({ templateId, templateName, recipientEmail, recipientUserId, subject, status, error, resendId }) {
  try {
    await prisma.emailLog.create({
      data: {
        templateId: templateId || null,
        templateName,
        recipientEmail,
        recipientUserId: recipientUserId || null,
        subject,
        status,
        error: error || null,
        resendId: resendId || null,
        isTestEmail: false,
      },
    });
  } catch (err) {
    console.error('[emailService] Failed to log email:', err);
  }
}

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
    <h1 style="color: white; margin: 0; font-size: 28px;">FitMyCV.io</h1>
  </div>

  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Bienvenue ${userName} !</h2>

    <p style="font-size: 16px; color: #555;">
      Merci de vous être inscrit sur FitMyCV.io. Pour commencer à utiliser votre compte, veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous.
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
    <p>© ${new Date().getFullYear()} FitMyCV.io. Tous droits réservés.</p>
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
 * @param {string} params.userId - ID de l'utilisateur (optionnel, pour logging)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendVerificationEmail({ email, name, token, userId }) {
  if (!process.env.RESEND_API_KEY) {
    console.error('[emailService] RESEND_API_KEY non configurée');
    return { success: false, error: 'Service d\'email non configuré' };
  }

  const verificationUrl = `${SITE_URL}/auth/verify-email?token=${token}`;
  const variables = { userName: name, verificationUrl };

  // Try to load template from DB via trigger
  const template = await getTemplateByTrigger('email_verification');
  let html, subject;

  if (template && template.htmlContent) {
    html = substituteVariables(template.htmlContent, variables);
    subject = substituteVariables(template.subject, variables);
  } else {
    // Fallback to hardcoded template
    html = getVerificationEmailTemplate(verificationUrl, name);
    subject = 'Vérifiez votre adresse email - FitMyCV.io';
  }

  console.log('[emailService] Tentative d\'envoi d\'email de vérification:', {
    to: email,
    from: FROM_EMAIL,
    siteUrl: SITE_URL,
    hasToken: !!token,
    usingDbTemplate: !!template,
    triggerName: 'email_verification',
  });

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      html,
    });

    // Log the email
    await logEmail({
      templateId: template?.id,
      templateName: 'verification',
      recipientEmail: email,
      recipientUserId: userId,
      subject,
      status: error ? 'failed' : 'sent',
      error: error?.message,
      resendId: data?.id,
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
    <h1 style="color: white; margin: 0; font-size: 28px;">FitMyCV.io</h1>
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
    <p>© ${new Date().getFullYear()} FitMyCV.io. Tous droits réservés.</p>
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
 * @param {string} params.userId - ID de l'utilisateur (optionnel, pour logging)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendPasswordResetEmail({ email, name, token, userId }) {
  if (!process.env.RESEND_API_KEY) {
    console.error('[emailService] RESEND_API_KEY non configurée');
    return { success: false, error: 'Service d\'email non configuré' };
  }

  const resetUrl = `${SITE_URL}/auth/reset-password?token=${token}`;
  const variables = { userName: name, resetUrl };

  // Try to load template from DB via trigger
  const template = await getTemplateByTrigger('password_reset');
  let html, subject;

  if (template && template.htmlContent) {
    html = substituteVariables(template.htmlContent, variables);
    subject = substituteVariables(template.subject, variables);
  } else {
    // Fallback to hardcoded template
    html = getPasswordResetEmailTemplate(resetUrl, name);
    subject = 'Réinitialisation de votre mot de passe - FitMyCV.io';
  }

  console.log('[emailService] Tentative d\'envoi d\'email de réinitialisation:', {
    to: email,
    from: FROM_EMAIL,
    siteUrl: SITE_URL,
    hasToken: !!token,
    usingDbTemplate: !!template,
    triggerName: 'password_reset',
  });

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      html,
    });

    // Log the email
    await logEmail({
      templateId: template?.id,
      templateName: 'password_reset',
      recipientEmail: email,
      recipientUserId: userId,
      subject,
      status: error ? 'failed' : 'sent',
      error: error?.message,
      resendId: data?.id,
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
    <h1 style="color: white; margin: 0; font-size: 28px;">FitMyCV.io</h1>
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
    <p>© ${new Date().getFullYear()} FitMyCV.io. Tous droits réservés.</p>
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
 * @param {string} params.userId - ID de l'utilisateur (optionnel, pour logging)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendEmailChangeVerification({ email, name, token, userId }) {
  if (!process.env.RESEND_API_KEY) {
    console.error('[emailService] RESEND_API_KEY non configurée');
    return { success: false, error: 'Service d\'email non configuré' };
  }

  const verificationUrl = `${SITE_URL}/auth/verify-email-change?token=${token}`;
  const variables = { userName: name, verificationUrl, newEmail: email };

  // Try to load template from DB via trigger
  const template = await getTemplateByTrigger('email_change');
  let html, subject;

  if (template && template.htmlContent) {
    html = substituteVariables(template.htmlContent, variables);
    subject = substituteVariables(template.subject, variables);
  } else {
    // Fallback to hardcoded template
    html = getEmailChangeTemplate(verificationUrl, name, email);
    subject = 'Confirmez votre nouvelle adresse email - FitMyCV.io';
  }

  console.log('[emailService] Tentative d\'envoi d\'email de changement d\'adresse:', {
    to: email,
    from: FROM_EMAIL,
    siteUrl: SITE_URL,
    hasToken: !!token,
    usingDbTemplate: !!template,
    triggerName: 'email_change',
  });

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      html,
    });

    // Log the email
    await logEmail({
      templateId: template?.id,
      templateName: 'email_change',
      recipientEmail: email,
      recipientUserId: userId,
      subject,
      status: error ? 'failed' : 'sent',
      error: error?.message,
      resendId: data?.id,
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

/**
 * Get welcome email template (fallback HTML)
 */
function getWelcomeEmailTemplate(name, loginUrl) {
  const displayName = name || 'utilisateur';
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bienvenue sur FitMyCV.io</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 12px 12px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">
                    Bienvenue sur FitMyCV.io
                  </h1>
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    Bonjour ${displayName},
                  </p>
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    Votre compte a été créé avec succès ! Vous pouvez maintenant profiter de toutes les fonctionnalités de FitMyCV.io pour créer des CV optimisés et adaptés à vos candidatures.
                  </p>
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                    Voici ce que vous pouvez faire :
                  </p>
                  <ul style="color: #374151; font-size: 16px; line-height: 1.8; margin: 0 0 30px; padding-left: 20px;">
                    <li>Créer et personnaliser vos CV</li>
                    <li>Adapter vos CV à chaque offre d'emploi grâce à l'IA</li>
                    <li>Exporter vos CV en PDF</li>
                    <li>Gérer plusieurs versions de vos CV</li>
                  </ul>
                  <!-- CTA Button -->
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${loginUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                      Accéder à mon compte
                    </a>
                  </div>
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0; text-align: center;">
                    Si vous avez des questions, n'hésitez pas à nous contacter.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                  <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
                    © ${new Date().getFullYear()} FitMyCV.io - Tous droits réservés<br>
                    Cet email a été envoyé automatiquement, merci de ne pas y répondre.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Send welcome email after email verification
 */
export async function sendWelcomeEmail({ email, name, userId }) {
  const loginUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://fitmycv.io'}/auth/signin`;

  // Get welcome credits value from settings
  const welcomeCredits = await getNumericSettingValue('welcome_credits', 0);

  // Try to get template from database
  const template = await getTemplateByTrigger('welcome');

  let html, subject;
  if (template && template.designJson) {
    html = await renderMailyTemplate(template.designJson);
    html = substituteVariables(html, {
      userName: name,
      loginUrl,
      welcomeCredits: String(welcomeCredits),
    });
    subject = substituteVariables(template.subject, { userName: name });
  } else {
    // Fallback to hardcoded template
    html = getWelcomeEmailTemplate(name, loginUrl);
    subject = 'Bienvenue sur FitMyCV.io !';
  }

  // Log pour debug
  console.log('[emailService] Envoi email welcome:', {
    to: email,
    subject,
    hasTemplate: !!template,
    triggerName: 'welcome',
  });

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      html,
    });

    // Log the email
    await logEmail({
      templateId: template?.id,
      templateName: 'welcome',
      recipientEmail: email,
      recipientUserId: userId,
      subject,
      status: error ? 'failed' : 'sent',
      error: error?.message,
      resendId: data?.id,
    });

    if (error) {
      console.error('[emailService] Erreur Resend (welcome):', {
        error,
        message: error.message,
        name: error.name,
        statusCode: error.statusCode,
      });
      return { success: false, error: error.message || 'Erreur lors de l\'envoi de l\'email' };
    }

    console.log('[emailService] Email welcome envoyé avec succès:', {
      to: email,
      id: data?.id,
    });
    return { success: true, data };
  } catch (error) {
    console.error('[emailService] Exception lors de l\'envoi welcome:', {
      error,
      message: error.message,
      stack: error.stack,
    });
    return { success: false, error: error.message || 'Erreur inconnue' };
  }
}

/**
 * Get purchase credits email template (fallback HTML)
 */
function getPurchaseCreditsEmailTemplate(name, creditsAmount, totalPrice, invoiceUrl) {
  const displayName = name || 'utilisateur';
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Confirmation d'achat - FitMyCV.io</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px 12px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">
                    Achat confirmé !
                  </h1>
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    Bonjour ${displayName},
                  </p>
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                    Merci pour votre achat ! Votre paiement a été traité avec succès.
                  </p>
                  <!-- Order Details -->
                  <table role="presentation" style="width: 100%; background-color: #f9fafb; border-radius: 8px; margin-bottom: 30px;">
                    <tr>
                      <td style="padding: 20px;">
                        <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 0.5px;">
                          Détails de l'achat
                        </p>
                        <table role="presentation" style="width: 100%;">
                          <tr>
                            <td style="color: #374151; font-size: 16px; padding: 8px 0;">Crédits achetés</td>
                            <td style="color: #374151; font-size: 16px; padding: 8px 0; text-align: right; font-weight: 600;">${creditsAmount} crédits</td>
                          </tr>
                          <tr>
                            <td style="color: #374151; font-size: 16px; padding: 8px 0; border-top: 1px solid #e5e7eb;">Total</td>
                            <td style="color: #10b981; font-size: 18px; padding: 8px 0; text-align: right; font-weight: 700; border-top: 1px solid #e5e7eb;">${totalPrice}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                    Vos crédits ont été ajoutés à votre compte et sont disponibles immédiatement.
                  </p>
                  ${invoiceUrl ? `
                  <!-- Invoice Button -->
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${invoiceUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                      Voir ma facture
                    </a>
                  </div>
                  ` : ''}
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0; text-align: center;">
                    Si vous avez des questions concernant votre achat, n'hésitez pas à nous contacter.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                  <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
                    © ${new Date().getFullYear()} FitMyCV.io - Tous droits réservés<br>
                    Cet email a été envoyé automatiquement, merci de ne pas y répondre.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Send purchase credits confirmation email
 */
export async function sendPurchaseCreditsEmail({ email, name, userId, creditsAmount, totalPrice, invoiceUrl }) {
  // Try to get template from database
  const template = await getTemplateByTrigger('purchase_credits');

  let html, subject;
  if (template && template.designJson) {
    html = await renderMailyTemplate(template.designJson);
    html = substituteVariables(html, {
      userName: name,
      creditsAmount: String(creditsAmount),
      totalPrice,
      invoiceUrl: invoiceUrl || '',
    });
    subject = substituteVariables(template.subject, { userName: name, creditsAmount: String(creditsAmount) });
  } else {
    // Fallback to hardcoded template
    html = getPurchaseCreditsEmailTemplate(name, creditsAmount, totalPrice, invoiceUrl);
    subject = `Confirmation d'achat - ${creditsAmount} crédits`;
  }

  // Log pour debug
  console.log('[emailService] Envoi email purchase_credits:', {
    to: email,
    subject,
    hasTemplate: !!template,
    triggerName: 'purchase_credits',
    creditsAmount,
  });

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      html,
    });

    // Log the email
    await logEmail({
      templateId: template?.id,
      templateName: 'purchase_credits',
      recipientEmail: email,
      recipientUserId: userId,
      subject,
      status: error ? 'failed' : 'sent',
      error: error?.message,
      resendId: data?.id,
    });

    if (error) {
      console.error('[emailService] Erreur Resend (purchase_credits):', {
        error,
        message: error.message,
        name: error.name,
        statusCode: error.statusCode,
      });
      return { success: false, error: error.message || 'Erreur lors de l\'envoi de l\'email' };
    }

    console.log('[emailService] Email purchase_credits envoyé avec succès:', {
      to: email,
      id: data?.id,
    });
    return { success: true, data };
  } catch (error) {
    console.error('[emailService] Exception lors de l\'envoi purchase_credits:', {
      error,
      message: error.message,
      stack: error.stack,
    });
    return { success: false, error: error.message || 'Erreur inconnue' };
  }
}
