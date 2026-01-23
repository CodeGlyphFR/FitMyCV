# Composants React - FitMyCV.io

> Documentation des 138 fichiers organisés en 20 domaines (150+ composants)

---

## Vue d'ensemble

| Catégorie | Fichiers | Description |
|-----------|----------|-------------|
| TopBar | 38 | Navigation principale, modales, hooks |
| Admin | 33 | Dashboard administration |
| UI System | 18 | Design system réutilisable |
| CV Improvement | 10 | Panel optimisation IA |
| CV Review | 10 | Surlignage modifications IA |
| Onboarding | 10 | Parcours guidé interactif |
| Subscription | 9 | Abonnements et crédits |
| Layout | 9 | Structure page |
| CV Sections | 8 | Sections éditables du CV |
| Providers | 6 | Contextes globaux |
| Cookies | 4 | Consentement RGPD |
| Account | 4 | Gestion compte utilisateur |
| Auth | 3 | Authentification |
| Feedback | 3 | Retours utilisateurs |
| Task Queue | 2 | Gestion tâches background |
| Notifications | 2 | Toast notifications |
| Header | 2 | Composants header CV |
| Pages | 2 | Contenu pages statiques |
| Empty States | 1 | États vides standardisés |

---

## 1. TopBar (38 fichiers)

Barre de navigation principale avec gestion CV, tâches, filtres et actions.

### Composant Principal

**TopBar.jsx** (688 lignes)
- Intègre ~10 hooks personnalisés
- État complexe : sélecteur CV, filtres, task queue, modales
- Gestion événements temps réel et synchronisation

### Sous-composants (`components/`)

| Composant | Rôle |
|-----------|------|
| `CvDropdownPortal` | Dropdown sélection CV avec React Portal |
| `FilterDropdown` | Filtres par type, langue, date |
| `ItemLabel` | Affichage intelligent du nom CV |
| `TopBarActions` | Boutons d'action (export, générer) |
| `TopBarModals` | Conteneur des modales |
| `UserMenuPortal` | Menu utilisateur (compte, logout) |
| `TopBarStyles` | Styles CSS-in-JS |

### Hooks personnalisés (`hooks/`)

| Hook | Rôle |
|------|------|
| `useTopBarState` | État principal (items, current, scroll) |
| `useCvOperations` | Opérations CV (create, delete, select) |
| `useGeneratorModal` | Gestion modal génération |
| `useModalStates` | État des 5+ modales |
| `useExportModal` | Export PDF avec templates |
| `useSubscriptionData` | Données plan/crédits |
| `useFilterState` | Filtres multi-critères |
| `useScrollBehavior` | Détection scroll |
| `useWrapDetection` | Responsivité dynamique |

### Modales (`modals/`)

| Modale | Rôle |
|--------|------|
| `CvGeneratorModal` | Génération CV par titre/offre/fichier |
| `NewCvModal` | Création nouveau CV |
| `DeleteCvModal` | Suppression unitaire |
| `BulkDeleteCvModal` | Suppression multiple |
| `PdfImportModal` | Import PDF avec extraction IA |
| `ExportPdfModal` | Export PDF avec sélection sections |

### Patterns

- **Composition hooks** : 10+ hooks = ~400 LOC extraites
- **React Portals** : dropdowns au-delà du DOM parent
- **Events globaux** : `cv:list:changed`, `realtime:cv:list:changed`
- **Memoization** : `useMemo` sur filteredItems, availableOptions

---

## 2. CV Sections (8 fichiers)

Composants d'édition des sections du CV.

| Composant | Lignes | Rôle |
|-----------|--------|------|
| `Header.jsx` | 456 | En-tête CV + MatchScore + CVImprovementPanel |
| `Experience.jsx` | 80+ | Expériences avec tri intelligent par date |
| `Education.jsx` | - | Formation, diplômes |
| `Skills.jsx` | - | Compétences avec niveaux |
| `Projects.jsx` | - | Projets personnels |
| `Languages.jsx` | - | Langues parlées |
| `Summary.jsx` | - | Résumé professionnel |
| `Extras.jsx` | - | Certifications, publications |

