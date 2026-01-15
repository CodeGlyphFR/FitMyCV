import { NextResponse } from 'next/server';
import { verifyToken, deleteVerificationToken, markEmailAsVerified } from '@/lib/email/emailService';
import prisma from '@/lib/prisma';
import logger from '@/lib/security/secureLogger';
import { CommonErrors, AuthErrors } from '@/lib/api/apiErrors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return AuthErrors.tokenRequired();
    }

    // Vérifier le token
    const verification = await verifyToken(token);

    if (!verification.valid) {
      logger.context('verify-email', 'warn', `Échec de vérification: ${verification.error}`);
      return AuthErrors.tokenInvalid();
    }

    // Marquer l'email comme vérifié
    await markEmailAsVerified(verification.userId);

    // Supprimer le token utilisé
    await deleteVerificationToken(token);

    // Récupérer les informations de l'utilisateur pour la connexion automatique
    const user = await prisma.user.findUnique({
      where: { id: verification.userId },
      select: { id: true, email: true, name: true },
    });

    logger.context('verify-email', 'info', `Email vérifié avec succès pour user ${verification.userId}`);

    return NextResponse.json({
      success: true,
      message: 'Email vérifié avec succès',
      user: user, // Retourner les infos utilisateur pour connexion auto
    });
  } catch (error) {
    logger.error('[verify-email] Erreur:', error);
    return CommonErrors.serverError();
  }
}
