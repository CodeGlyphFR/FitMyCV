import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { verifyPasswordResetToken, deletePasswordResetToken } from '@/lib/email/emailService';
import { validatePassword } from '@/lib/security/passwordPolicy';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { token, password } = await request.json();

    // Validation basique
    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Token requis' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Mot de passe requis' },
        { status: 400 }
      );
    }

    // Validation de la force du mot de passe
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        {
          error: 'Mot de passe trop faible',
          details: passwordValidation.errors
        },
        { status: 400 }
      );
    }

    // Vérifier le token
    const tokenResult = await verifyPasswordResetToken(token);

    if (!tokenResult.valid) {
      return NextResponse.json(
        { error: tokenResult.error || 'Token invalide ou expiré' },
        { status: 400 }
      );
    }

    // Hasher le nouveau mot de passe
    const passwordHash = await bcrypt.hash(password, 10);

    // Mettre à jour le mot de passe de l'utilisateur
    await prisma.user.update({
      where: { id: tokenResult.userId },
      data: { passwordHash },
    });

    // Supprimer le token de réinitialisation
    await deletePasswordResetToken(tokenResult.userId);

    return NextResponse.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès'
    });

  } catch (error) {
    console.error('[reset-password] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
