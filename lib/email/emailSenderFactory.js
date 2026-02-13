/**
 * Factory pour créer des fonctions d'envoi d'email standardisées
 * Élimine la duplication de code entre sendVerificationEmail, sendPasswordResetEmail, etc.
 */

import { sendEmail, isSmtpConfigured, isResendConfigured } from './transports';
import { render } from '@maily-to/render';
import prisma from '@/lib/prisma';

const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@fitmycv.io';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

/**
 * Charge un template email actif par nom de trigger
 */
async function getTemplateByTrigger(triggerName) {
  try {
    return await prisma.emailTemplate.findFirst({
      where: {
        trigger: { name: triggerName },
        isActive: true,
      },
      include: { trigger: true },
    });
  } catch (error) {
    console.error(`[emailService] Error loading template for trigger "${triggerName}":`, error);
    return null;
  }
}

/**
 * Substitue les variables dans le contenu HTML
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
 */
async function renderMailyTemplate(designJson) {
  const json = typeof designJson === 'string' ? JSON.parse(designJson) : designJson;
  const backgroundColor = json.backgroundColor || '#ffffff';
  const { backgroundColor: _, ...contentJson } = json;

  let mailyHtml = await render(contentJson);
  mailyHtml = mailyHtml.replace(/background-color:\s*#ffffff/gi, `background-color:${backgroundColor}`);
  mailyHtml = mailyHtml.replace(/background-color:\s*white/gi, `background-color:${backgroundColor}`);

  return mailyHtml;
}

/**
 * Check if designJson is valid (not empty or placeholder)
 */
function isValidDesignJson(designJson) {
  if (!designJson) return false;
  const jsonStr = typeof designJson === 'string' ? designJson : JSON.stringify(designJson);
  return jsonStr !== '{}' && jsonStr !== '{"type":"doc","content":[]}';
}

/**
 * Log un email envoyé dans la base de données
 */
async function logEmail({ templateId, templateName, recipientEmail, recipientUserId, subject, status, error, provider, providerId }) {
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
        provider: provider || 'unknown',
        providerId: providerId || null,
        isTestEmail: false,
      },
    });
  } catch (err) {
    console.error('[emailService] Failed to log email:', err);
  }
}

/**
 * Crée une fonction d'envoi d'email standardisée
 *
 * @param {string} triggerName - Nom du trigger (email_verification, password_reset, etc.)
 * @param {Object} config - Configuration de l'email
 * @param {function} config.buildVariables - Fonction qui construit les variables à partir des params
 * @param {function} config.getFallbackHtml - Fonction qui retourne le HTML fallback
 * @param {string} config.defaultSubject - Sujet par défaut si pas de template
 * @param {string} config.templateName - Nom du template pour le logging
 * @returns {function} - Fonction d'envoi d'email
 */
export function createEmailSender(triggerName, config) {
  const { buildVariables, getFallbackHtml, defaultSubject, templateName, bcc } = config;

  return async function sendEmailFunction(params) {
    const { email, userId } = params;

    // Vérifier qu'au moins un provider est configuré
    if (!isSmtpConfigured() && !isResendConfigured()) {
      console.error('[emailService] Aucun provider email configuré (SMTP ou Resend)');
      return { success: false, error: 'Service d\'email non configuré' };
    }

    // Construire les variables (support async)
    const variables = await Promise.resolve(buildVariables(params, SITE_URL));

    // Charger le template depuis la DB
    const template = await getTemplateByTrigger(triggerName);
    let html, subject;

    if (template && isValidDesignJson(template.designJson)) {
      // Priorité au designJson (rendu via renderMailyTemplate)
      html = await renderMailyTemplate(template.designJson);
      html = substituteVariables(html, variables);
      subject = substituteVariables(template.subject, variables);
    } else if (template && template.htmlContent) {
      // Fallback vers htmlContent si pas de designJson
      html = substituteVariables(template.htmlContent, variables);
      subject = substituteVariables(template.subject, variables);
    } else {
      // Fallback vers template hardcodé
      html = getFallbackHtml(params, variables, SITE_URL);
      subject = typeof defaultSubject === 'function' ? defaultSubject(params) : defaultSubject;
    }

    // Log de debug
    console.log(`[emailService] Envoi email ${triggerName}:`, {
      to: email,
      from: FROM_EMAIL,
      subject,
      hasTemplate: !!template,
      usingDesignJson: !!(template && isValidDesignJson(template.designJson)),
      triggerName,
      smtpConfigured: isSmtpConfigured(),
      resendConfigured: isResendConfigured(),
    });

    // Résoudre le BCC (peut être une fonction ou une valeur statique)
    const resolvedBcc = typeof bcc === 'function' ? bcc() : bcc;

    // Envoi via la couche de transport
    const result = await sendEmail({ to: email, subject, html, bcc: resolvedBcc });

    // Log l'email dans la DB
    await logEmail({
      templateId: template?.id,
      templateName,
      recipientEmail: email,
      recipientUserId: userId,
      subject,
      status: result.success ? 'sent' : 'failed',
      error: result.error,
      provider: result.provider,
      providerId: result.messageId,
    });

    if (!result.success) {
      console.error(`[emailService] Échec envoi email ${triggerName}:`, {
        error: result.error,
        provider: result.provider,
        usedFallback: result.usedFallback,
      });
      return { success: false, error: result.error || 'Erreur lors de l\'envoi de l\'email' };
    }

    console.log(`[emailService] Email ${triggerName} envoyé avec succès:`, {
      to: email,
      id: result.messageId,
      provider: result.provider,
      usedFallback: result.usedFallback,
    });

    return { success: true, data: { id: result.messageId, provider: result.provider } };
  };
}

// Re-export des fonctions utilitaires pour usage externe
export { getTemplateByTrigger, substituteVariables, renderMailyTemplate, isValidDesignJson, logEmail, SITE_URL };
