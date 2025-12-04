import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/email-templates
 * Get all email templates
 */
export async function GET(request) {
  try {
    const session = await auth();

    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const templates = await prisma.emailTemplate.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ templates });

  } catch (error) {
    console.error('[Email Templates API] Error getting templates:', error);
    return NextResponse.json(
      { error: 'Failed to get email templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/email-templates
 * Create a new email template
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
    const { name, subject, designJson, htmlContent, variables } = body;

    if (!name || !subject || !htmlContent) {
      return NextResponse.json(
        { error: 'name, subject, and htmlContent are required' },
        { status: 400 }
      );
    }

    // Check if template already exists
    const existing = await prisma.emailTemplate.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Template with this name already exists' },
        { status: 409 }
      );
    }

    const template = await prisma.emailTemplate.create({
      data: {
        name,
        subject,
        designJson: designJson || JSON.stringify({ body: { rows: [] } }),
        htmlContent,
        variables: variables || '[]',
      },
    });

    return NextResponse.json({ template }, { status: 201 });

  } catch (error) {
    console.error('[Email Templates API] Error creating template:', error);
    return NextResponse.json(
      { error: 'Failed to create email template' },
      { status: 500 }
    );
  }
}
