import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/email-templates
 * Get all email templates with their triggers
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

    const { searchParams } = new URL(request.url);
    const triggerId = searchParams.get('triggerId');

    const whereClause = triggerId ? { triggerId } : {};

    const templates = await prisma.emailTemplate.findMany({
      where: whereClause,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: {
        trigger: {
          select: {
            id: true,
            name: true,
            label: true,
            category: true,
            icon: true,
          },
        },
      },
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
    const { name, subject, designJson, htmlContent, variables, triggerId } =
      body;

    if (!name || !subject) {
      return NextResponse.json(
        { error: 'name and subject are required' },
        { status: 400 }
      );
    }

    // If triggerId is provided, verify it exists and get its variables
    let templateVariables = variables || '[]';
    if (triggerId) {
      const trigger = await prisma.emailTrigger.findUnique({
        where: { id: triggerId },
      });
      if (!trigger) {
        return NextResponse.json(
          { error: 'Trigger not found' },
          { status: 404 }
        );
      }
      // Use trigger's variables if not explicitly provided
      if (!variables) {
        templateVariables = trigger.variables;
      }
    }

    const template = await prisma.emailTemplate.create({
      data: {
        name,
        subject,
        designJson:
          designJson || JSON.stringify({ type: 'doc', content: [] }),
        htmlContent: htmlContent || '',
        variables: templateVariables,
        triggerId: triggerId || null,
        isActive: false, // New templates are inactive by default
      },
      include: {
        trigger: true,
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
