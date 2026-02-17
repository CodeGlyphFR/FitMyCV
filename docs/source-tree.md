# Arborescence Source - FitMyCV.io

> Structure complète du projet avec annotations

---

## Vue d'ensemble

```
FitMyCV-DEV/
├── app/                    # Routes Next.js (App Router)
├── components/             # 231 composants React
├── lib/                    # 31 modules métier (165 fichiers)
├── prisma/                 # Schéma et migrations (33 modèles)
├── locales/                # i18n (fr, en, de, es)
├── hooks/                  # React hooks globaux
├── public/                 # Assets statiques
├── scripts/                # Scripts de maintenance
├── data/                   # Données statiques (pays, etc.)
├── test/                   # Tests
└── docs/                   # Documentation (ce dossier)
    └── html-docs/          # Documentation HTML (portfolio technique)
```

---

## Détail par répertoire

### `/app` - Routes Next.js (App Router)

```
app/
├── layout.jsx              # Layout racine (providers, metadata)
├── page.jsx                # Page d'accueil (CV editor)
├── globals.css             # Styles globaux Tailwind
│
├── api/                    # 113 API Routes
│   ├── auth/               # Authentification (9 endpoints)
│   │   ├── [...nextauth]/  # Handler NextAuth.js
│   │   ├── register/       # POST - Inscription
│   │   ├── request-reset/  # POST - Demande reset password
│   │   ├── reset-password/ # POST - Reset password
│   │   ├── verify-email/   # GET - Vérification email
│   │   └── ...
│   │
│   ├── cvs/                # Gestion CV (11 endpoints)
│   │   ├── route.js        # GET - Liste CV utilisateur
│   │   ├── create/         # POST - Créer CV
│   │   ├── read/           # GET - Lire CV
│   │   ├── delete/         # POST - Supprimer CV
│   │   ├── versions/       # GET - Versions CV
│   │   └── restore/        # POST - Restaurer version
│   │
│   ├── cv/                 # Opérations CV unitaires
│   │   ├── match-score/    # POST/GET - Score matching
│   │   ├── improve/        # POST - Optimisation IA
│   │   ├── apply-review/   # POST - Appliquer corrections
│   │   └── metadata/       # GET - Métadonnées
│   │
│   ├── background-tasks/   # Tâches async (7 endpoints)
│   │   ├── generate-cv/    # POST - Génération CV
│   │   ├── import-pdf/     # POST - Import PDF
│   │   ├── translate-cv/   # POST - Traduction
│   │   └── sync/           # GET/POST/DELETE - Sync état
│   │
│   ├── subscription/       # Abonnements (11 endpoints)
│   │   ├── plans/          # GET - Plans disponibles
│   │   ├── current/        # GET - Abonnement actuel
│   │   ├── cancel/         # POST - Annulation
│   │   ├── change/         # POST - Changement plan
│   │   └── invoices/       # GET - Factures
│   │
│   ├── credits/            # Crédits (3 endpoints)
│   │   ├── balance/        # GET - Solde
│   │   ├── costs/          # GET - Coûts features
│   │   └── transactions/   # GET - Historique
│   │
│   ├── admin/              # Administration (38 endpoints)
│   │   ├── users/          # CRUD utilisateurs
│   │   ├── subscription-plans/  # CRUD plans
│   │   ├── credit-packs/   # CRUD packs crédits
│   │   ├── email-templates/# Gestion templates email
│   │   ├── openai-*/       # Monitoring OpenAI
│   │   ├── settings/       # Paramètres globaux
│   │   └── analytics/      # Analytics
│   │
│   ├── analytics/          # Analytics (9 endpoints)
│   ├── telemetry/          # Télémétrie (3 endpoints)
│   ├── export-pdf/         # Export PDF
│   ├── export-word/        # Export DOCX
│   ├── webhooks/stripe/    # Webhook Stripe
│   └── health/             # Health check
│
├── auth/                   # Pages authentification
│   ├── signin/             # Connexion
│   ├── signup/             # Inscription
│   ├── verify-email/       # Vérification email
│   ├── reset-password/     # Reset password
│   └── error/              # Erreurs auth
│
├── account/                # Pages compte utilisateur
│   └── page.jsx            # Paramètres compte
│
├── admin/                  # Dashboard admin
│   └── page.jsx            # Interface admin
│
├── cookies/                # Page paramètres cookies
├── privacy/                # Politique confidentialité
├── terms/                  # Conditions utilisation
└── about/                  # Page à propos
```

