import { redirect } from 'next/navigation';
import { verifyEmailChangeToken, deleteEmailChangeRequest } from '@/lib/email/emailService';
import EmailVerificationError from '@/components/auth/EmailVerificationError';
import logger from '@/lib/security/secureLogger';
import prisma from '@/lib/prisma';

export const metadata = {
  title: "Vérification de changement d'email - FitMyCV.io",
  description: "Confirmation de votre nouvelle adresse email",
};

/**
 * Server Component pour vérification du changement d'email
 */
export default async function VerifyEmailChangePage({ searchParams }) {
  const token = searchParams?.token;

  // Pas de token = rediriger vers compte avec erreur
  if (!token) {
    redirect('/account?error=token-missing');
  }

  // Vérifier le token côté serveur
  const verification = await verifyEmailChangeToken(token);

  if (!verification.valid) {
    // Afficher la page d'erreur (Server Component)
    return <EmailVerificationError message={verification.error || 'Token invalide'} />;
  }

  // Vérifier que la nouvelle adresse n'est pas déjà utilisée
  const existing = await prisma.user.findFirst({
    where: {
      email: verification.newEmail,
      NOT: { id: verification.userId },
    },
  });

  if (existing) {
    await deleteEmailChangeRequest(token);
    return <EmailVerificationError message="Cette adresse email est déjà utilisée par un autre compte." />;
  }

  // Mettre à jour l'email de l'utilisateur
  try {
    await prisma.user.update({
      where: { id: verification.userId },
      data: {
        email: verification.newEmail,
        emailVerified: new Date(), // Marquer comme vérifié
      },
    });

    await deleteEmailChangeRequest(token);
    logger.context('verify-email-change', 'info', `Email changé avec succès pour user ${verification.userId}`);
  } catch (error) {
    logger.error('[verify-email-change] Erreur lors de la mise à jour:', error);
    return <EmailVerificationError message="Erreur lors de la modification de l'email" />;
  }

  // Rediriger vers la page de compte avec un message de succès
  redirect('/account?email-changed=true');
}
