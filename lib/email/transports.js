/**
 * Email Transport Layer
 *
 * Gère l'envoi d'emails via SMTP (OVH) comme transport principal
 * et Resend comme fallback en cas d'échec.
 *
 * Comportement par défaut (EMAIL_PROVIDER=auto):
 *   1. Essaye SMTP OVH en premier
 *   2. Si SMTP échoue → fallback sur Resend
 *   3. Si Resend échoue aussi → retourne l'erreur
 */

import nodemailer from 'nodemailer';
import { Resend } from 'resend';

// Configuration SMTP (OVH)
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true', // true pour port 465, false pour 587 avec STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
};

// Configuration commune
const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@fitmycv.io';
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'auto'; // 'smtp', 'resend', ou 'auto'

// Lazy initialization des transports
let smtpTransport = null;
let resendClient = null;

/**
 * Récupère ou crée le transport SMTP
 */
function getSmtpTransport() {
  if (!smtpTransport && isSmtpConfigured()) {
    smtpTransport = nodemailer.createTransport(SMTP_CONFIG);
  }
  return smtpTransport;
}

/**
 * Récupère ou crée le client Resend
 */
function getResendClient() {
  if (!resendClient && isResendConfigured()) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

/**
 * Vérifie si SMTP est configuré
 */
export function isSmtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

/**
 * Vérifie si Resend est configuré
 */
export function isResendConfigured() {
  return !!process.env.RESEND_API_KEY;
}

/**
 * Envoie un email via SMTP
 * @param {Object} options - Options d'envoi (to, subject, html)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string, provider: string}>}
 */
async function sendViaSMTP({ to, subject, html }) {
  const transport = getSmtpTransport();
  if (!transport) {
    return { success: false, error: 'SMTP non configuré', provider: 'smtp' };
  }

  try {
    const info = await transport.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    return {
      success: true,
      messageId: info.messageId,
      provider: 'smtp',
    };
  } catch (error) {
    console.error('[SMTP] Échec envoi:', {
      error: error.message,
      code: error.code,
      response: error.response,
    });
    return {
      success: false,
      error: error.message,
      provider: 'smtp',
    };
  }
}

/**
 * Envoie un email via Resend
 * @param {Object} options - Options d'envoi (to, subject, html)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string, provider: string}>}
 */
async function sendViaResend({ to, subject, html }) {
  const client = getResendClient();
  if (!client) {
    return { success: false, error: 'Resend non configuré', provider: 'resend' };
  }

  try {
    const { data, error } = await client.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
        provider: 'resend',
      };
    }

    return {
      success: true,
      messageId: data?.id,
      provider: 'resend',
    };
  } catch (error) {
    console.error('[Resend] Échec envoi:', error);
    return {
      success: false,
      error: error.message,
      provider: 'resend',
    };
  }
}

/**
 * Envoie un email avec sélection automatique du provider et fallback
 *
 * Stratégie:
 * - EMAIL_PROVIDER='smtp': Utilise uniquement SMTP (pas de fallback)
 * - EMAIL_PROVIDER='resend': Utilise uniquement Resend (pas de fallback)
 * - EMAIL_PROVIDER='auto' (défaut): SMTP d'abord, fallback Resend si échec
 *
 * @param {Object} options - Options d'envoi (to, subject, html)
 * @returns {Promise<{success: boolean, messageId?: string, provider: string, error?: string, usedFallback?: boolean}>}
 */
export async function sendEmail({ to, subject, html }) {
  const smtpAvailable = isSmtpConfigured();
  const resendAvailable = isResendConfigured();

  // Mode forcé: SMTP uniquement
  if (EMAIL_PROVIDER === 'smtp') {
    if (!smtpAvailable) {
      return { success: false, error: 'SMTP non configuré', provider: 'smtp' };
    }
    console.log('[Email] Mode SMTP forcé');
    return sendViaSMTP({ to, subject, html });
  }

  // Mode forcé: Resend uniquement
  if (EMAIL_PROVIDER === 'resend') {
    if (!resendAvailable) {
      return { success: false, error: 'Resend non configuré', provider: 'resend' };
    }
    console.log('[Email] Mode Resend forcé');
    return sendViaResend({ to, subject, html });
  }

  // Mode auto: SMTP principal, Resend fallback
  if (smtpAvailable) {
    console.log('[Email] Tentative envoi via SMTP...');
    const smtpResult = await sendViaSMTP({ to, subject, html });

    if (smtpResult.success) {
      console.log('[Email] Envoi SMTP réussi:', smtpResult.messageId);
      return smtpResult;
    }

    // SMTP échoué, essayer Resend en fallback
    if (resendAvailable) {
      console.log('[Email] SMTP échoué, fallback sur Resend...');
      const resendResult = await sendViaResend({ to, subject, html });
      return {
        ...resendResult,
        usedFallback: true,
        primaryError: smtpResult.error,
      };
    }

    // Pas de fallback disponible
    return smtpResult;
  }

  // Pas de SMTP, utiliser Resend directement
  if (resendAvailable) {
    console.log('[Email] SMTP non configuré, utilisation de Resend...');
    return sendViaResend({ to, subject, html });
  }

  // Aucun provider configuré
  return {
    success: false,
    error: 'Aucun provider email configuré (SMTP ou Resend)',
    provider: 'none',
  };
}

/**
 * Vérifie la connexion SMTP (utile pour les health checks)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function verifySmtpConnection() {
  const transport = getSmtpTransport();
  if (!transport) {
    return { success: false, error: 'SMTP non configuré' };
  }

  try {
    await transport.verify();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Retourne les infos de configuration (sans les credentials)
 * @returns {Object} Configuration status
 */
export function getEmailConfig() {
  return {
    provider: EMAIL_PROVIDER,
    smtpConfigured: isSmtpConfigured(),
    smtpHost: process.env.SMTP_HOST || null,
    smtpPort: process.env.SMTP_PORT || null,
    resendConfigured: isResendConfigured(),
    fromEmail: FROM_EMAIL,
  };
}
