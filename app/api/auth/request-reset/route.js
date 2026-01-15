import { NextResponse } from 'next/server';
import { createPasswordResetToken, sendPasswordResetEmail } from '@/lib/email/emailService';
import prisma from '@/lib/prisma';
import { verifyRecaptcha } from '@/lib/recaptcha/verifyRecaptcha';
import { CommonErrors, AuthErrors } from '@/lib/api/apiErrors';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { email, recaptchaToken } = await request.json();

    // Vérification reCAPTCHA (optionnelle pour compatibilité, mais recommandée)
    if (recaptchaToken) {
      const recaptchaResult = await verifyRecaptcha(recaptchaToken, {
        callerName: 'request-reset',
        scoreThreshold: 0.5,
      });

      if (!recaptchaResult.success) {
        return AuthErrors.recaptchaFailed();
      }
    }

    // Validation basique
    if (!email || typeof email !== 'string') {
      return AuthErrors.emailRequired();
    }

    // Normaliser l'email
    const normalizedEmail = email.toLowerCase().trim();

    // Créer le token de réinitialisation
    const result = await createPasswordResetToken(normalizedEmail);

    // Si l'utilisateur est OAuth uniquement
    if (!result.success && result.error === 'oauth_only') {
      return AuthErrors.oauthOnly();
    }

    // Si le token a été créé avec succès et qu'on a un userId
    if (result.success && result.token && result.userId) {
      // Récupérer le nom de l'utilisateur pour l'email
      const user = await prisma.user.findUnique({
        where: { id: result.userId },
        select: { name: true, email: true },
      });

      if (user) {
        // Envoyer l'email
        const emailResult = await sendPasswordResetEmail({
          email: user.email,
          name: user.name || 'Utilisateur',
          token: result.token,
        });

        if (!emailResult.success) {
          console.error('[request-reset] Erreur lors de l\'envoi de l\'email:', emailResult.error);
          return CommonErrors.serverError();
        }
      }
    }

    // Toujours retourner un succès pour ne pas révéler si l'email existe ou non
    return NextResponse.json({
      success: true,
      message: 'Si cet email existe, un lien de réinitialisation a été envoyé.'
    });

  } catch (error) {
    console.error('[request-reset] Erreur:', error);
    return CommonErrors.serverError();
  }
}
