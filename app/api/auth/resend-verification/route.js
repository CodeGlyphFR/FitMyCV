import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { createVerificationToken, sendVerificationEmail, isEmailVerified } from '@/lib/email/emailService';
import logger from '@/lib/security/secureLogger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Vérifier si l'email n'est pas déjà vérifié
    const verified = await isEmailVerified(userId);
    if (verified) {
      return NextResponse.json(
        { error: 'Email déjà vérifié' },
        { status: 400 }
      );
    }

    // Récupérer les infos utilisateur
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (!user?.email) {
      return NextResponse.json(
        { error: 'Email introuvable' },
        { status: 404 }
      );
    }

    // Rate limiting: vérifier qu'on n'a pas envoyé trop récemment
    const recentToken = await prisma.emailVerificationToken.findFirst({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 60 * 1000), // Moins de 1 minute
        },
      },
    });

    if (recentToken) {
      return NextResponse.json(
        { error: 'Veuillez attendre avant de renvoyer un email' },
        { status: 429 }
      );
    }

    // Créer un nouveau token
    const token = await createVerificationToken(userId);

    // Envoyer l'email
    const result = await sendVerificationEmail({
      email: user.email,
      name: user.name || 'Utilisateur',
      token,
    });

    if (!result.success) {
      logger.error('[resend-verification] Échec envoi email:', result.error);
      return NextResponse.json(
        { error: 'Impossible d\'envoyer l\'email' },
        { status: 500 }
      );
    }

    logger.context('resend-verification', 'info', `Email de vérification renvoyé à ${user.email}`);

    return NextResponse.json({
      success: true,
      message: 'Email de vérification envoyé',
    });
  } catch (error) {
    logger.error('[resend-verification] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur interne' },
      { status: 500 }
    );
  }
}
