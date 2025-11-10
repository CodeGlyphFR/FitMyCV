import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/openai-alerts
 * Retrieve all OpenAI alert configurations
 */
export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const alerts = await prisma.openAIAlert.findMany({
      orderBy: {
        type: 'asc',
      },
    });

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('[API /admin/openai-alerts GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/openai-alerts
 * Create or update an OpenAI alert configuration
 *
 * Body:
 * {
 *   id?: string,  // If provided, update existing alert
 *   type: string,  // "user_daily", "user_monthly", "global_daily", etc.
 *   threshold: number,
 *   enabled: boolean,
 *   name: string,
 *   description?: string
 * }
 */
export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, type, threshold, enabled, name, description } = body;

    // Validate required fields
    if (!type || threshold === undefined || enabled === undefined || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: type, threshold, enabled, name' },
        { status: 400 }
      );
    }

    // Validate threshold
    if (threshold < 0) {
      return NextResponse.json(
        { error: 'Threshold must be a positive number' },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['user_daily', 'user_monthly', 'global_daily', 'global_monthly', 'feature_daily'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    let alert;
    if (id) {
      // Update existing alert
      alert = await prisma.openAIAlert.update({
        where: { id },
        data: {
          type,
          threshold,
          enabled,
          name,
          description: description || null,
        },
      });
    } else {
      // Create new alert
      alert = await prisma.openAIAlert.create({
        data: {
          type,
          threshold,
          enabled,
          name,
          description: description || null,
        },
      });
    }

    return NextResponse.json({ alert }, { status: 200 });
  } catch (error) {
    console.error('[API /admin/openai-alerts POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/openai-alerts/:id
 * Delete an OpenAI alert configuration
 */
export async function DELETE(request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing id parameter' },
        { status: 400 }
      );
    }

    await prisma.openAIAlert.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /admin/openai-alerts DELETE] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