### Patterns

- **Section wrapper** : `Section.jsx` pour structure commune
- **useMutate** : mutations CV locales
- **ChangeHighlight** : intégration review IA
- **Modal.jsx** : édition inline

---

## 3. CV Improvement (10 fichiers)

Panel d'optimisation IA côté client.

### Composant Principal

**CVImprovementPanel.jsx** (494 lignes)
- Récupère metadata via `/api/cv/metadata`
- Modal portail avec animation
- Affiche score, suggestions, skills manquants
- Applique améliorations via `/api/cv/improve`

### Sous-composants

| Composant | Rôle |
|-----------|------|
| `ScoreVisualization` | Visualisation score + breakdown |
| `SuggestionsSection` | Suggestions IA avec contexte |
| `MissingSkillsSection` | Skills à ajouter + niveaux |
| `MatchingSkillsSection` | Skills détectés dans offre |
| `SourceInfo` | Icône source (offre/CV) |
| `MatchScore` | Bouton score avec refresh |
| `OptimizationFooter` | Boutons actions |
| `VersionSelector` | Sélection versions |

### Hooks

| Hook | Rôle |
|------|------|
| `useAnimatedScore` | Animation score ouverture |
| `useModalAccessibility` | Focus trap, ESC |

### Patterns

- **React Portal** : `createPortal` pour modal
- **Framer Motion** : Animation fade-in/slide-up à l'ouverture
- **CSS keyframes** : animations score
- **Set/Map** : sélections suggestions/skills

#### Modal - Configuration Animation

Le composant `Modal` utilise Framer Motion pour des animations fluides :

```jsx
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2, ease: "easeOut" }}
>
  {/* Contenu modal */}
</motion.div>
```

**Paramètres d'animation :**

| Propriété | Valeur | Description |
|-----------|--------|-------------|
| `initial.opacity` | 0 | Invisible au départ |
| `initial.y` | 8 | Décalé de 8px vers le bas |
| `animate.opacity` | 1 | Pleinement visible |
| `animate.y` | 0 | Position finale |
| `duration` | 0.2s | Durée de transition |
| `ease` | "easeOut" | Courbe d'accélération |

**Gestion mobile (safe-area) :**

```css
top: env(safe-area-inset-top);
left: env(safe-area-inset-left);
right: env(safe-area-inset-right);
bottom: env(safe-area-inset-bottom);
```

Le modal évite automatiquement les encoches et barres système sur mobile (iPhone notch, etc.).

---

## 4. CV Review (10 fichiers)

Surlignage et review des changements IA.

| Composant | Rôle |
|-----------|------|
| `ChangeHighlight` | Wrapper surligné contenu modifié |
| `ChangeReviewPopover` | Popover avant/après |
| `InlineDiff` | Diff inline (strikethrough/highlight) |
| `SkillItemHighlight` | Surbrillance items skill |
| `ExperienceReviewActions` | Actions batch expérience (positionné en haut à droite) |
| `ProjectReviewActions` | Actions batch projet |
| `SectionReviewActions` | Actions batch section |
| `SkillsReviewActions` | Actions batch skills |
| `LanguageReviewActions` | Actions batch langues |
| `OrphanedChangesDisplay` | Changements orphelins |

### Patterns

- **useHighlight context** : pendingChanges
- **Diff pathfinding** : `section.field` vs `section[idx].field`
- **Batch actions** : accept/reject multiples
- **Status tracking** : pending/accepted/rejected

#### ExperienceReviewActions - Positionnement

Les boutons "Tout accepter" / "Tout refuser" sont positionnés **en haut à droite** de chaque carte d'expérience pour une meilleure hiérarchie visuelle :

```jsx
// Dans Experience.jsx - header de la carte
<div className="flex items-center justify-between">
  <h3>{experience.title}</h3>
  <ExperienceReviewActions expIndex={index} />
</div>
```

