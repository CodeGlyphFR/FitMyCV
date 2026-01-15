# Inventaire Composants - FitMyCV.io

> ~150 composants React | Généré le 2026-01-07

---

## Vue d'Ensemble

```
components/
├── Root Level (28)     # Providers, CV sections, utilities
├── TopBar/ (7)         # Navigation principale + modals
├── ui/ (15)            # Composants réutilisables
├── admin/ (40+)        # Dashboard admin
├── subscription/ (10)  # Gestion abonnements
├── onboarding/ (8)     # Parcours utilisateur
├── account/ (4)        # Paramètres compte
├── auth/ (3)           # Authentification
├── cookies/ (4)        # Consentement RGPD
├── feedback/ (3)       # Retours utilisateurs
├── notifications/ (2)  # Système notifications
└── analytics/ (1)      # Tracking conditionnel
```

---

## Providers (Contextes Globaux)

| Composant | Fichier | Purpose |
|-----------|---------|---------|
| `RootProviders` | `RootProviders.jsx` | Agrège tous les contextes |
| `NotificationProvider` | `notifications/` | Notifications toast |
| `BackgroundTasksProvider` | root | Queue de tâches async |
| `HighlightProvider` | root | Tracking modifications CV |
| `OnboardingProvider` | `onboarding/` | État parcours onboarding |
| `AdminProvider` | `admin/` | Contexte dashboard admin |
| `RecaptchaProvider` | root | Protection reCAPTCHA |
| `RealtimeRefreshProvider` | root | Sync temps réel (SSE) |

**Pattern d'utilisation** :
```jsx
// app/layout.jsx
<RootProviders>
  {children}
</RootProviders>
```

---

## Layout Components

| Composant | Purpose |
|-----------|---------|
| `ConditionalTopBar` | Affiche TopBar selon contexte (auth vs app) |
| `ConditionalFooter` | Footer conditionnel |
| `ConditionalMainWrapper` | Wrapper contenu principal |
| `TopBarSpacer` | Espace compensant hauteur TopBar |
| `GlobalBackground` | Fond animé global |
| `ScrollToTopOnMount` | Scroll auto vers top |
| `LoadingOverlay` | Écran chargement bloquant |

---

## TopBar (`components/TopBar/`)

Barre de navigation principale avec gestion CVs.

| Composant | Type | Purpose |
|-----------|------|---------|
| `TopBar` | Layout | Navigation principale, liste CVs, filtres |
| `FilterDropdown` | Dropdown | Filtrage CVs (date, source, type) |
| `CvGeneratorModal` | Modal | Génération CV depuis offre emploi |
| `NewCvModal` | Modal | Création CV vierge |
| `ExportPdfModal` | Modal | Export PDF avec sélection sections |
| `PdfImportModal` | Modal | Import CV depuis PDF |
| `DeleteCvModal` | Modal | Confirmation suppression CV |

**Hooks associés** (`TopBar/hooks/`) :
- `useCvList` - Liste et sélection CVs
- `useCvActions` - Actions CRUD
- `useTaskQueue` - File de tâches
- `useExportPdf` - Export PDF
- etc.

---

## Sections CV (Root Level)

Composants représentant les sections du document CV.

| Composant | Section CV | Editable |
|-----------|------------|----------|
| `Header` | En-tête (nom, titre, contact) | Oui |
| `Summary` | Résumé professionnel | Oui |
| `Experience` | Expériences professionnelles | Oui |
| `Education` | Formation académique | Oui |
| `Skills` | Compétences techniques | Oui |
| `Languages` | Langues parlées | Oui |
| `Projects` | Projets personnels/pro | Oui |
| `Extras` | Sections supplémentaires | Oui |

**Composants de review** :
| Composant | Purpose |
|-----------|---------|
| `ChangeHighlight` | Surbrillance contenu modifié par IA |
| `ChangeReviewPopover` | Popover révision changements |
| `BulletHighlight` | Highlight bullets modifiées |
| `SkillItemHighlight` | Highlight skills modifiés |
| `ExperienceReviewActions` | Actions review expériences |
| `SkillsReviewActions` | Actions review skills |
| `SectionReviewActions` | Actions review sections |
| `InlineDiff` | Affichage différences (compact/side-by-side) |

**Autres composants CV** :
| Composant | Purpose |
|-----------|---------|
| `Section` | Conteneur section générique |
| `EmptyState` | État vide avec message |
| `SourceInfo` | Origine CV (manuel/import/IA) |
| `VersionSelector` | Sélecteur version CV |
| `MatchScore` | Score correspondance offre/CV |
| `CVImprovementPanel` | Panneau amélioration IA |
| `ChangesPanel` | Panneau visualisation changements |
| `OrphanedChangesDisplay` | Changements non associés |

