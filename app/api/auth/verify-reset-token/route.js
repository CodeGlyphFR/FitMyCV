import { NextResponse } from 'next/server';
import { verifyPasswordResetToken } from '@/lib/email/emailService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Vérifie si un token de réinitialisation est valide sans le consommer
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'Token manquant' },
        { status: 400 }
      );
    }

    // Vérifier le token
    const result = await verifyPasswordResetToken(token);

    if (!result.valid) {
      return NextResponse.json({
        valid: false,
        error: result.error || 'Token invalide ou expiré'
      });
    }

    return NextResponse.json({
      valid: true,
      message: 'Token valide'
    });

  } catch (error) {
    console.error('[verify-reset-token] Erreur:', error);
    return NextResponse.json(
      { valid: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