Ce positionnement permet :
- Une action rapide sans interférer avec le contenu
- Une cohérence avec le pattern ContextMenu (kebab en haut à droite)
- Une meilleure visibilité des actions de review

---

## 5. Admin Dashboard (33 fichiers)

Dashboard d'administration complet.

### Provider

**AdminProvider.jsx** (100+ lignes)
- Context editing mode
- Détection localStorage currentFile
- Tracking existence CV

### Tabs Principaux

| Tab | Rôle |
|-----|------|
| `OverviewTab` | KPIs (MRR, users, CVs) |
| `RevenueTab` | Analytics revenus (graphiques) |
| `OnboardingTab` | Tracking onboarding (dropoff, timeline) |
| `UsersTab` | Gestion utilisateurs (filter, search) |
| `FeaturesTab` | Feature flags |
| `FeedbackTab` | Retours utilisateurs |
| `SettingsTab` | Configurations système |
| `OpenAICostsTab` | Monitoring coûts OpenAI |
| `SubscriptionPlansTab` | Gestion plans Stripe |
| `ErrorsTab` | Error tracking |

### Composants Analytics

| Composant | Rôle |
|-----------|------|
| `KPICard` | Carte KPI avec tendance |
| `MRRHistoryChart` | Chart MRR (recharts) |
| `OnboardingDropoffChart` | Analytics dropoff |
| `OnboardingStatusChart` | Distribution status |
| `OnboardingUsersTable` | Users + onboarding state |
| `PlanDistributionChart` | Distribution plans |
| `CreditTransactionsTable` | Transactions crédits |
| `UserFilter` | Filtres utilisateurs |

### Email Management

| Composant | Rôle |
|-----------|------|
| `EmailDashboard` | Interface principale |
| `EmailConfigSection` | Config SMTP/Resend |
| `EmailTemplatesSection` | Templates éditeur |
| `EmailHistorySection` | Historique envois |
| `EmailNav` | Navigation tabs |

### Hooks Admin

| Hook | Rôle |
|------|------|
| `useAlertManagement` | Gestion alertes système |
| `useOpenAICostsData` | Fetch coûts OpenAI |
| `usePricingManagement` | Gestion pricing |
| `useScrollChaining` | Scroll behavior |

---

## 6. Subscription/Credits (9 fichiers)

Gestion abonnements Stripe et crédits.

### Composant Principal

**SubscriptionsPage.jsx** (100+ lignes)
- Tabs : subscription, credits, invoices, features
- Fetch `/api/subscription/current` et `/api/credits/balance`
- Gestion messages succès/erreur Stripe

### Composants

| Composant | Rôle |
|-----------|------|
| `CurrentPlanCard` | Plan actuel + downgrade/upgrade |
| `PlanComparisonCards` | Comparaison plans |
| `CreditBalanceCard` | Solde + progression |
| `CreditPacksCards` | Packs achat crédit |
| `FeatureCountersCard` | Compteurs mensuels |
| `CreditTransactionsTable` | Historique transactions |
| `InvoicesTable` | Factures Stripe |
| `CreditBalanceBanner` | Alerte crédits faibles |

### Plan Comparison

| Composant | Rôle |
|-----------|------|
| `PlanCard` | Carte plan |
| `UpgradeModal` | Confirmation upgrade |
| `DowngradeToFreeModal` | Downgrade → free |
| `DowngradePaidModal` | Downgrade entre payants |
| `usePlanComparison` | Hook logique |

---

## 7. Onboarding (10 fichiers)

Système d'onboarding interactif guidé.

### Provider

**OnboardingProvider.jsx** (100+ lignes)
- Context OnboardingContext
- Suivi progression (currentStep, completedSteps)
- Auto-start logic
- State persistence localStorage

### Composants

| Composant | Rôle |
|-----------|------|
| `OnboardingOrchestrator` | Orchestrateur principal |
| `OnboardingModal` | Modal carousel Framer Motion |
| `OnboardingTooltip` | Tooltips positionnés |
| `OnboardingHighlight` | Highlight élément cible |
| `ChecklistPanel` | Checklist progression |
| `OnboardingCompletionModal` | Modal complétude |
| `WelcomeModal` | Premier accueil |
| `StepRenderer` | Renderer dynamique étapes |
| `ConfettiCelebration` | Animation confetti |

