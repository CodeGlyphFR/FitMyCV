/**
 * API Route: Email Test
 *
 * Permet aux admins d'envoyer des emails de test pour vérifier la configuration.
 *
 * POST /api/admin/email-test
 * Body: { to, subject?, html? }
 */

import { auth } from '@/lib/auth/session';
import { sendEmail, isSmtpConfigured, isResendConfigured } from '@/lib/email/transports';
import prisma from '@/lib/prisma';

export async function POST(request) {
  // 1. Vérifier auth admin
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  // 2. Parser body
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body JSON invalide' }, { status: 400 });
  }

  const { to, testEmail, subject, html, templateId } = body;
  const recipientEmail = to || testEmail;

  // 3. Validation
  if (!recipientEmail || typeof recipientEmail !== 'string' || !recipientEmail.includes('@')) {
    return Response.json({ error: 'Email invalide' }, { status: 400 });
  }

  // 4. Vérifier config email
  if (!isSmtpConfigured() && !isResendConfigured()) {
    return Response.json({ error: 'Aucun provider email configuré' }, { status: 500 });
  }

  // 5. Récupérer le template si templateId fourni
  let emailSubject = subject;
  let emailHtml = html;

  if (templateId) {
    const template = await prisma.emailTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      return Response.json({ error: 'Template non trouvé' }, { status: 404 });
    }
    emailSubject = template.subject;
    emailHtml = template.htmlContent;
  }

  // Fallback si pas de template ni de contenu fourni
  emailSubject = emailSubject || 'Test email - FitMyCV';
  emailHtml = emailHtml || defaultTestHtml();

  const result = await sendEmail({
    to: recipientEmail,
    subject: emailSubject,
    html: emailHtml,
  });

  // 6. Logger dans EmailLog
  await prisma.emailLog.create({
    data: {
      templateId: templateId || null,
      templateName: templateId ? 'template_test' : 'test_email',
      recipientEmail,
      recipientUserId: session.user.id,
      subject: emailSubject,
      status: result.success ? 'sent' : 'failed',
      error: result.error || null,
      provider: result.provider || 'unknown',
      providerId: result.messageId || null,
      isTestEmail: true,
    },
  });

  // 7. Retourner résultat
  if (!result.success) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  return Response.json({
    success: true,
    messageId: result.messageId,
    provider: result.provider,
  });
}

function defaultTestHtml() {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h1 style="color: #10b981;">Test Email FitMyCV</h1>
      <p>Cet email a été envoyé depuis le panneau d'administration.</p>
      <p>Date: ${new Date().toLocaleString('fr-FR')}</p>
      <hr>
      <p style="color: #666; font-size: 12px;">
        Provider: SMTP OVH (primary) / Resend (fallback)
      </p>
    </div>
  `;
}
