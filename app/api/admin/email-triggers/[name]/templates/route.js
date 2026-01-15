import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/email-triggers/[name]/templates
 * Get all templates for a specific trigger
 */
export async function GET(request, { params }) {
  try {
    const session = await auth();

    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { name } = await params;

    // Find the trigger
    const trigger = await prisma.emailTrigger.findUnique({
      where: { name },
    });

    if (!trigger) {
      return NextResponse.json({ error: 'Trigger not found' }, { status: 404 });
    }

    // Get all templates for this trigger
    const templates = await prisma.emailTemplate.findMany({
      where: { triggerId: trigger.id },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    });

    return NextResponse.json({
      trigger: {
        id: trigger.id,
        name: trigger.name,
        label: trigger.label,
        description: trigger.description,
        variables: JSON.parse(trigger.variables),
        category: trigger.category,
        icon: trigger.icon,
      },
      templates,
    });
  } catch (error) {
    console.error('[Trigger Templates API] Error getting templates:', error);
    return NextResponse.json(
      { error: 'Failed to get trigger templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/email-triggers/[name]/templates
 * Create a new template for a specific trigger
 *
 * Body params:
 * - name: string (required) - Template name
 * - subject: string (required) - Email subject
 * - copyFromTemplateId: string (optional) - ID of template to copy content from
 * - designJson: string (optional) - Maily/TipTap JSON content
 * - htmlContent: string (optional) - Rendered HTML content
 */
export async function POST(request, { params }) {
  try {
    const session = await auth();

    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { name: triggerName } = await params;
    const body = await request.json();
    const { name, subject, designJson, htmlContent, copyFromTemplateId } = body;

    if (!name || !subject) {
      return NextResponse.json(
        { error: 'name and subject are required' },
        { status: 400 }
      );
    }

    // Find the trigger
    const trigger = await prisma.emailTrigger.findUnique({
      where: { name: triggerName },
    });

    if (!trigger) {
      return NextResponse.json({ error: 'Trigger not found' }, { status: 404 });
    }

    // Determine initial content
    let initialDesignJson = designJson || JSON.stringify({ type: 'doc', content: [] });
    let initialHtmlContent = htmlContent || '';

    // If copyFromTemplateId is provided, copy content from that template
    if (copyFromTemplateId) {
      // Special case: 'default' means copy from the default template
      let sourceTemplate;
      if (copyFromTemplateId === 'default') {
        sourceTemplate = await prisma.emailTemplate.findFirst({
          where: { isDefault: true },
        });
      } else {
        sourceTemplate = await prisma.emailTemplate.findUnique({
          where: { id: copyFromTemplateId },
        });
      }

      if (sourceTemplate) {
        initialDesignJson = sourceTemplate.designJson;
        initialHtmlContent = sourceTemplate.htmlContent;
      }
    }

    // Create the template
    const template = await prisma.emailTemplate.create({
      data: {
        name,
        subject,
        designJson: initialDesignJson,
        htmlContent: initialHtmlContent,
        variables: trigger.variables, // Copy variables from trigger
        triggerId: trigger.id,
        isActive: false, // New templates are inactive by default
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('[Trigger Templates API] Error creating template:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