---

### `/components` - Composants React (231 fichiers)

```
components/
├── layout/                 # Structure page (9 composants)
│   ├── Section.jsx         # Container section CV
│   ├── GlobalBackground.jsx# Background global
│   ├── Footer.jsx          # Footer
│   └── ConditionalTopBar.jsx
│
├── ui/                     # Design System (18 composants)
│   ├── Modal.jsx           # Modal générique (Portal)
│   ├── ModalForm.jsx       # Formulaire modal
│   ├── Tooltip.jsx         # Infobulle
│   ├── LoadingOverlay.jsx  # Overlay chargement
│   ├── SkeletonLoader.jsx  # Skeleton loading
│   ├── CountrySelect.jsx   # Sélecteur pays
│   ├── PasswordInput.jsx   # Input password
│   └── CreditCostTooltip.jsx
│
├── TopBar/                 # Barre navigation (32 fichiers)
│   ├── TopBar.jsx          # Composant maître (688 lignes)
│   ├── components/         # Sous-composants
│   │   ├── ItemLabel.jsx
│   │   ├── FilterDropdown.jsx
│   │   └── TopBarActions.jsx
│   ├── modals/             # Modales
│   │   ├── NewCvModal.jsx
│   │   ├── CvGeneratorModal.jsx
│   │   ├── PdfImportModal.jsx
│   │   └── ExportPdfModal/
│   └── hooks/              # 13 hooks personnalisés
│       ├── useTopBarState.js
│       ├── useCvOperations.js
│       └── useExportModal.js
│
├── cv-sections/            # Sections CV (8 composants)
│   ├── Header.jsx          # En-tête (nom, contact)
│   ├── Summary.jsx         # Résumé professionnel
│   ├── Experience.jsx      # Expériences
│   ├── Education.jsx       # Formation
│   ├── Skills.jsx          # Compétences
│   ├── Languages.jsx       # Langues
│   ├── Projects.jsx        # Projets
│   └── Extras.jsx          # Extras
│
├── cv-improvement/         # Panel optimisation (12 composants)
│   ├── CVImprovementPanel.jsx  # Panel maître
│   ├── ScoreVisualization.jsx
│   ├── SuggestionsSection.jsx
│   └── MissingSkillsSection.jsx
│
├── cv-review/              # Surlignage modifications (10 composants)
│   ├── ChangeHighlight.jsx
│   ├── InlineDiff.jsx
│   └── ChangeReviewPopover.jsx
│
├── admin/                  # Dashboard admin (33 composants)
│   ├── AdminProvider.jsx   # Context mode édition
│   ├── OverviewTab.jsx     # KPIs
│   ├── UsersTab.jsx        # Gestion utilisateurs
│   ├── RevenueTab.jsx      # Revenus
│   ├── OpenAICostsTab.jsx  # Coûts IA
│   ├── EmailManagementTab.jsx
│   └── SettingsTab.jsx
│
├── subscription/           # Abonnements (15 composants)
│   ├── SubscriptionsPage.jsx
│   ├── CurrentPlanCard.jsx
│   ├── CreditBalanceCard.jsx
│   └── plan-comparison/
│
├── onboarding/             # Système guidage (18 composants)
│   ├── OnboardingProvider.jsx
│   ├── OnboardingOrchestrator.jsx
│   ├── ChecklistPanel.jsx
│   └── hooks/              # 8 hooks
│
├── providers/              # Contextes globaux (7 composants)
│   ├── RootProviders.jsx   # Imbrication providers
│   ├── AdminProvider.jsx
│   ├── BackgroundTasksProvider.jsx
│   └── NotificationProvider.jsx
│
├── auth/                   # Authentification (3 composants)
├── account/                # Paramètres compte (4 composants)
├── notifications/          # Notifications (2 composants)
├── feedback/               # Feedback (3 composants)
├── cookies/                # Consentement (4 composants)
├── task-queue/             # Queue tâches (2 composants)
├── header/                 # Header CV (5 composants)
├── pages/                  # Contenu pages (2 composants)
└── empty-state/            # État vide (1 composant)
```

