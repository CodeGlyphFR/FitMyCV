import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { CommonErrors } from '@/lib/api/apiErrors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/export-templates
 * Liste tous les templates d'export de l'utilisateur
 */
export async function GET(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return CommonErrors.notAuthenticated();
  }

  try {
    const templates = await prisma.exportTemplate.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        selections: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('[export-templates] GET Error:', error);
    return CommonErrors.serverError();
  }
}

/**
 * POST /api/export-templates
 * Crée un nouveau template d'export
 */
export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return CommonErrors.notAuthenticated();
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body) return CommonErrors.invalidPayload();

    const { name, selections } = body;

    // Validation du nom
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Le nom du template est requis' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();

    // Vérifier si un template avec ce nom existe déjà
    const existing = await prisma.exportTemplate.findFirst({
      where: {
        userId: session.user.id,
        name: trimmedName,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Un template avec ce nom existe déjà', code: 'DUPLICATE_NAME' },
        { status: 400 }
      );
    }

    // Validation des selections
    if (!selections || typeof selections !== 'object') {
      return NextResponse.json(
        { error: 'La configuration du template est invalide' },
        { status: 400 }
      );
    }

    const template = await prisma.exportTemplate.create({
      data: {
        userId: session.user.id,
        name: trimmedName,
        selections,
      },
    });

    return NextResponse.json({ ok: true, template }, { status: 201 });
  } catch (error) {
    console.error('[export-templates] POST Error:', error);
    return CommonErrors.serverError();
  }
}