### Hooks Onboarding (9 hooks)

| Hook | Rôle |
|------|------|
| `useOnboardingFetch` | Fetch state initial |
| `useStepNavigation` | Navigation steps |
| `useOnboardingAutoStart` | Démarrage auto |
| `useOnboardingStateUpdater` | Update state |
| `useConditionChecker` | Check conditions step |
| `useButtonInterception` | Intercept buttons |
| `useDebouncedPersist` | Persist debounced |
| `useStableEventListener` | Event listeners stables |

### Patterns

- **Multi-step flow** avec conditions
- **Framer Motion** animations
- **Event-driven** : ONBOARDING_EVENTS
- **State machine-like**

---

## 8. Providers (6 fichiers)

Contextes globaux et synchronisation temps réel.

### RootProviders.jsx

Stack de 10 providers imbriqués :

```jsx
<SessionProvider>           // NextAuth
  <SettingsProvider>        // Config app
    <LanguageProvider>      // i18n
      <NotificationProvider>  // Toasts
        <AdminProvider>       // Mode édition
          <OnboardingProvider>  // Parcours
            <RealtimeRefreshProvider>  // WebSocket
              <BackgroundTasksProvider>  // Tasks
                <PipelineProgressProvider>  // Génération
                  <RecaptchaProvider>  // reCAPTCHA
                    {children}
                  </RecaptchaProvider>
                </PipelineProgressProvider>
              </BackgroundTasksProvider>
            </RealtimeRefreshProvider>
          </OnboardingProvider>
        </AdminProvider>
      </NotificationProvider>
    </LanguageProvider>
  </SettingsProvider>
</SessionProvider>
```

### HighlightProvider.jsx (150+ lignes)

- Review system pour changements IA
- Version management
- pendingChanges state
- acceptChange/rejectChange methods
- Progress tracking (total/reviewed/pending)

### Autres Providers

| Provider | Rôle |
|----------|------|
| `BackgroundTasksProvider` | Task queue management |
| `RealtimeRefreshProvider` | WebSocket/SSE sync |
| `PipelineProgressProvider` | Progress génération CV |
| `RecaptchaProvider` | reCAPTCHA v3 integration |

---

## 9. UI Design System (18 fichiers)

Composants réutilisables du design system.

### Composants Génériques

| Composant | Rôle |
|-----------|------|
| `Modal` | Modal wrapper générique avec animations Framer Motion |
| `ModalForm` | Composants form (Section, Field, Input, Grid) |
| `Tooltip` | Hover tooltips |
| `LoadingOverlay` | Overlay chargement |
| `SkeletonLoader` | Skeleton components |
| `TipBox` | Box conseil/astuce |
| `EmptyState` | État vide standardisé |
| `ContextMenu` | Menu contextuel kebab (⋮) avec actions edit/delete |

#### ContextMenu (Détaillé)

Menu contextuel réutilisable avec icône kebab (⋮), utilisé pour remplacer les boutons edit/delete par un menu unifié.

**Props :**

| Prop | Type | Description |
|------|------|-------------|
| `items` | `Array` | Liste des actions du menu |
| `className` | `string` | Classes CSS additionnelles |

**Structure d'un item :**

```javascript
{
  icon: LucideIcon,     // Icône optionnelle (Lucide React)
  label: string,        // Texte de l'action
  onClick: () => void,  // Callback au clic
  danger: boolean       // Style rouge pour actions destructives
}
```

**Exemple d'utilisation :**

```jsx
import ContextMenu from '@/components/ui/ContextMenu';
import { Pencil, Trash2 } from 'lucide-react';

<ContextMenu
  items={[
    {
      icon: Pencil,
      label: t('common.edit'),
      onClick: () => setEditMode(true)
    },
    {
      icon: Trash2,
      label: t('common.delete'),
      onClick: handleDelete,
      danger: true
    }
  ]}
/>
```

