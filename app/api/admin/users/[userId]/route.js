import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { deleteUserCompletely, validateUserEmailManually } from '@/lib/admin/userManagement';

/**
 * PATCH /api/admin/users/[userId]
 * Modifie un utilisateur (rôle, email, ou validation manuelle d'email)
 * Body:
 * - { action: 'updateRole', role: 'USER' | 'ADMIN' }
 * - { action: 'updateEmail', email: 'new@email.com' }
 * - { action: 'validateEmail' }
 */
export async function PATCH(request, { params }) {
  try {
    const session = await auth();

    // Vérifier que l'utilisateur est admin
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { userId } = params;
    const body = await request.json();
    const { action, role, email } = body;

    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur introuvable' },
        { status: 404 }
      );
    }

    // Action: Modifier le rôle
    if (action === 'updateRole') {
      if (!role || !['USER', 'ADMIN'].includes(role)) {
        return NextResponse.json(
          { error: 'Rôle invalide (USER ou ADMIN attendu)' },
          { status: 400 }
        );
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          emailVerified: true,
        },
      });

      return NextResponse.json({
        success: true,
        user: updatedUser,
      });
    }

    // Action: Modifier l'email
    if (action === 'updateEmail') {
      if (!email || typeof email !== 'string') {
        return NextResponse.json(
          { error: 'Email invalide' },
          { status: 400 }
        );
      }

      const emailLower = email.toLowerCase().trim();

      // Vérifier que le nouvel email n'est pas déjà utilisé
      const existingUser = await prisma.user.findUnique({
        where: { email: emailLower },
      });

      if (existingUser && existingUser.id !== userId) {
        return NextResponse.json(
          { error: 'Cet email est déjà utilisé par un autre utilisateur' },
          { status: 400 }
        );
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          email: emailLower,
          // Réinitialiser emailVerified si l'admin change l'email
          emailVerified: null,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          emailVerified: true,
        },
      });

      return NextResponse.json({
        success: true,
        user: updatedUser,
      });
    }

    // Action: Valider l'email manuellement
    if (action === 'validateEmail') {
      const result = await validateUserEmailManually(userId);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      const updatedUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          emailVerified: true,
        },
      });

      return NextResponse.json({
        success: true,
        user: updatedUser,
      });
    }

    // Action inconnue
    return NextResponse.json(
      { error: 'Action invalide (updateRole, updateEmail, ou validateEmail attendu)' },
      { status: 400 }
    );

  } catch (error) {
    console.error('[Admin API] Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[userId]
 * Supprime complètement un utilisateur (DB + fichiers)
 */
export async function DELETE(request, { params }) {
  try {
    const session = await auth();

    // Vérifier que l'utilisateur est admin
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { userId } = params;

    // Empêcher un admin de se supprimer lui-même
    if (session.user.id === userId) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas supprimer votre propre compte' },
        { status: 400 }
      );
    }

    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur introuvable' },
        { status: 404 }
      );
    }

    // Supprimer complètement l'utilisateur
    const result = await deleteUserCompletely(userId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Utilisateur ${user.email} supprimé avec succès`,
    });

  } catch (error) {
    console.error('[Admin API] Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