---

### `/lib` - Modules Métier (31 modules, 165 fichiers)

```
lib/
├── prisma.js               # Singleton PrismaClient
│
├── auth/                   # Authentification NextAuth
│   ├── options.js          # Config NextAuth (providers, callbacks)
│   ├── session.js          # Wrapper auth()
│   └── autoSignIn.js       # Tokens auto-connexion
│
├── cv-core/                # Gestion CV core
│   ├── storage.js          # CRUD CV (DB-backed)
│   ├── validation.js       # Validation JSON Schema
│   ├── versioning.js       # Historique versions
│   ├── source.js           # Traçabilité source
│   ├── changeTracking.js   # Modifications pending
│   └── constants.js
│
├── openai-core/            # Client OpenAI
│   ├── client.js           # API client + helpers
│   ├── schemaLoader.js     # Schemas structured output
│   ├── promptLoader.js     # Chargement prompts
│   └── pdfToImages.js      # PDF → images (Vision)
│
├── subscription/           # Abonnements Stripe
│   ├── subscriptions.js    # Cycle vie abonnement
│   ├── featureUsage.js     # Limites + compteurs
│   ├── credits.js          # Balance crédits
│   ├── cvLimits.js         # Limite CV par plan
│   ├── creditCost.js       # Coût features
│   ├── stripeSync.js       # Sync webhooks
│   └── planUtils.js        # Helpers plans
│
├── background-jobs/        # Queue tâches async
│   ├── jobQueue.js         # Queue (max 3 concurrent)
│   ├── jobRunner.js        # Orchestrateur
│   ├── taskTypes.js        # Types tâches
│   └── cleanupOrphanedTasks.js
│
├── email/                  # Service email
│   ├── emailService.js     # Façade + tokens
│   ├── emailSenderFactory.js
│   ├── transports.js       # SMTP + Resend
│   └── templates/          # Templates fallback
│
├── job-offer/              # Extraction offres
│   ├── index.js            # Façade
│   └── extraction/
│       ├── urlExtraction.js
│       └── pdfExtraction.js
│
├── scoring/                # Match score CV/offre
│   ├── service.js
│   └── job.js
│
├── pdf/                    # Export PDF
│   ├── index.js
│   ├── cvUtils.js
│   ├── cvStyles.js
│   └── sectionGenerators.js
│
├── export/                 # Export données
│
├── telemetry/              # Tracking événements
│   ├── server.js           # Façade
│   ├── constants.js        # EventTypes
│   └── events/
│
├── analytics/              # Analytics admin
│
├── admin/                  # Config admin
│   ├── revenueMetrics.js
│   └── settingsConfig.js
│
├── settings/               # Settings dynamiques
│   ├── settingsUtils.js    # Helpers get/set
│   └── aiModels.js         # Config modèles IA
│
├── api/                    # Erreurs API
│   └── apiErrors.js        # Factory + CommonErrors
│
├── security/               # Sécurité
│   ├── fileValidation.js
│   └── xssSanitization.js
│
├── i18n/                   # Internationalisation
│   └── cvLabels.js
│
├── translation/            # Service traduction
│
├── onboarding/             # Parcours onboarding
│   ├── onboardingSteps.js
│   └── onboardingState.js
│
├── cookies/                # Consentement RGPD
│   ├── consent.js
│   ├── registry.js
│   └── consentLogger.js
│
├── recaptcha/              # Vérification reCAPTCHA
│   └── verifyRecaptcha.js
│
├── events/                 # Event emitter
│   └── dbEmitter.js
│
├── utils/                  # Utilitaires
│   ├── textSanitization.js
│   ├── textFormatting.js
│   ├── dateFormatters.js
│   └── errorHandler.js
│
├── constants/              # Constantes globales
├── animations/             # Variants Framer Motion
├── loading/                # Events loading
├── creditCosts/            # Mapping coûts
└── prompts-shared/         # Prompts réutilisables
```

