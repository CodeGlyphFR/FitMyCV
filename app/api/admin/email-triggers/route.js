import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/email-triggers
 * Get all email triggers with their active template
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

    const triggers = await prisma.emailTrigger.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: {
        templates: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    // Format response with activeTemplate info
    const formattedTriggers = triggers.map((trigger) => ({
      id: trigger.id,
      name: trigger.name,
      label: trigger.label,
      description: trigger.description,
      variables: JSON.parse(trigger.variables),
      category: trigger.category,
      icon: trigger.icon,
      isSystem: trigger.isSystem,
      activeTemplate: trigger.templates[0] || null,
      hasActiveTemplate: trigger.templates.length > 0,
    }));

    return NextResponse.json({ triggers: formattedTriggers });
  } catch (error) {
    console.error('[Email Triggers API] Error getting triggers:', error);
    return NextResponse.json(
      { error: 'Failed to get email triggers' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/email-triggers
 * Create a new custom email trigger (non-system)
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
    const { name, label, description, variables, category, icon } = body;

    if (!name || !label) {
      return NextResponse.json(
        { error: 'name and label are required' },
        { status: 400 }
      );
    }

    // Check if trigger already exists
    const existing = await prisma.emailTrigger.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Trigger with this name already exists' },
        { status: 409 }
      );
    }

    const trigger = await prisma.emailTrigger.create({
      data: {
        name,
        label,
        description: description || null,
        variables: JSON.stringify(variables || []),
        category: category || 'custom',
        icon: icon || null,
        isSystem: false, // Custom triggers are not system triggers
      },
    });

    return NextResponse.json(
      {
        trigger: {
          ...trigger,
          variables: JSON.parse(trigger.variables),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Email Triggers API] Error creating trigger:', error);
    return NextResponse.json(
      { error: 'Failed to create email trigger' },
      { status: 500 }
    );
  }
}
