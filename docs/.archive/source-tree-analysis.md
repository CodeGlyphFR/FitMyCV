# Analyse de l'Arborescence Source - FitMyCV.io

> Document généré automatiquement le 2026-01-07 par scan exhaustif du projet

## Vue d'ensemble

**Type de projet** : Application Web Monolithe
**Framework** : Next.js 14 (App Router)
**Langage** : JavaScript (React 18)

---

## Arborescence Annotée

```
FitMyCV-DEV/
│
├── app/                          # Next.js App Router (pages + API)
│   ├── page.jsx                  # ⭐ Page principale CV (entrée)
│   ├── layout.jsx                # ⭐ Layout racine avec providers
│   ├── globals.css               # Styles globaux Tailwind
│   │
│   ├── about/                    # Page À propos
│   ├── account/                  # Paramètres utilisateur
│   │   └── subscriptions/        # Gestion abonnements/crédits
│   ├── admin/                    # Dashboard administrateur
│   │   ├── analytics/            # Analytics détaillées
│   │   └── new/                  # Création admin
│   ├── auth/                     # Authentification
│   │   ├── complete-signin/      # Auto-login post-vérification
│   │   ├── forgot-password/      # Récupération mot de passe
│   │   ├── reset-password/       # Réinitialisation
│   │   ├── verify-email/         # Vérification email
│   │   ├── verify-email-change/  # Changement email
│   │   └── verify-email-required/# Email non vérifié
│   ├── cookies/                  # Politique cookies
│   ├── privacy/                  # Politique confidentialité
│   ├── terms/                    # Conditions utilisation
│   │
│   └── api/                      # 🔌 110 API Routes
│       ├── account/              # Gestion compte (6 endpoints)
│       ├── admin/                # Administration (33 endpoints)
│       ├── analytics/            # Analytics (8 endpoints)
│       ├── auth/                 # Authentification (9 endpoints)
│       ├── background-tasks/     # Tâches fond (8 endpoints)
│       ├── checkout/             # Paiements (3 endpoints)
│       ├── consent/              # Consentement RGPD
│       ├── credits/              # Gestion crédits (3 endpoints)
│       ├── cv/                   # Opérations CV (13 endpoints)
│       ├── cvs/                  # CRUD CVs
│       ├── events/               # SSE streaming
│       ├── export-pdf/           # Export PDF
│       ├── feedback/             # Feedback utilisateur
│       ├── link-history/         # Historique liens
│       ├── recaptcha/            # Vérification reCAPTCHA
│       ├── settings/             # Paramètres publics
│       ├── subscription/         # Abonnements (11 endpoints)
│       ├── telemetry/            # Tracking événements
│       ├── user/                 # Profil utilisateur
│       └── webhooks/             # Webhooks Stripe
│
├── components/                   # 🧩 149 Composants React
│   ├── RootProviders.jsx         # ⭐ Hiérarchie providers (7 niveaux)
│   ├── ConditionalTopBar.jsx     # TopBar conditionnelle
│   ├── BackgroundTasksProvider.jsx # Gestion tâches fond
│   ├── HighlightProvider.jsx     # Gestion changements IA
│   ├── RealtimeRefreshProvider.jsx # Sync temps réel
│   │
│   ├── Header.jsx                # 📝 En-tête CV (32KB)
│   ├── Summary.jsx               # Résumé professionnel
│   ├── Experience.jsx            # Expériences (27KB)
│   ├── Education.jsx             # Formation
│   ├── Skills.jsx                # Compétences (17KB)
│   ├── Languages.jsx             # Langues
│   ├── Projects.jsx              # Projets
│   ├── Extras.jsx                # Certifications/extras
│   ├── Section.jsx               # Conteneur section
│   │
│   ├── MatchScore.jsx            # Score correspondance
│   ├── CVImprovementPanel.jsx    # Panel amélioration (45KB)
│   ├── ChangesPanel.jsx          # Panneau changements
│   ├── TaskQueueModal.jsx        # Modal tâches
│   │
│   ├── TopBar/                   # 🎯 Navigation principale
│   │   ├── TopBar.jsx            # Composant principal
│   │   ├── hooks/                # 9 hooks custom
│   │   ├── modals/               # 6 modals (génération, import, export)
│   │   ├── components/           # Sous-composants
│   │   └── utils/                # Utilitaires
│   │
│   ├── account/                  # Paramètres compte
│   ├── admin/                    # Interface admin
│   │   └── settings/             # Paramètres admin
│   ├── analytics/                # Composants analytics
│   ├── auth/                     # Formulaires auth
│   ├── cookies/                  # Banner cookies
│   ├── feedback/                 # Widget feedback
│   ├── notifications/            # Système notifications
│   ├── onboarding/               # 🎓 8 composants (42KB provider)
│   ├── subscription/             # 12 composants abonnement
│   └── ui/                       # UI réutilisables (Modal, Tooltip...)
│
├── lib/                          # 📚 8 Modules Core
│   ├── prisma.js                 # ⭐ Client Prisma singleton
│   │
│   ├── auth/                     # 🔐 Authentification
│   │   ├── options.js            # NextAuth config
│   │   ├── session.js            # Gestion session
│   │   └── autoSignIn.js         # Auto-login tokens
│   │
│   ├── cv/                       # 📄 Opérations CV
│   │   ├── storage.js            # ⭐ Stockage PostgreSQL
│   │   ├── validation.js         # Validation JSON Schema
│   │   ├── versioning.js         # Gestion versions
│   │   ├── applyModifications.js # Application DIFF IA
│   │   └── detectLanguage.js     # Détection langue
│   │
│   ├── openai/                   # 🤖 Intégration IA
│   │   ├── client.js             # Client OpenAI
│   │   ├── generateCv.js         # ⭐ Génération CV (41KB)
│   │   ├── improveCv.js          # Amélioration CV
│   │   ├── translateCv.js        # Traduction CV
│   │   ├── importPdf.js          # Import PDF
│   │   ├── calculateMatchScoreWithAnalysis.js # Score matching
│   │   ├── prompts/              # Templates prompts
│   │   └── schemas/              # Schemas Structured Outputs
│   │
│   ├── subscription/             # 💳 Monétisation
│   │   ├── featureUsage.js       # ⭐ Contrôle accès features
│   │   ├── credits.js            # Gestion crédits
│   │   ├── subscriptions.js      # Gestion abonnements
│   │   └── creditCost.js         # Coûts features
│   │
│   ├── email/                    # 📧 Service email
│   │   ├── emailService.js       # API haut niveau
│   │   └── transports.js         # SMTP + Resend fallback
│   │
│   ├── backgroundTasks/          # ⚙️ Queue tâches
│   │   ├── jobQueue.js           # Queue in-memory (max 3)
│   │   └── processRegistry.js    # Annulation tâches
│   │
│   ├── telemetry/                # 📊 Analytics
│   │   └── server.js             # Tracking événements
│   │
│   ├── onboarding/               # 🎓 Onboarding
│   │   └── onboardingState.js    # État onboarding
│   │
│   ├── api/                      # Utilitaires API
│   ├── events/                   # Bus événements
│   ├── i18n/                     # Internationalisation
│   ├── sse/                      # Server-Sent Events
│   ├── security/                 # Sécurité (sanitization)
│   ├── settings/                 # Paramètres système
│   └── utils/                    # Utilitaires génériques
│
├── prisma/                       # 🗄️ Base de données
│   ├── schema.prisma             # ⭐ 29 modèles Prisma
│   ├── seed.js                   # Données initiales
│   └── migrations/               # 14 migrations
│
├── locales/                      # 🌍 Traductions
│   ├── en/                       # Anglais (9 fichiers)
│   ├── fr/                       # Français (9 fichiers)
│   ├── de/                       # Allemand (9 fichiers)
│   └── es/                       # Espagnol (9 fichiers)
│
├── data/                         # 📋 Données statiques
│   └── schema.json               # JSON Schema CV
│
├── hooks/                        # 🪝 React Hooks custom
│
├── public/                       # 🖼️ Assets statiques
│   └── icons/                    # Icônes
│
├── scripts/                      # 🔧 Scripts utilitaires
│   └── rebuild-prod.sh           # Script rebuild production
│
├── docs/                         # 📖 Documentation
│   └── onboarding/               # Docs onboarding
│
├── logs/                         # 📋 Logs application
│
└── Configuration files
    ├── package.json              # Dépendances NPM
    ├── next.config.js            # Config Next.js
    ├── tailwind.config.js        # Config Tailwind
    ├── postcss.config.js         # Config PostCSS
    ├── jsconfig.json             # Alias imports
    ├── .env                      # Variables environnement
    └── CLAUDE.md                 # Instructions Claude Code
```

