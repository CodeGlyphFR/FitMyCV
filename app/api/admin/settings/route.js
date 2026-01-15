import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import dbEmitter from '@/lib/events/dbEmitter';

/**
 * GET /api/admin/settings
 * Get all settings
 * Query params:
 *   - category: Filter by category (optional)
 */
export async function GET(request) {
  try {
    const session = await auth();

    // Only admin can access settings
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const where = category ? { category } : {};

    const settings = await prisma.setting.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { settingName: 'asc' },
      ],
    });

    return NextResponse.json({ settings });

  } catch (error) {
    console.error('[Settings API] Error getting settings:', error);
    return NextResponse.json(
      { error: 'Failed to get settings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/settings
 * Create a new setting
 */
export async function POST(request) {
  try {
    const session = await auth();

    // Only admin can create settings
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { settingName, value, category, description } = body;

    // Validation
    if (!settingName || !value || !category) {
      return NextResponse.json(
        { error: 'settingName, value, and category are required' },
        { status: 400 }
      );
    }

    // Check if setting already exists
    const existing = await prisma.setting.findUnique({
      where: { settingName },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Setting with this name already exists' },
        { status: 409 }
      );
    }

    const setting = await prisma.setting.create({
      data: {
        settingName,
        value,
        category,
        description: description || null,
      },
    });

    // Émettre l'événement SSE pour notifier tous les clients (broadcast)
    dbEmitter.emitSettingsUpdate({
      action: 'created',
      settingName,
      category,
    });

    return NextResponse.json({ setting }, { status: 201 });

  } catch (error) {
    console.error('[Settings API] Error creating setting:', error);
    return NextResponse.json(
      { error: 'Failed to create setting' },
      { status: 500 }
    );
  }
}