---

## UI Components (`components/ui/`)

Composants réutilisables (design system).

| Composant | Type | Props clés |
|-----------|------|------------|
| `Modal` | Container | `isOpen`, `onClose`, `title`, `icon` |
| `Tooltip` | Display | `content`, `position`, `delay` |
| `TipBox` | Display | `type`, `children` |
| `PasswordInput` | Input | `value`, `onChange`, `showToggle` |
| `FormRow` | Layout | `label`, `error`, `children` |
| `DonutProgress` | Chart | `value`, `max`, `color` |
| `CreditCostDisplay` | Display | `cost`, `balance` |
| `CreditCostTooltip` | Tooltip | `feature`, `cost` |

**Loaders** :
| Composant | Purpose |
|-----------|---------|
| `SkeletonLoader` | Chargement squelette générique |
| `SkeletonPlanCard` | Skeleton carte plan |
| `SkeletonFeatureCounters` | Skeleton compteurs |
| `SkeletonCurrentPlanCard` | Skeleton plan actuel |

**Icons** :
| Composant | Purpose |
|-----------|---------|
| `GptLogo` | Logo OpenAI/GPT |
| `DefaultCvIcon` | Icône CV par défaut |
| `ImportIcon` | Icône import |
| `TranslateIcon` | Icône traduction |
| `QueueIcon` | Icône file d'attente |
| `IconPreloader` | Préchargement icônes |

---

## Admin Dashboard (`components/admin/`)

Dashboard d'administration complet.

### Tabs (Pages)

| Tab | Purpose | KPIs/Features |
|-----|---------|---------------|
| `OverviewTab` | Vue d'ensemble | Users, CVs, Revenue |
| `UsersTab` | Gestion utilisateurs | Liste, stats, actions |
| `SubscriptionPlansTab` | Plans abonnement | Config, stats |
| `SettingsTab` | Paramètres globaux | AI models, credits, PDF |
| `FeaturesTab` | Usage features | Tracking, analytics |
| `FeedbackTab` | Feedbacks | Tableau, status |
| `ErrorsTab` | Erreurs prod | Logs, détails |
| `ExportsTab` | Exports PDF | Historique |
| `RevenueTab` | Revenue/MRR | Dashboard financier |
| `OpenAICostsTab` | Coûts OpenAI | Par feature, alertes |
| `OnboardingTab` | Analytics onboarding | Status, dropoff |
| `EmailTemplatesTab` | Templates email | Éditeur, triggers |

### Charts

| Composant | Type | Data |
|-----------|------|------|
| `MRRHistoryChart` | Line | MRR over time |
| `PlanDistributionChart` | Pie | Users par plan |
| `OnboardingStatusChart` | Bar | Status completion |
| `OnboardingDropoffChart` | Funnel | Dropoff par étape |
| `OnboardingTimeline` | Timeline | Progression |

### Forms & Tables

| Composant | Purpose |
|-----------|---------|
| `OnboardingUsersTable` | Liste users + progression |
| `EmailLogsTable` | Logs emails envoyés |
| `EmailStatsKPIs` | KPIs statistiques emails |

### Modals & Editors

| Composant | Purpose |
|-----------|---------|
| `ConfirmDialog` | Confirmation générique |
| `EditAlertModal` | Édition alertes système |
| `EmailPreviewModal` | Preview rendu email |
| `MailyEditor` | Éditeur email WYSIWYG |
| `ImagePickerModal` | Picker images emails |

### Controls

| Composant | Purpose |
|-----------|---------|
| `TabsBar` | Navigation entre tabs |
| `KPICard` | Carte KPI |
| `ToggleSwitch` | Switch on/off |
| `CustomSelect` | Select dropdown |
| `DateRangePicker` | Sélecteur dates |
| `Toast` | Message toast |

---

## Subscription (`components/subscription/`)

Gestion abonnements et crédits.

| Composant | Type | Purpose |
|-----------|------|---------|
| `SubscriptionsPage` | Page | Page principale |
| `CurrentPlanCard` | Card | Plan actuel + actions |
| `PlanComparisonCards` | Card | Comparaison plans |
| `CreditPacksCards` | Card | Packs crédits à acheter |
| `CreditBalanceCard` | Card | Solde crédits |
| `CreditBalanceBanner` | Banner | Alerte solde bas |
| `NegativeBalanceBanner` | Banner | Alerte solde négatif |
| `FeatureCountersCard` | Card | Compteurs usage features |
| `CreditTransactionsTable` | Table | Historique transactions |
| `InvoicesTable` | Table | Historique factures |