---

## Répertoires Critiques

### 1. `app/` - Next.js App Router
- **Fonction** : Pages et routes API
- **Pattern** : File-based routing
- **Entrées** : `page.jsx` (CV principal), `layout.jsx` (providers)

### 2. `components/` - Composants React
- **Fonction** : UI réutilisables
- **Pattern** : Providers imbriqués (7 niveaux)
- **Points clés** :
  - `RootProviders.jsx` : Hiérarchie Session → Recaptcha → Settings → Language → Notification → Admin → Onboarding
  - `TopBar/` : Navigation avec 9 hooks custom
  - `onboarding/` : Système onboarding complet

### 3. `lib/` - Logique Métier
- **Fonction** : Services et utilitaires
- **Modules critiques** :
  - `auth/` : NextAuth.js configuration
  - `cv/storage.js` : Stockage CV en PostgreSQL
  - `openai/` : Intégration IA
  - `subscription/` : Monétisation dual (abonnements + crédits)

### 4. `prisma/` - Base de Données
- **Fonction** : Schema et migrations PostgreSQL
- **29 modèles** : User, CvFile, CvVersion, JobOffer, Subscription, CreditBalance, etc.

### 5. `locales/` - Internationalisation
- **4 langues** : FR, EN, DE, ES
- **9 fichiers par langue** : common, auth, cv, subscription, etc.

---

## Points d'Entrée

| Type | Fichier | Description |
|------|---------|-------------|
| Page principale | `app/page.jsx` | Affichage CV utilisateur |
| Layout racine | `app/layout.jsx` | Providers + settings injection |
| API | `app/api/*/route.js` | 110 endpoints REST |
| Styles | `app/globals.css` | Tailwind + styles custom |
| DB Client | `lib/prisma.js` | Singleton Prisma |

---

## Flux de Données Principal

```
Utilisateur
    ↓
app/page.jsx (Server Component)
    ↓
RootProviders.jsx (Client Providers)
    ↓
TopBar.jsx (Navigation + Actions)
    ↓
API Routes (/api/*)
    ↓
lib/ modules (auth, cv, openai, subscription)
    ↓
Prisma ORM
    ↓
PostgreSQL
```

---

## Statistiques

| Catégorie | Quantité |
|-----------|----------|
| Routes API | 110 |
| Composants React | 149 |
| Modèles Prisma | 29 |
| Modules lib/ | 8 principaux |
| Langues supportées | 4 |
| Migrations DB | 14 |
