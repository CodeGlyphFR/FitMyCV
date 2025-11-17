import { NextResponse } from 'next/server';
import { verifyRecaptcha } from '@/lib/recaptcha/verifyRecaptcha';

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

    // Use the centralized utility
    const result = await verifyRecaptcha(token, {
      callerName: 'recaptcha-api',
      scoreThreshold: 0.5,
      expectedAction: action || null,
    });

    // Handle errors with appropriate status codes
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          errorCodes: result.errorCodes,
          score: result.score,
        },
        { status: result.statusCode || 403 }
      );
    }

    // Success response
    return NextResponse.json({
      success: true,
      score: result.score,
    });

  } catch (error) {
    console.error('[reCAPTCHA API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur serveur lors de la vérification',
      },
      { status: 500 }
    );
  }
}