---

## Onboarding (`components/onboarding/`)

Parcours d'intégration utilisateur.

| Composant | Type | Purpose |
|-----------|------|---------|
| `OnboardingProvider` | Provider | Contexte + state machine |
| `OnboardingOrchestrator` | Orchestrator | Flow complet |
| `OnboardingModal` | Modal | Étape générique |
| `OnboardingCompletionModal` | Modal | Fin + confetti |
| `WelcomeModal` | Modal | Accueil initial |
| `OnboardingTooltip` | Tooltip | Tooltip contextuel |
| `OnboardingHighlight` | Highlight | Focus élément |
| `ChecklistPanel` | Panel | Checklist progression |

---

## Auth (`components/auth/`)

Authentification utilisateur.

| Composant | Purpose |
|-----------|---------|
| `AuthScreen` | Page login/register avec OAuth + credentials |
| `PasswordStrengthIndicator` | Indicateur force mot de passe |
| `EmailVerificationError` | Message erreur vérification |

---

## Account (`components/account/`)

Paramètres du compte utilisateur.

| Composant | Purpose |
|-----------|---------|
| `AccountSettings` | Page paramètres (profil, password, notifs) |
| `AccountPageHeader` | En-tête page |
| `AccountPageLoading` | Loader page |
| `LinkedAccountsSection` | Gestion comptes OAuth liés |

---

## Cookies (`components/cookies/`)

Gestion consentement RGPD.

| Composant | Purpose |
|-----------|---------|
| `CookieBanner` | Banner consentement cookies |
| `CookieSettings` | Panneau paramètres détaillés |
| `CookieRegistry` | Registry cookies utilisés |
| `ConsentHistory` | Historique consentements |

---

## Feedback (`components/feedback/`)

Retours utilisateurs.

| Composant | Purpose |
|-----------|---------|
| `FeedbackButton` | Bouton flottant feedback |
| `FeedbackModal` | Modal formulaire |
| `StarRating` | Notation 5 étoiles |

---

## Notifications (`components/notifications/`)

Système de notifications toast.

| Composant | Purpose |
|-----------|---------|
| `NotificationProvider` | Contexte + hook `useNotifications` |
| `NotificationContainer` | Conteneur affichage toasts |

**Usage** :
```jsx
const { addNotification } = useNotifications();
addNotification({ type: 'success', message: 'CV saved!' });
```

---

## Analytics (`components/analytics/`)

| Composant | Purpose |
|-----------|---------|
| `ConditionalAnalytics` | Charge analytics conditionnellement |

---

## Patterns de Design

### 1. Composition de Modals

```jsx
<Modal isOpen={isOpen} onClose={onClose} title="Export PDF">
  <Modal.Body>
    {/* Content */}
  </Modal.Body>
  <Modal.Footer>
    <Button onClick={onClose}>Cancel</Button>
    <Button primary onClick={onExport}>Export</Button>
  </Modal.Footer>
</Modal>
```

### 2. Provider Pattern

```jsx
// Création
const MyContext = createContext();
export const MyProvider = ({ children }) => {
  const [state, setState] = useState();
  return (
    <MyContext.Provider value={{ state, setState }}>
      {children}
    </MyContext.Provider>
  );
};

// Usage
const { state } = useContext(MyContext);
```

### 3. Conditional Rendering

```jsx
// Layout conditionnel selon route
const ConditionalTopBar = () => {
  const pathname = usePathname();
  if (pathname.startsWith('/auth')) return null;
  return <TopBar />;
};
```

### 4. Skeleton Loading

```jsx
{isLoading ? (
  <SkeletonLoader />
) : (
  <ActualContent data={data} />
)}
```

---

## Conventions de Nommage

| Type | Convention | Exemple |
|------|------------|---------|
| Composant | PascalCase | `CvGeneratorModal` |
| Hook | camelCase, préfixe `use` | `useCvList` |
| Contexte | PascalCase + Provider | `OnboardingProvider` |
| Fichier | PascalCase.jsx | `CvGeneratorModal.jsx` |
| Dossier | camelCase ou PascalCase | `TopBar/`, `onboarding/` |

---

## Arborescence Détaillée

