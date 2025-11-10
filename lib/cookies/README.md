# Système de gestion des cookies RGPD

Ce système de gestion des cookies est conforme à la réglementation française (RGPD/CNIL).

## Fonctionnalités

✅ Bannière de consentement au premier chargement
✅ Acceptation/Refus global ou personnalisé
✅ Page de gestion des préférences (`/cookies`)
✅ Expiration automatique du consentement après 6 mois
✅ Cookies sécurisés (HttpOnly, SameSite, Secure)
✅ Sessions avec expiration (30 jours)
✅ Hook React pour conditionner le chargement de scripts
✅ **Synchronisation multi-onglets** (BroadcastChannel API)
✅ **Révocation effective** des cookies refusés
✅ **Registre détaillé** de tous les cookies avec leurs caractéristiques
✅ **Politique de confidentialité** complète (`/privacy`)
✅ **Traductions complètes** (FR/EN)
✅ **Performance optimisée** (plus de polling inefficace)
✅ **Audit des consentements** en base de données (modèle `ConsentLog`)
✅ **Historique consultable** pour l'utilisateur (page `/cookies`)
✅ **Charge de la preuve RGPD** avec logs IP/userAgent

## Architecture

```
lib/cookies/
├── consent.js           # Logique de gestion du consentement + révocation + logging
├── useCookieConsent.js  # Hook React avec BroadcastChannel
├── registry.js          # Registre détaillé des cookies
├── consentLogger.js     # Logger serveur pour audit RGPD
└── README.md            # Documentation

components/cookies/
├── CookieBanner.jsx     # Bannière de consentement
├── CookieSettings.jsx   # Page de paramètres (traduite)
├── CookieRegistry.jsx   # Composant d'affichage du registre
└── ConsentHistory.jsx   # Composant d'affichage de l'historique

app/
├── cookies/page.jsx     # Route /cookies
├── privacy/page.jsx     # Route /privacy (politique de confidentialité)
└── api/consent/
    ├── log/route.js     # POST - Logger un consentement
    └── history/route.js # GET - Récupérer l'historique

prisma/
└── schema.prisma        # Modèle ConsentLog (audit)
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

## Nouvelles fonctionnalités (v2)

### 1. Synchronisation multi-onglets 🔄

Utilise **BroadcastChannel API** au lieu du polling inefficace :
- Les changements de consentement se propagent instantanément entre tous les onglets
- Fallback sur `storage` event pour les navigateurs qui ne supportent pas BroadcastChannel
- Performance nettement améliorée (pas de setInterval toutes les secondes)

### 2. Révocation effective des cookies 🗑️

Quand l'utilisateur refuse une catégorie :
- Les cookies de cette catégorie sont **automatiquement supprimés**
- Le localStorage/sessionStorage lié est nettoyé
- Fonction `revokeCookiesByCategory()` pour suppression ciblée
- Support des wildcards (ex: `_ga_*`)

### 3. Registre détaillé des cookies 📋

Nouveau fichier `lib/cookies/registry.js` :
- Liste complète de tous les cookies avec :
  - Nom exact
  - Catégorie
  - Durée de vie
  - Finalité précise
  - Fournisseur (first-party / third-party)
  - Type de stockage (cookie / localStorage / sessionStorage)
- Affichage dans la page `/cookies` via composant `CookieRegistry`
- Interface accordéon pour explorer par catégorie

### 4. Politique de confidentialité 📄

Page `/privacy` complète avec :
- Données collectées (identification, CV, connexion, cookies)
- Finalités du traitement
- Base légale
- Durée de conservation
- Partage des données (notamment OpenAI)
- Mesures de sécurité (chiffrement AES-256-GCM, etc.)
- Droits RGPD
- Contact CNIL

### 5. Traductions complètes 🌍

- Toutes les chaînes de `CookieSettings.jsx` sont traduites
- Support FR/EN avec détection de locale pour formatage des dates
- Clés ajoutées dans `locales/fr.json` et `locales/en.json`

### 6. Audit des consentements (RGPD) 📊

**Pourquoi c'est crucial** : La CNIL exige de pouvoir prouver qu'un utilisateur a donné son consentement de manière libre et éclairée (charge de la preuve).

**Implémentation** :
- Modèle `ConsentLog` en base de données (Prisma)
- Logging automatique à chaque changement de consentement :
  - Action : `created` (premier consentement), `updated` (modification), `revoked` (suppression)
  - Préférences complètes (JSON)
  - Contexte : IP, userAgent, timestamp
- API REST pour :
  - POST `/api/consent/log` : enregistrer un consentement (côté client, authentifié)
  - GET `/api/consent/history` : consulter l'historique (droit d'accès RGPD)
- Composant `ConsentHistory` dans la page `/cookies` :
  - Affichage accordéon
  - Historique avec dates, actions, détails des préférences
  - Info RGPD sur la conservation

**Cycle de vie** :
1. Utilisateur modifie ses préférences dans la bannière ou `/cookies`
2. `saveConsent()` met à jour le cookie local
3. Appel API `/api/consent/log` (non-bloquant)
4. Serveur enregistre dans `ConsentLog` avec IP/userAgent
5. Utilisateur peut consulter son historique dans `/cookies`

**Nettoyage** :
- Logs supprimés automatiquement avec le compte (cascade `onDelete: Cascade`)
- Fonction `cleanOldConsentLogs(beforeDate)` disponible pour purger les anciens logs (minimisation des données RGPD)

## Conformité RGPD

### Points respectés

✅ **Consentement libre et éclairé** : L'utilisateur peut accepter/refuser
✅ **Granularité** : Choix par catégorie de cookies
✅ **Durée limitée** : 6 mois (recommandation CNIL)
✅ **Révocation effective** : Les cookies refusés sont supprimés
✅ **Information claire** : Registre détaillé + politique de confidentialité
✅ **Pas de case précochée** : Aucune catégorie optionnelle n'est active par défaut
✅ **Transparence** : Liste exhaustive des cookies avec finalités
✅ **Droits RGPD** : Tous les droits expliqués clairement
✅ **Traçabilité/Audit** : Historique des consentements en base de données
✅ **Charge de la preuve** : Logs avec IP/userAgent/timestamp
✅ **Droit d'accès** : L'utilisateur peut consulter son historique

### Actions utilisateur

- `/cookies` : Page de gestion des préférences
- Footer : Lien permanent vers les paramètres
- Bannière : Réaffichée après expiration du consentement

## API

### `consent.js`

```javascript
// Récupérer le consentement
const consent = getConsent();

