import { redirect } from 'next/navigation';
import { verifyToken, deleteVerificationToken, markEmailAsVerified } from '@/lib/email/emailService';
import EmailVerificationError from '@/components/auth/EmailVerificationError';
import logger from '@/lib/security/secureLogger';

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

  try {
    // Vérifier le token côté serveur
    const verification = await verifyToken(token);

    if (!verification.valid) {
      // Afficher la page d'erreur (Server Component)
      return <EmailVerificationError message={verification.error || 'Token invalide'} />;
    }

    // Marquer l'email comme vérifié
    await markEmailAsVerified(verification.userId);

    // Supprimer le token utilisé
    await deleteVerificationToken(token);

    logger.context('verify-email', 'info', `Email vérifié avec succès pour user ${verification.userId}`);

    // Rediriger côté serveur (HTTP 307) - INSTANTANÉ, pas de loading !
    redirect('/');
  } catch (error) {
    logger.error('[verify-email] Erreur:', error);
    return <EmailVerificationError message="Erreur lors de la vérification" />;
  }
}