---

### `/prisma` - Base de Données (33 modèles)

```
prisma/
├── schema.prisma           # Schéma Prisma (716 lignes)
├── migrations/             # Migrations
└── seed.js                 # Seed database
```

**Modèles principaux :**
- `User` - Utilisateur (auth, profile)
- `Account` - Comptes OAuth liés
- `CvFile` - CV stocké (JSON content)
- `CvVersion` - Historique versions
- `JobOffer` - Offres emploi extraites
- `BackgroundTask` - Tâches async
- `Subscription` - Abonnement Stripe
- `SubscriptionPlan` - Plans disponibles
- `CreditBalance` - Solde crédits
- `CreditTransaction` - Transactions
- `FeatureUsageCounter` - Compteurs mensuels
- `EmailTemplate` - Templates email
- `TelemetryEvent` - Événements tracking
- Et 20 autres...

---

### `/locales` - Internationalisation

```
locales/
├── fr/                     # Français
│   └── common.json
├── en/                     # Anglais
│   └── common.json
├── de/                     # Allemand
│   └── common.json
└── es/                     # Espagnol
    └── common.json
```

---

### Autres répertoires

```
hooks/                      # Hooks React globaux
public/                     # Assets statiques (images, fonts)
scripts/                    # Scripts maintenance (sync Stripe)
data/                       # Données statiques (pays, langues)
test/                       # Tests
.claude/                    # Config Claude Code
_bmad/                      # BMAD workflows
_bmad-output/               # Outputs BMAD
```

---

### `/docs/html-docs` - Documentation HTML (Portfolio)

```
docs/html-docs/
├── index.html              # Page d'accueil
├── assets/
│   ├── css/style.css       # Styles
│   └── js/main.js          # Navigation, recherche, Mermaid
├── 01-architecture/        # Architecture technique (4 pages)
├── 02-authentification/    # NextAuth.js (4 pages)
├── 03-gestion-cv/          # CRUD CV, Import PDF (5 pages)
├── 04-offres-emploi/       # Extraction, Match Score (3 pages)
├── 05-pipeline-generation/ # Pipeline IA (7 pages)
├── 06-pipeline-optimisation/ # Optimisation (5 pages)
├── 07-abonnements/         # Stripe, Plans (5 pages)
├── 08-credits/             # Système crédits (4 pages)
├── 09-background-jobs/     # Queue, SSE (3 pages)
├── 10-export/              # PDF, DOCX (3 pages)
├── 11-traduction/          # Traduction CV (1 page)
├── 12-administration/      # Dashboard admin (8 pages)
├── 13-onboarding/          # Flux utilisateur (1 page)
├── 14-email/               # Resend, Templates (2 pages)
├── 15-api-reference/       # 114 endpoints (4 pages)
└── 16-composants/          # Composants React (1 page)
```

**Accès** : Réservé aux administrateurs via `/api/admin/docs/`

---

## Fichiers racine importants

| Fichier | Rôle |
|---------|------|
| `package.json` | Dépendances (v1.1.1.0) |
| `next.config.js` | Config Next.js 16 (Turbopack) |
| `tailwind.config.js` | Config Tailwind (dark mode, animations) |
| `jsconfig.json` | Alias `@/*` |
| `CLAUDE.md` | Instructions IA |
| `README.md` | Vue d'ensemble projet |
| `.env` / `.env.example` | Variables environnement |