**Fonctionnalités :**

- **Positionnement dynamique** : Calcul automatique pour éviter les débordements écran
- **React Portal** : Rendu via `createPortal` au niveau `document.body` (z-index 10002)
- **Fermeture automatique** : Click outside, touche Escape, scroll de la page
- **Accessibilité** : Attributs ARIA (`role="menu"`, `aria-expanded`, `aria-haspopup`)
- **Animations** : `animate-in`, `fade-in`, `slide-in-from-top/bottom`

**Utilisation dans le projet :**

- Sections CV (Experience, Education, Projects, Skills, Languages, Extras)
- Remplace les anciens boutons edit/delete inline

### Composants Formulaires

| Composant | Rôle |
|-----------|------|
| `CountrySelect` | Sélecteur pays |
| `LanguageSwitcher` | Switch langue app |
| `PasswordInput` | Input password show/hide |
| `MonthPicker` | Sélecteur mois |

### Composants Métier

| Composant | Rôle |
|-----------|------|
| `CreditCostDisplay` | Affichage coût crédit |
| `CreditCostTooltip` | Tooltip coût détail |
| `CreditCounter` | Compteur crédits TopBar |
| `GenericTaskProgressBar` | Barre progrès tâche |
| `PipelineTaskProgress` | Progrès génération |

### Composants Visuels

| Composant | Rôle |
|-----------|------|
| `DefaultCvIcon` | Icône CV défaut |
| `GptLogo` | Logo GPT |
| `IconPreloader` | Préchargement icônes |

### Patterns

- **Tailwind CSS** composable
- **Lucide React** icons
- **Accessible** (ARIA labels)
- **Responsive** design

---

## 10. Layout (9 fichiers)

Composants structure de page.

| Composant | Rôle |
|-----------|------|
| `Section` | Container section avec titre |
| `ConditionalTopBar` | TopBar si authentifié |
| `ConditionalFooter` | Footer conditionnel |
| `ConditionalMainWrapper` | Main wrapper conditionnel |
| `TopBarSpacer` | Spacer pour TopBar fixed |
| `ConditionalTopBarSpacer` | Spacer conditionnel |
| `Footer` | Footer avec liens |
| `GlobalBackground` | Background global |
| `ScrollToTopOnMount` | Auto scroll top |

### Patterns

- **Conditional rendering** route-based
- **Fixed/relative** positioning
- **Grid/flex** layouts

---

## 11. Autres Domaines

### Authentication (3 fichiers)

| Composant | Rôle |
|-----------|------|
| `AuthScreen` | Écran login/register |
| `EmailVerificationError` | Erreur vérification |
| `PasswordStrengthIndicator` | Indicateur force mot de passe |

### Account (4 fichiers)

| Composant | Rôle |
|-----------|------|
| `AccountPageHeader` | Header compte |
| `AccountSettings` | Settings utilisateur |
| `LinkedAccountsSection` | Comptes OAuth liés |
| `AccountPageLoading` | Skeleton loading |

### Cookies Consent (4 fichiers)

| Composant | Rôle |
|-----------|------|
| `CookieBanner` | Banner consentement |
| `CookieSettings` | Settings cookies |
| `CookieRegistry` | Registry cookies |
| `ConsentHistory` | Historique consentements |

### Feedback (3 fichiers)

| Composant | Rôle |
|-----------|------|
| `FeedbackButton` | Bouton feedback floating |
| `FeedbackModal` | Modal feedback |
| `StarRating` | Composant étoiles |

### Task Queue (2 fichiers)

| Composant | Rôle |
|-----------|------|
| `TaskQueueDropdown` | Dropdown tâches TopBar |
| `TaskQueueModal` | Modal détail tâches |

### Notifications (2 fichiers)

| Composant | Rôle |
|-----------|------|
| `NotificationProvider` | Context notifications |
| `NotificationContainer` | Conteneur affichage |

