import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

/**
 * POST /api/admin/email-templates/[id]/activate
 * Activate a template (deactivates other templates for the same trigger)
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

    const { id } = await params;

    // Find the template
    const template = await prisma.emailTemplate.findUnique({
      where: { id },
      include: { trigger: true },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    if (!template.triggerId) {
      return NextResponse.json(
        { error: 'Template is not associated with a trigger' },
        { status: 400 }
      );
    }

    // Use a transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Deactivate all other templates for this trigger
      await tx.emailTemplate.updateMany({
        where: {
          triggerId: template.triggerId,
          id: { not: id },
        },
        data: { isActive: false },
      });

      // Activate this template
      await tx.emailTemplate.update({
        where: { id },
        data: { isActive: true },
      });
    });

    // Fetch updated template
    const updatedTemplate = await prisma.emailTemplate.findUnique({
      where: { id },
      include: { trigger: true },
    });

    return NextResponse.json({
      template: updatedTemplate,
      message: `Template "${template.name}" is now active for trigger "${template.trigger?.name}"`,
    });
  } catch (error) {
    console.error('[Activate Template API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to activate template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/email-templates/[id]/activate
 * Deactivate a template
 */
export async function DELETE(request, { params }) {
  try {
    const session = await auth();

    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Find and deactivate the template
    const template = await prisma.emailTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({
      template,
      message: `Template "${template.name}" has been deactivated`,
    });
  } catch (error) {
    console.error('[Deactivate Template API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate template' },
      { status: 500 }
    );
  }
}
