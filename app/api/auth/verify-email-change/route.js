import { NextResponse } from 'next/server';
import { verifyEmailChangeToken, deleteEmailChangeRequest } from '@/lib/email/emailService';
import prisma from '@/lib/prisma';
import logger from '@/lib/security/secureLogger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token manquant' },
        { status: 400 }
      );
    }

    // Vérifier le token
    const verification = await verifyEmailChangeToken(token);

    if (!verification.valid) {
      logger.context('verify-email-change', 'warn', `Échec de vérification: ${verification.error}`);
      return NextResponse.json(
        { error: verification.error || 'Token invalide' },
        { status: 400 }
      );
    }

    // Vérifier que la nouvelle adresse n'est pas déjà utilisée
    const existing = await prisma.user.findFirst({
      where: {
        email: verification.newEmail,
        NOT: { id: verification.userId },
      },
    });

    if (existing) {
      await deleteEmailChangeRequest(token);
      return NextResponse.json(
        { error: 'Cette adresse email est déjà utilisée par un autre compte.' },
        { status: 409 }
      );
    }

    // Mettre à jour l'email de l'utilisateur
    await prisma.user.update({
      where: { id: verification.userId },
      data: {
        email: verification.newEmail,
        emailVerified: new Date(), // Marquer comme vérifié
      },
    });

    // Supprimer la demande de changement
    await deleteEmailChangeRequest(token);

    logger.context('verify-email-change', 'info', `Email changé avec succès pour user ${verification.userId}`);

    return NextResponse.json({
      success: true,
      message: 'Adresse email modifiée avec succès',
    });
  } catch (error) {
    logger.error('[verify-email-change] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la vérification' },
      { status: 500 }
    );
  }
}
