import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/email-templates/[id]
 * Get a specific email template
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

    const { id } = await params;

    const template = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ template });

  } catch (error) {
    console.error('[Email Templates API] Error getting template:', error);
    return NextResponse.json(
      { error: 'Failed to get email template' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/email-templates/[id]
 * Update an email template
 */
export async function PUT(request, { params }) {
  try {
    const session = await auth();

    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { subject, designJson, htmlContent, isActive } = body;

    // Verify template exists
    const existing = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    const updateData = {};
    if (subject !== undefined) updateData.subject = subject;
    if (designJson !== undefined) updateData.designJson = designJson;
    if (htmlContent !== undefined) updateData.htmlContent = htmlContent;
    if (isActive !== undefined) updateData.isActive = isActive;

    const template = await prisma.emailTemplate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ template });

  } catch (error) {
    console.error('[Email Templates API] Error updating template:', error);
    return NextResponse.json(
      { error: 'Failed to update email template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/email-templates/[id]
 * Delete an email template
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

    // Verify template exists
    const existing = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    await prisma.emailTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Email Templates API] Error deleting template:', error);
    return NextResponse.json(
      { error: 'Failed to delete email template' },
      { status: 500 }
    );
  }
}
