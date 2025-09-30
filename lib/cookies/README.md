# Système de gestion des cookies RGPD

Ce système de gestion des cookies est conforme à la réglementation française (RGPD/CNIL).

## Fonctionnalités

✅ Bannière de consentement au premier chargement
✅ Acceptation/Refus global ou personnalisé
✅ Page de gestion des préférences (`/cookies`)
✅ Expiration automatique du consentement après 6 mois
✅ Cookies sécurisés (HttpOnly, SameSite, Secure en production)
✅ Sessions avec expiration (30 jours)
✅ Hook React pour conditionner le chargement de scripts

## Architecture

```
lib/cookies/
├── consent.js           # Logique de gestion du consentement
├── useCookieConsent.js  # Hook React
└── README.md            # Documentation

components/cookies/
├── CookieBanner.jsx     # Bannière de consentement
└── CookieSettings.jsx   # Page de paramètres

app/cookies/
└── page.jsx             # Route /cookies
```

## Catégories de cookies

### 1. Cookies nécessaires (toujours actifs)
- Authentification (NextAuth)
- Tokens CSRF
- Préférences de base

### 2. Cookies fonctionnels (optionnels)
- Préférences d'interface
- Paramètres d'affichage

### 3. Cookies analytiques (optionnels)
- Google Analytics
- Statistiques anonymisées

### 4. Cookies marketing (optionnels)
- Publicité ciblée
- Remarketing

## Utilisation

### 1. Vérifier le consentement

```javascript
import { isCategoryAccepted, COOKIE_CATEGORIES } from '@/lib/cookies/consent';

if (isCategoryAccepted(COOKIE_CATEGORIES.ANALYTICS)) {
  // Charger Google Analytics
}
```

### 2. Utiliser le hook React

```javascript
'use client';

import { useCookieConsent } from '@/lib/cookies/useCookieConsent';

export default function MyComponent() {
  const { hasConsent, isAnalyticsAccepted, loading } = useCookieConsent();

  if (loading) return <div>Chargement...</div>;

  return (
    <div>
      {isAnalyticsAccepted && (
        <div>Analytics activés</div>
      )}
    </div>
  );
}
```

### 3. Charger un script conditionnel

```javascript
'use client';

import { useConditionalScript } from '@/lib/cookies/useCookieConsent';
import { COOKIE_CATEGORIES } from '@/lib/cookies/consent';

export default function Analytics() {
  useConditionalScript(COOKIE_CATEGORIES.ANALYTICS, () => {
    // Charger Google Analytics uniquement si accepté
    const script = document.createElement('script');
    script.src = 'https://www.googletagmanager.com/gtag/js?id=GA_ID';
    document.head.appendChild(script);
  });

  return null;
}
```

## Configuration NextAuth

Les cookies de session sont configurés avec :
- **Durée de vie** : 30 jours
- **Mise à jour** : toutes les 24h
- **Sécurité** : HttpOnly, SameSite=Lax, Secure en production
- **Noms** : Préfixés `__Secure-` et `__Host-` pour la sécurité

```javascript
// lib/auth/options.js
session: {
  strategy: "jwt",
  maxAge: 30 * 24 * 60 * 60, // 30 jours
  updateAge: 24 * 60 * 60,    // Mise à jour toutes les 24h
}
```

## Conformité RGPD

### Points respectés

✅ **Consentement libre et éclairé** : L'utilisateur peut accepter/refuser
✅ **Granularité** : Choix par catégorie de cookies
✅ **Durée limitée** : 6 mois (recommandation CNIL)
✅ **Révocation** : L'utilisateur peut changer d'avis à tout moment
✅ **Information claire** : Description de chaque catégorie
✅ **Pas de case précochée** : Aucune catégorie optionnelle n'est active par défaut

### Actions utilisateur

- `/cookies` : Page de gestion des préférences
- Footer : Lien permanent vers les paramètres
- Bannière : Réaffichée après expiration du consentement

## API

### `consent.js`

```javascript
// Récupérer le consentement
const consent = getConsent();

// Sauvegarder le consentement
saveConsent({
  necessary: true,
  functional: true,
  analytics: false,
  marketing: false
});

// Accepter tout
acceptAllCookies();

// Refuser tout (sauf nécessaires)
rejectAllCookies();

// Vérifier une catégorie
if (isCategoryAccepted(COOKIE_CATEGORIES.ANALYTICS)) {
  // ...
}

// Réinitialiser
clearConsent();
```

### Hook `useCookieConsent()`

Retourne :
```javascript
{
  consent,                  // Objet du consentement complet
  loading,                  // État de chargement
  hasConsent,              // Boolean : consentement défini
  isNecessaryAccepted,     // Boolean
  isFunctionalAccepted,    // Boolean
  isAnalyticsAccepted,     // Boolean
  isMarketingAccepted      // Boolean
}
```

## Personnalisation

### Modifier la durée de validité

```javascript
// lib/cookies/consent.js
export const CONSENT_DURATION = 12 * 30 * 24 * 60 * 60 * 1000; // 12 mois
```

### Ajouter une catégorie

```javascript
// lib/cookies/consent.js
export const COOKIE_CATEGORIES = {
  NECESSARY: 'necessary',
  FUNCTIONAL: 'functional',
  ANALYTICS: 'analytics',
  MARKETING: 'marketing',
  CUSTOM: 'custom', // Nouvelle catégorie
};
```

Puis mettre à jour `CookieBanner.jsx` et `CookieSettings.jsx`.

## Tests

### Tester la bannière

1. Ouvrir le site en navigation privée
2. La bannière doit s'afficher
3. Tester "Tout accepter" / "Tout refuser" / "Personnaliser"

### Tester l'expiration

```javascript
// Console du navigateur
clearConsent(); // Réinitialise le consentement
```

### Vérifier les cookies

Ouvrir les DevTools → Application → Cookies et vérifier :
- `cookie_consent` : contient les préférences
- `__Secure-next-auth.session-token` : session utilisateur
- `__Host-next-auth.csrf-token` : protection CSRF

## Prochaines étapes recommandées

1. **Ajouter Google Analytics** (si souhaité) avec consentement conditionnel
2. **Créer une politique de confidentialité** détaillée
3. **Ajouter des mentions légales**
4. **Logger les consentements** en base de données (optionnel, pour audit)

## Ressources

- [CNIL - Cookies et traceurs](https://www.cnil.fr/fr/cookies-et-traceurs-que-dit-la-loi)
- [RGPD - Consentement](https://www.cnil.fr/fr/rgpd-le-consentement)
- [NextAuth.js - Configuration](https://next-auth.js.org/configuration/options#cookies)