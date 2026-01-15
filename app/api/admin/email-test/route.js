import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { sendEmail, isSmtpConfigured, isResendConfigured } from '@/lib/email/transports';
import { render } from '@maily-to/render';

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

        // Render the content with Maily
        html = await render(contentJson);

        // Simple background color replacement - don't overcomplicate
        html = html.replace(/background-color:\s*#ffffff/gi, `background-color:${backgroundColor}`);
        html = html.replace(/background-color:\s*white/gi, `background-color:${backgroundColor}`);
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

    // Check if at least one provider is configured
    if (!isSmtpConfigured() && !isResendConfigured()) {
      return NextResponse.json(
        { error: 'Aucun provider email configuré (SMTP ou Resend)' },
        { status: 500 }
      );
    }

    // Send via transport layer (handles SMTP/Resend selection and fallback)
    const result = await sendEmail({ to: testEmail, subject, html });

    // Log the test email
    await prisma.emailLog.create({
      data: {
        templateId,
        templateName: template.name,
        recipientEmail: testEmail,
        subject,
        status: result.success ? 'sent' : 'failed',
        error: result.error || null,
        provider: result.provider || 'unknown',
        providerId: result.messageId || null,
        isTestEmail: true,
      },
    });

    if (!result.success) {
      console.error('[Email Test API] Send error:', {
        error: result.error,
        provider: result.provider,
        usedFallback: result.usedFallback,
      });
      return NextResponse.json(
        { error: result.error || 'Failed to send test email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${testEmail}`,
      provider: result.provider,
      providerId: result.messageId,
      usedFallback: result.usedFallback || false,
    });

  } catch (error) {
    console.error('[Email Test API] Error sending test email:', error);
    return NextResponse.json(
      { error: 'Failed to send test email' },
      { status: 500 }
    );
  }
}
