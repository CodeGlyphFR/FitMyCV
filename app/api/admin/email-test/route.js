import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { Resend } from 'resend';
import { render } from '@maily-to/render';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@fitmycv.io';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// Test data for variable substitution
const TEST_DATA = {
  userName: 'Jean Dupont (Test)',
  verificationUrl: `${SITE_URL}/auth/verify-email?token=test-token-123`,
  resetUrl: `${SITE_URL}/auth/reset-password?token=test-token-456`,
  newEmail: 'nouveau.email@test.com',
  loginUrl: `${SITE_URL}/auth/signin`,
  creditsAmount: '50',
  totalPrice: '9,99 €',
  invoiceUrl: 'https://invoice.stripe.com/i/example-test-invoice',
};

/**
 * Substitute variables in HTML content
 */
function substituteVariables(html, variables) {
  let result = html;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

/**
 * POST /api/admin/email-test
 * Send a test email
 */
export async function POST(request) {
  try {
    const session = await auth();

    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { templateId, testEmail } = body;

    if (!templateId || !testEmail) {
      return NextResponse.json(
        { error: 'templateId and testEmail are required' },
        { status: 400 }
      );
    }

    // Get template with trigger
    const template = await prisma.emailTemplate.findUnique({
      where: { id: templateId },
      include: { trigger: true },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Render HTML from designJson (Maily.to) if available, otherwise use htmlContent
    let html;
    if (template.designJson && template.designJson !== '{}' && template.designJson !== '{"type":"doc","content":[]}') {
      try {
        const designJson = typeof template.designJson === 'string'
          ? JSON.parse(template.designJson)
          : template.designJson;

        // Extract backgroundColor from designJson (default to white)
        const backgroundColor = designJson.backgroundColor || '#ffffff';

        // Remove backgroundColor from json before rendering (not a TipTap property)
        const { backgroundColor: _, ...contentJson } = designJson;

        // Render the content
        const contentHtml = await render(contentJson);

        // Wrap with background color styles (same pattern as EmailTemplatesTab preview/save)
        // Note: We exclude buttons (a tags) from the transparent rule to preserve button backgrounds
        html = `<!DOCTYPE html>
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
      } catch (renderError) {
        console.warn('[Email Test API] Failed to render Maily template, falling back to htmlContent:', renderError);
        html = template.htmlContent;
      }
    } else {
      html = template.htmlContent;
    }

    // Substitute test variables
    html = substituteVariables(html, TEST_DATA);
    const subject = `[TEST] ${substituteVariables(template.subject, TEST_DATA)}`;

    // Send via Resend
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: testEmail,
      subject,
      html,
    });

    // Log the test email
    await prisma.emailLog.create({
      data: {
        templateId,
        templateName: template.name,
        recipientEmail: testEmail,
        subject,
        status: error ? 'failed' : 'sent',
        error: error?.message || null,
        resendId: data?.id || null,
        isTestEmail: true,
      },
    });

    if (error) {
      console.error('[Email Test API] Resend error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to send test email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${testEmail}`,
      resendId: data?.id,
    });

  } catch (error) {
    console.error('[Email Test API] Error sending test email:', error);
    return NextResponse.json(
      { error: 'Failed to send test email' },
      { status: 500 }
    );
  }
}
