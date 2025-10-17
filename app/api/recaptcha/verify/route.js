import { NextResponse } from 'next/server';

/**
 * Route API pour vérifier les tokens reCAPTCHA v3
 * POST /api/recaptcha/verify
 *
 * Body: { token: string, action?: string }
 * Returns: { success: boolean, score?: number, error?: string }
 */
export async function POST(request) {
  try {
    const { token, action } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token manquant' },
        { status: 400 }
      );
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;

    if (!secretKey) {
      console.error('[reCAPTCHA] RECAPTCHA_SECRET_KEY n\'est pas défini');
      return NextResponse.json(
        { success: false, error: 'Configuration serveur manquante' },
        { status: 500 }
      );
    }

    // Vérifier le token auprès de Google
    const verificationUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const verificationData = new URLSearchParams({
      secret: secretKey,
      response: token,
    });

    const verificationResponse = await fetch(verificationUrl, {
      method: 'POST',
      body: verificationData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const verificationResult = await verificationResponse.json();

    // Log pour debug (à retirer en production si besoin)
    console.log('[reCAPTCHA] Verification result:', {
      success: verificationResult.success,
      score: verificationResult.score,
      action: verificationResult.action,
      hostname: verificationResult.hostname,
    });

    if (!verificationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Échec de la vérification reCAPTCHA',
          errorCodes: verificationResult['error-codes'],
        },
        { status: 400 }
      );
    }

    // Vérifier l'action si fournie
    if (action && verificationResult.action !== action) {
      return NextResponse.json(
        {
          success: false,
          error: 'Action reCAPTCHA non correspondante',
        },
        { status: 400 }
      );
    }

    // Seuil de score pour reCAPTCHA v3 (0.0 = bot, 1.0 = humain)
    const SCORE_THRESHOLD = 0.5;
    const score = verificationResult.score || 0;

    if (score < SCORE_THRESHOLD) {
      console.warn(`[reCAPTCHA] Score faible détecté: ${score} (seuil: ${SCORE_THRESHOLD})`);
      return NextResponse.json(
        {
          success: false,
          score,
          error: 'Score reCAPTCHA trop faible',
        },
        { status: 403 }
      );
    }

    // Vérification réussie
    return NextResponse.json({
      success: true,
      score,
    });

  } catch (error) {
    console.error('[reCAPTCHA] Erreur lors de la vérification:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur serveur lors de la vérification',
      },
      { status: 500 }
    );
  }
}