```
components/
├── RootProviders.jsx
├── ConditionalTopBar.jsx
├── ConditionalFooter.jsx
├── ConditionalMainWrapper.jsx
├── TopBarSpacer.jsx
├── GlobalBackground.jsx
├── ScrollToTopOnMount.jsx
├── LoadingOverlay.jsx
├── LanguageSwitcher.jsx
├── Footer.jsx
├── RecaptchaProvider.jsx
├── RealtimeRefreshProvider.jsx
├── BackgroundTasksProvider.jsx
├── HighlightProvider.jsx
├── IconPreloader.jsx
├── Header.jsx
├── Summary.jsx
├── Experience.jsx
├── Education.jsx
├── Skills.jsx
├── Languages.jsx
├── Projects.jsx
├── Extras.jsx
├── Section.jsx
├── EmptyState.jsx
├── SourceInfo.jsx
├── VersionSelector.jsx
├── MatchScore.jsx
├── CVImprovementPanel.jsx
├── ChangesPanel.jsx
├── ChangeHighlight.jsx
├── ChangeReviewPopover.jsx
├── BulletHighlight.jsx
├── SkillItemHighlight.jsx
├── OrphanedChangesDisplay.jsx
├── InlineDiff.jsx
├── TaskQueueDropdown.jsx
├── TaskQueueModal.jsx
│
├── TopBar/
│   ├── TopBar.jsx
│   ├── FilterDropdown.jsx
│   ├── CvGeneratorModal.jsx
│   ├── NewCvModal.jsx
│   ├── ExportPdfModal.jsx
│   ├── PdfImportModal.jsx
│   ├── DeleteCvModal.jsx
│   └── hooks/
│
├── ui/
│   ├── Modal.jsx
│   ├── SkeletonLoader.jsx
│   ├── Tooltip.jsx
│   ├── TipBox.jsx
│   ├── PasswordInput.jsx
│   ├── FormRow.jsx
│   ├── DonutProgress.jsx
│   ├── CreditCostDisplay.jsx
│   ├── CreditCostTooltip.jsx
│   ├── GptLogo.jsx
│   ├── DefaultCvIcon.jsx
│   ├── ImportIcon.jsx
│   ├── TranslateIcon.jsx
│   └── QueueIcon.jsx
│
├── admin/
│   ├── AdminProvider.jsx
│   ├── TabsBar.jsx
│   ├── KPICard.jsx
│   ├── OverviewTab.jsx
│   ├── UsersTab.jsx
│   ├── SubscriptionPlansTab.jsx
│   ├── SettingsTab.jsx
│   ├── FeaturesTab.jsx
│   ├── FeedbackTab.jsx
│   ├── ErrorsTab.jsx
│   ├── RevenueTab.jsx
│   ├── OpenAICostsTab.jsx
│   ├── OnboardingTab.jsx
│   ├── EmailTemplatesTab.jsx
│   └── ...
│
├── subscription/
│   ├── SubscriptionsPage.jsx
│   ├── CurrentPlanCard.jsx
│   ├── PlanComparisonCards.jsx
│   ├── CreditPacksCards.jsx
│   ├── CreditBalanceCard.jsx
│   ├── FeatureCountersCard.jsx
│   ├── CreditTransactionsTable.jsx
│   └── InvoicesTable.jsx
│
├── onboarding/
│   ├── OnboardingProvider.jsx
│   ├── OnboardingOrchestrator.jsx
│   ├── OnboardingModal.jsx
│   ├── WelcomeModal.jsx
│   ├── OnboardingCompletionModal.jsx
│   ├── OnboardingTooltip.jsx
│   ├── OnboardingHighlight.jsx
│   └── ChecklistPanel.jsx
│
├── account/
│   ├── AccountSettings.jsx
│   ├── AccountPageHeader.jsx
│   ├── AccountPageLoading.jsx
│   └── LinkedAccountsSection.jsx
│
├── auth/
│   ├── AuthScreen.jsx
│   ├── PasswordStrengthIndicator.jsx
│   └── EmailVerificationError.jsx
│
├── cookies/
│   ├── CookieBanner.jsx
│   ├── CookieSettings.jsx
│   ├── CookieRegistry.jsx
│   └── ConsentHistory.jsx
│
├── feedback/
│   ├── FeedbackButton.jsx
│   ├── FeedbackModal.jsx
│   └── StarRating.jsx
│
├── notifications/
│   ├── NotificationProvider.jsx
│   └── NotificationContainer.jsx
│
└── analytics/
    └── ConditionalAnalytics.jsx
```
