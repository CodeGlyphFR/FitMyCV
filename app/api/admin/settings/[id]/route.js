import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { clearAiModelCache } from '@/lib/settings/aiModels';

/**
 * PUT /api/admin/settings/[id]
 * Update a setting
 */
export async function PUT(request, { params }) {
  try {
    const session = await auth();

    // Only admin can update settings
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const { value, category, description } = body;

    // Check if setting exists
    const existing = await prisma.setting.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Setting not found' },
        { status: 404 }
      );
    }

    // Update setting
    const updateData = {};
    if (value !== undefined) updateData.value = value;
    if (category !== undefined) updateData.category = category;
    if (description !== undefined) updateData.description = description;

    const setting = await prisma.setting.update({
      where: { id },
      data: updateData,
    });

    // Vider le cache des modèles IA si on modifie un setting de modèle
    if (existing.category === 'ai_models') {
      clearAiModelCache();
      console.log(`[Settings API] Cache des modèles IA vidé après modification de ${existing.settingName}`);
    }

    return NextResponse.json({ setting });

  } catch (error) {
    console.error('[Settings API] Error updating setting:', error);
    return NextResponse.json(
      { error: 'Failed to update setting' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/settings/[id]
 * Delete a setting
 */
export async function DELETE(request, { params }) {
  try {
    const session = await auth();

    // Only admin can delete settings
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { id } = params;

    // Check if setting exists
    const existing = await prisma.setting.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Setting not found' },
        { status: 404 }
      );
    }

    await prisma.setting.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Settings API] Error deleting setting:', error);
    return NextResponse.json(
      { error: 'Failed to delete setting' },
      { status: 500 }
    );
  }
}
