import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

/**
 * POST /api/admin/email-templates/[id]/set-default
 * Set a template as the global default template
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

    // Check if template exists
    const template = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Transaction: unset all defaults, then set this one
    await prisma.$transaction([
      // Unset isDefault on all templates
      prisma.emailTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      }),
      // Set isDefault on this template
      prisma.emailTemplate.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    // Fetch updated template
    const updatedTemplate = await prisma.emailTemplate.findUnique({
      where: { id },
      include: { trigger: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Template set as default',
      template: updatedTemplate,
    });

  } catch (error) {
    console.error('[Set Default API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to set template as default' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/email-templates/[id]/set-default
 * Remove the default status from a template
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

    // Check if template exists and is default
    const template = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    if (!template.isDefault) {
      return NextResponse.json(
        { error: 'Template is not set as default' },
        { status: 400 }
      );
    }

    // Remove default status
    const updatedTemplate = await prisma.emailTemplate.update({
      where: { id },
      data: { isDefault: false },
      include: { trigger: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Default status removed',
      template: updatedTemplate,
    });

  } catch (error) {
    console.error('[Set Default API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to remove default status' },
      { status: 500 }
    );
  }
}
