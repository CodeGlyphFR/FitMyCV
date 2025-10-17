import { redirect } from 'next/navigation';
import { verifyToken, deleteVerificationToken, markEmailAsVerified } from '@/lib/email/emailService';
import { createAutoSignInToken } from '@/lib/auth/autoSignIn';
import EmailVerificationError from '@/components/auth/EmailVerificationError';
import logger from '@/lib/security/secureLogger';

export const metadata = {
  title: "Vérification d'email - FitMyCv.ai",
  description: "Vérification de votre adresse email",
};

/**
 * Server Component pour vérification email
 * Aucun JavaScript client ne se charge = pas de loading visible
 */
export default async function VerifyEmailPage({ searchParams }) {
  const token = searchParams?.token;

  // Pas de token = rediriger vers auth avec erreur
  if (!token) {
    redirect('/auth?error=token-missing');
  }

  // Vérifier le token côté serveur
  const verification = await verifyToken(token);

  if (!verification.valid) {
    // Afficher la page d'erreur (Server Component)
    return <EmailVerificationError message={verification.error || 'Token invalide'} />;
  }

  // Marquer l'email comme vérifié
  try {
    await markEmailAsVerified(verification.userId);
    await deleteVerificationToken(token);
    logger.context('verify-email', 'info', `Email vérifié avec succès pour user ${verification.userId}`);
  } catch (error) {
    logger.error('[verify-email] Erreur lors de la mise à jour:', error);
    return <EmailVerificationError message="Erreur lors de la vérification" />;
  }

  // Créer un token de connexion automatique
  let autoSignInToken;
  try {
    autoSignInToken = await createAutoSignInToken(verification.userId);
  } catch (error) {
    logger.error('[verify-email] Erreur création token auto-signin:', error);
    return <EmailVerificationError message="Erreur lors de la connexion automatique" />;
  }

  // Rediriger vers la page de connexion automatique
  // IMPORTANT: redirect() doit être en dehors du try/catch car il lance une exception pour fonctionner
  redirect(`/auth/complete-signin?token=${autoSignInToken}`);
}