### Header CV (2 fichiers)

| Composant | Rôle |
|-----------|------|
| `index.js` | Export hooks (useMatchScore, useSourceInfo, useTranslation) |
| `TranslationDropdown` | Dropdown traduction CV |

### Pages Content (2 fichiers)

| Composant | Rôle |
|-----------|------|
| `AboutContent` | Page À propos |
| `LegalContent` | Page Mentions légales |

---

## Patterns Critiques

### 1. Custom Hooks Composition

Extraction de la logique dans des hooks réutilisables.

```javascript
// TopBar utilise 10+ hooks
const { items, currentCvFile, handleSelect } = useTopBarState();
const { createCv, deleteCv, duplicateCv } = useCvOperations();
const { modalState, openModal, closeModal } = useModalStates();
```

### 2. Context API Nesting

10 providers empilés pour état global.

```javascript
// RootProviders.jsx
<SessionProvider>
  <SettingsProvider>
    <LanguageProvider>
      {/* ... 7 autres providers */}
    </LanguageProvider>
  </SettingsProvider>
</SessionProvider>
```

### 3. React Portals

Dropdowns et modales rendus au niveau body.

```javascript
import { createPortal } from 'react-dom';

const CvDropdownPortal = ({ children }) =>
  createPortal(children, document.body);
```

### 4. Event-Driven Architecture

Communication via window events.

```javascript
// Émettre
window.dispatchEvent(new CustomEvent('cv:list:changed'));

// Écouter
useEffect(() => {
  const handler = () => refetchCvs();
  window.addEventListener('cv:list:changed', handler);
  return () => window.removeEventListener('cv:list:changed', handler);
}, []);
```

### 5. useMutate Pattern

Mutations CV avec mise à jour optimiste.

```javascript
const { mutate } = useMutate();

const handleUpdate = (field, value) => {
  mutate(draft => {
    draft.experience[index][field] = value;
  });
};
```

### 6. Framer Motion Animations

Animations fluides pour modales et transitions.

```javascript
import { motion, AnimatePresence } from 'framer-motion';

<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
    >
      {children}
    </motion.div>
  )}
</AnimatePresence>
```

### 7. Real-time Sync

Synchronisation temps réel via SSE/WebSocket.

```javascript
// RealtimeRefreshProvider
useEffect(() => {
  const eventSource = new EventSource('/api/realtime');
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'cv:updated') {
      refetchCv(data.cvId);
    }
  };
  return () => eventSource.close();
}, []);
```

---

## Dépendances entre Domaines

```
TopBar
  ├── AdminProvider (context)
  ├── LanguageProvider (context)
  ├── BackgroundTasksProvider (context)
  ├── PipelineProgressProvider (context)
  └── NotificationProvider (context)

Header (cv-sections)
  ├── CVImprovementPanel (cv-improvement)
  ├── MatchScore (cv-improvement)
  ├── ChangeHighlight (cv-review)
  └── HighlightProvider (context)

SubscriptionsPage
  ├── CurrentPlanCard
  ├── PlanComparisonCards
  ├── CreditBalanceCard
  └── InvoicesTable

OnboardingOrchestrator
  ├── OnboardingModal
  ├── OnboardingTooltip
  ├── ChecklistPanel
  └── WelcomeModal
```

---

## Fichiers Clés par Domaine

| Domaine | Fichier Principal | Lignes |
|---------|-------------------|--------|
| Navigation | `TopBar/TopBar.jsx` | 688 |
| CV Sections | `cv-sections/Header.jsx` | 456 |
| Optimisation IA | `cv-improvement/CVImprovementPanel.jsx` | 494 |
| Review IA | `cv-review/ChangeHighlight.jsx` | 150+ |
| Admin | `admin/AdminProvider.jsx` | 100+ |
| Abonnements | `subscription/SubscriptionsPage.jsx` | 100+ |
| Onboarding | `onboarding/OnboardingProvider.jsx` | 100+ |
| Providers | `providers/RootProviders.jsx` | 50+ |
