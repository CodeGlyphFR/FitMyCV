import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// Test data for variable substitution
const TEST_DATA = {
  userName: 'Jean Dupont (Test)',
  verificationUrl: `${SITE_URL}/auth/verify-email?token=test-token-123`,
  resetUrl: `${SITE_URL}/auth/reset-password?token=test-token-456`,
  newEmail: 'nouveau.email@test.com',
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

    // Get template
    const template = await prisma.emailTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Substitute test variables
    const html = substituteVariables(template.htmlContent, TEST_DATA);
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