// Sauvegarder le consentement (+ révocation automatique si changement)
saveConsent({
  necessary: true,
  functional: true,
  analytics: false,
  marketing: false
});

// Accepter tout
acceptAllCookies();

// Refuser tout (sauf nécessaires) + révocation
rejectAllCookies();

// Vérifier une catégorie
if (isCategoryAccepted(COOKIE_CATEGORIES.ANALYTICS)) {
  // ...
}

// Réinitialiser
clearConsent();

// Révoquer les cookies d'une catégorie (nouveau)
revokeCookiesByCategory(COOKIE_CATEGORIES.ANALYTICS);

// Révoquer tous les cookies non nécessaires (nouveau)
revokeAllNonEssentialCookies();
```

### `registry.js` (nouveau)

```javascript
import { COOKIE_REGISTRY, getCookiesByCategory, getCookieByName } from '@/lib/cookies/registry';

// Récupérer tous les cookies
console.log(COOKIE_REGISTRY);

// Récupérer les cookies d'une catégorie
const analyticsCookies = getCookiesByCategory(COOKIE_CATEGORIES.ANALYTICS);

// Récupérer un cookie spécifique
const gaCookie = getCookieByName('_ga');

// Compter les cookies par catégorie
const counts = getCookieCountByCategory();

// Récupérer les fournisseurs tiers
const thirdParty = getThirdPartyProviders(); // ['Google', 'Meta', ...]
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
2. ~~**Créer une politique de confidentialité** détaillée~~ ✅ FAIT (`/privacy`)
3. **Ajouter des mentions légales** (page `/legal`)
4. **Logger les consentements** en base de données (optionnel, pour audit et conformité RGPD)
5. **Tests E2E** avec Playwright pour vérifier le workflow complet
6. **Content Security Policy (CSP)** dans `next.config.js` pour sécurité renforcée
7. **Support IAB TCF** (si marketing tiers avec partenaires multiples)

## Ressources

- [CNIL - Cookies et traceurs](https://www.cnil.fr/fr/cookies-et-traceurs-que-dit-la-loi)
- [RGPD - Consentement](https://www.cnil.fr/fr/rgpd-le-consentement)
- [NextAuth.js - Configuration](https://next-auth.js.org/configuration/options#cookies)