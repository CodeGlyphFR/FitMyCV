import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { createVerificationToken, sendVerificationEmail, isEmailVerified } from '@/lib/email/emailService';
import logger from '@/lib/security/secureLogger';
import { verifyRecaptcha } from '@/lib/recaptcha/verifyRecaptcha';
import { CommonErrors, AuthErrors } from '@/lib/api/apiErrors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    // Parse body pour obtenir recaptchaToken (optionnel)
    let recaptchaToken = null;
    try {
      const body = await request.json();
      recaptchaToken = body.recaptchaToken;
    } catch (e) {
      // Body vide ou invalide, pas de recaptchaToken - OK
    }

    // Vérification reCAPTCHA (obligatoire en production)
    if (process.env.NODE_ENV === 'production' && process.env.BYPASS_RECAPTCHA !== 'true') {
      if (!recaptchaToken) {
        return AuthErrors.recaptchaFailed();
      }
    }
    if (recaptchaToken) {
      const recaptchaResult = await verifyRecaptcha(recaptchaToken, {
        callerName: 'resend-verification',
        scoreThreshold: 0.5,
      });

      if (!recaptchaResult.success) {
        return AuthErrors.recaptchaFailed();
      }
    }

    const userId = session.user.id;

    // Vérifier si l'email n'est pas déjà vérifié
    const verified = await isEmailVerified(userId);
    if (verified) {
      return NextResponse.json(
        { error: 'errors.api.auth.emailAlreadyVerified' },
        { status: 400 }
      );
    }

    // Récupérer les infos utilisateur
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (!user?.email) {
      return CommonErrors.notFound('email');
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
        { error: 'errors.api.auth.rateLimitExceeded' },
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
      return CommonErrors.serverError();
    }

    logger.context('resend-verification', 'info', `Email de vérification renvoyé à ${user.email}`);

    return NextResponse.json({
      success: true,
      message: 'Email de vérification envoyé',
    });
  } catch (error) {
    logger.error('[resend-verification] Erreur:', error);
    return CommonErrors.serverError();
  }
}
