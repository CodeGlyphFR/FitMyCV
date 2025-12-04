import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { verifyPasswordResetToken, deletePasswordResetToken } from '@/lib/email/emailService';
import { validatePassword } from '@/lib/security/passwordPolicy';
import prisma from '@/lib/prisma';
import { CommonErrors, AuthErrors } from '@/lib/api/apiErrors';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { token, password } = await request.json();

    // Validation basique
    if (!token || typeof token !== 'string') {
      return AuthErrors.tokenRequired();
    }

    if (!password || typeof password !== 'string') {
      return AuthErrors.passwordRequired();
    }

    // Validation de la force du mot de passe
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return AuthErrors.passwordWeak();
    }

    // Vérifier le token
    const tokenResult = await verifyPasswordResetToken(token);

    if (!tokenResult.valid) {
      return AuthErrors.tokenInvalid();
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
    return CommonErrors.serverError();
  }
}
