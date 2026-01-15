import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { CommonErrors } from '@/lib/api/apiErrors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PUT /api/export-templates/[id]
 * Met à jour un template d'export
 */
export async function PUT(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return CommonErrors.notAuthenticated();
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) return CommonErrors.invalidPayload();

    // Vérifier propriété du template
    const existing = await prisma.exportTemplate.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Template non trouvé' }, { status: 404 });
    }

    // Préparer les données de mise à jour
    const updateData = {};

    if (body.name !== undefined) {
      const trimmedName = body.name.trim();
      if (!trimmedName) {
        return NextResponse.json(
          { error: 'Le nom du template est requis' },
          { status: 400 }
        );
      }

      // Vérifier si un autre template a déjà ce nom
      if (trimmedName !== existing.name) {
        const duplicate = await prisma.exportTemplate.findFirst({
          where: {
            userId: session.user.id,
            name: trimmedName,
            id: { not: id },
          },
        });

        if (duplicate) {
          return NextResponse.json(
            { error: 'Un template avec ce nom existe déjà', code: 'DUPLICATE_NAME' },
            { status: 400 }
          );
        }
      }

      updateData.name = trimmedName;
    }

    if (body.selections !== undefined) {
      updateData.selections = body.selections;
    }

    const template = await prisma.exportTemplate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ ok: true, template });
  } catch (error) {
    console.error('[export-templates] PUT Error:', error);
    return CommonErrors.serverError();
  }
}

/**
 * DELETE /api/export-templates/[id]
 * Supprime un template d'export
 */
export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return CommonErrors.notAuthenticated();
  }

  try {
    const { id } = await params;

    // Vérifier propriété du template
    const existing = await prisma.exportTemplate.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Template non trouvé' }, { status: 404 });
    }

    await prisma.exportTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[export-templates] DELETE Error:', error);
    return CommonErrors.serverError();
  }
}
