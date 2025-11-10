import CookieSettings from '@/components/cookies/CookieSettings';

export const metadata = {
  title: 'Gestion des cookies',
  description: 'Gérez vos préférences de cookies conformément au RGPD',
};

export default function CookiesPage() {
  return <CookieSettings />;
}