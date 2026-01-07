# Inventaire des Composants - FitMyCV.io

> Document généré automatiquement le 2026-01-07 par scan exhaustif du projet
> **149 composants React** documentés

## Vue d'Ensemble

| Catégorie | Quantité |
|-----------|----------|
| Providers | 7 |
| Sections CV | 8 |
| TopBar | 15+ |
| Onboarding | 8 |
| Subscription | 12 |
| Admin | 15+ |
| Auth | 5+ |
| UI réutilisables | 20+ |
| Autres | 50+ |

---

## Hiérarchie des Providers

```jsx
<SessionProvider>           {/* NextAuth session */}
  <RecaptchaProvider>       {/* Google reCAPTCHA v3 */}
    <SettingsProvider>      {/* Paramètres système */}
      <LanguageProvider>    {/* i18n (4 langues) */}
        <NotificationProvider>  {/* Notifications toast */}
          <AdminProvider>   {/* Mode édition + CV courant */}
            <OnboardingProvider>  {/* État onboarding */}
              {/* Conditionnel */}
              <RealtimeRefreshProvider>  {/* SSE sync */}
                <BackgroundTasksProvider>  {/* Queue tâches */}
                  {children}
                </BackgroundTasksProvider>
              </RealtimeRefreshProvider>
            </OnboardingProvider>
          </AdminProvider>
        </NotificationProvider>
      </LanguageProvider>
    </SettingsProvider>
  </RecaptchaProvider>
</SessionProvider>
```

---

## Providers (7)

| Composant | Fichier | Taille | Fonction |
|-----------|---------|--------|----------|
| **RootProviders** | `components/RootProviders.jsx` | ~2KB | Orchestration de tous les providers |
| **BackgroundTasksProvider** | `components/BackgroundTasksProvider.jsx` | 11.5KB | Gestion queue tâches, polling SSE |
| **HighlightProvider** | `components/HighlightProvider.jsx` | 13.9KB | Changements CV, versioning, review |
| **RealtimeRefreshProvider** | `components/RealtimeRefreshProvider.jsx` | 1KB | Sync temps réel via SSE |
| **AdminProvider** | `components/admin/AdminProvider.jsx` | ~5KB | Mode édition, CV courant |
| **OnboardingProvider** | `components/onboarding/OnboardingProvider.jsx` | 42KB | État onboarding complet |
| **NotificationProvider** | `components/notifications/NotificationProvider.jsx` | ~3KB | Toasts notifications |

---

## Sections CV (8)

Composants pour l'affichage et l'édition du CV.

| Composant | Fichier | Taille | Fonction |
|-----------|---------|--------|----------|
| **Header** | `components/Header.jsx` | 32KB | En-tête CV (contact, score, source) |
| **Summary** | `components/Summary.jsx` | ~8KB | Résumé professionnel |
| **Skills** | `components/Skills.jsx` | 17KB | Compétences (hard/soft/tools/methods) |
| **Experience** | `components/Experience.jsx` | 27KB | Expériences professionnelles |
| **Education** | `components/Education.jsx` | 11KB | Formation |
| **Languages** | `components/Languages.jsx` | 7KB | Langues parlées |
| **Projects** | `components/Projects.jsx` | 14KB | Projets personnels/portfolio |
| **Extras** | `components/Extras.jsx` | 8KB | Certifications, extras |

### Composants auxiliaires sections

| Composant | Fonction |
|-----------|----------|
| **Section** | Conteneur sémantique avec backdrop blur |
| **ChangeHighlight** | Highlighting des changements IA |
| **BulletHighlight** | Highlight bullet points |
| **SkillItemHighlight** | Highlight compétences |
| **InlineDiff** | Comparaison avant/après |
| **ExperienceReviewActions** | Actions review batch |
| **SectionReviewActions** | Accept/reject all |

---

## TopBar (15+)

Navigation principale avec modals et hooks.

### Composant Principal
| Composant | Fichier | Fonction |
|-----------|---------|----------|
| **TopBar** | `components/TopBar/TopBar.jsx` | Navigation, sélection CV, actions |
| **ConditionalTopBar** | `components/ConditionalTopBar.jsx` | Wrapper conditionnel |

### Hooks (9)
| Hook | Fonction |
|------|----------|
| `useTopBarState` | État CV list, filtres, CV courant |
| `useCvOperations` | Load, reload, select CV |
| `useGeneratorModal` | Flow génération CV |
| `useScrollBehavior` | Position sticky |
| `useModalStates` | États open/close modals |
| `useExportModal` | Settings export PDF |
| `useSubscriptionData` | Plan/crédits |
| `useFilterState` | UI filtres/recherche |
| `useWrapDetection` | Détection responsive |

### Modals (6)
| Modal | Fonction |
|-------|----------|
| **CvGeneratorModal** | Génération depuis offre |
| **PdfImportModal** | Import PDF → CV |
| **NewCvModal** | Création manuelle |
| **DeleteCvModal** | Confirmation suppression |
| **ExportPdfModal** | Export PDF avec options |
| **SectionCard** | Sélection sections export |

### Sous-composants
| Composant | Fonction |
|-----------|----------|
| **FilterDropdown** | Dropdown filtres |
| **ItemLabel** | Label CV dans liste |

---

## Onboarding (8)

Système de guidage utilisateur.

| Composant | Fichier | Taille | Fonction |
|-----------|---------|--------|----------|
| **OnboardingProvider** | `onboarding/OnboardingProvider.jsx` | 42KB | État et orchestration |
| **OnboardingOrchestrator** | `onboarding/OnboardingOrchestrator.jsx` | 54KB | Logique flow |
| **OnboardingModal** | `onboarding/OnboardingModal.jsx` | ~10KB | Affichage steps |
| **OnboardingCompletionModal** | `onboarding/OnboardingCompletionModal.jsx` | ~5KB | Écran succès |
| **WelcomeModal** | `onboarding/WelcomeModal.jsx` | ~3KB | Point d'entrée |
| **ChecklistPanel** | `onboarding/ChecklistPanel.jsx` | ~8KB | Progression |
| **OnboardingHighlight** | `onboarding/OnboardingHighlight.jsx` | ~5KB | Highlighting cible |
| **OnboardingTooltip** | `onboarding/OnboardingTooltip.jsx` | ~4KB | Aide contextuelle |

---

## Subscription (12)

Gestion abonnements et crédits.

| Composant | Fonction |
|-----------|----------|
| **SubscriptionsPage** | Page principale avec tabs |
| **CurrentPlanCard** | Affichage plan actuel |
| **PlanComparisonCards** | Comparaison plans |
| **FeatureCountersCard** | Compteurs usage |
| **CreditBalanceCard** | Solde crédits |
| **CreditPacksCards** | Packs à l'achat |
| **CreditTransactionsTable** | Historique transactions |
| **InvoicesTable** | Factures |
| **CreditBalanceBanner** | Banner solde |
| **NegativeBalanceBanner** | Alerte solde négatif |
| **CreditCountersCard** | Compteurs détaillés |
| **CreditCostDisplay** | Affichage coût feature |

---

## Admin (15+)

Interface d'administration.

| Composant | Fonction |
|-----------|----------|
| **AdminProvider** | Context admin |
| **OverviewTab** | Vue d'ensemble |
| **RevenueTab** | Statistiques revenus |
| **OnboardingTab** | Analytics onboarding |
| **EmailTemplatesTab** | Gestion templates |
| **EmailStatsKPIs** | KPIs email |
| **EmailLogsTable** | Logs envois |
| **SettingsTab** | Paramètres système |
| **UsersTab** | Gestion utilisateurs |
| **ConfirmDialog** | Confirmation actions |
| **CustomSelect** | Select personnalisé |
| **PdfImportSettings** | Config import PDF |
| **SectionOrderSettings** | Ordre sections CV |

---

## Auth (5+)

Authentification et inscription.

| Composant | Fonction |
|-----------|----------|
| **LoginForm** | Formulaire connexion |
| **RegisterForm** | Formulaire inscription |
| **ForgotPasswordForm** | Récupération mdp |
| **ResetPasswordForm** | Réinitialisation mdp |
| **VerifyEmailPage** | Vérification email |
| **OAuthButtons** | Boutons OAuth |

---

## UI Réutilisables (20+)

Composants UI génériques.

| Composant | Fichier | Fonction |
|-----------|---------|----------|
| **Modal** | `ui/Modal.jsx` | Modal avec portal, focus trap |
| **Tooltip** | `ui/Tooltip.jsx` | Tooltip hover |
| **SkeletonLoader** | `ui/SkeletonLoader.jsx` | Loading placeholder |
| **DonutProgress** | `ui/DonutProgress.jsx` | Indicateur circulaire |
| **Button** | `ui/Button.jsx` | Bouton stylisé |
| **Input** | `ui/Input.jsx` | Input avec validation |
| **Select** | `ui/Select.jsx` | Select dropdown |
| **Checkbox** | `ui/Checkbox.jsx` | Checkbox stylisée |
| **Badge** | `ui/Badge.jsx` | Badge/tag |
| **Card** | `ui/Card.jsx` | Conteneur card |
| **Spinner** | `ui/Spinner.jsx` | Loading spinner |
| **Alert** | `ui/Alert.jsx` | Message alerte |
| **Tabs** | `ui/Tabs.jsx` | Navigation tabs |
| **Table** | `ui/Table.jsx` | Table stylisée |
| **Pagination** | `ui/Pagination.jsx` | Navigation pages |

---

## Composants Spécialisés

### Score et Amélioration
| Composant | Fonction |
|-----------|----------|
| **MatchScore** | Affichage score correspondance |
| **CVImprovementPanel** | Panel amélioration IA (45KB) |
| **ChangesPanel** | Panneau changements |
| **SourceInfo** | Info source CV |

### Tâches Background
| Composant | Fonction |
|-----------|----------|
| **TaskQueueModal** | Modal queue tâches |
| **TaskQueueDropdown** | Dropdown compact |
| **TaskItem** | Item tâche individuel |
| **TaskProgress** | Barre progression |

### Notifications
| Composant | Fonction |
|-----------|----------|
| **NotificationProvider** | Context notifications |
| **NotificationContainer** | Conteneur toasts |
| **Toast** | Notification individuelle |

### Feedback
| Composant | Fonction |
|-----------|----------|
| **FeedbackWidget** | Widget feedback |
| **FeedbackModal** | Modal feedback |
| **StarRating** | Rating étoiles |

### Cookies
| Composant | Fonction |
|-----------|----------|
| **CookieBanner** | Banner RGPD |
| **CookiePreferences** | Préférences cookies |

### Analytics
| Composant | Fonction |
|-----------|----------|
| **AnalyticsChart** | Graphique Recharts |
| **KPICard** | Carte KPI |
| **TimelineChart** | Graphique timeline |

---

## Patterns de Composants

### Pattern Provider
```jsx
const MyContext = createContext();

export function MyProvider({ children }) {
  const [state, setState] = useState(initialState);

  const value = useMemo(() => ({
    state,
    actions: { ... }
  }), [state]);

  return (
    <MyContext.Provider value={value}>
      {children}
    </MyContext.Provider>
  );
}

export const useMyContext = () => useContext(MyContext);
```

### Pattern Modal
```jsx
function MyModal({ isOpen, onClose, children }) {
  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button onClick={onClose}>×</button>
        {children}
      </div>
    </div>,
    document.body
  );
}
```

### Pattern Section CV
```jsx
function MySection({ data, editing, onSave }) {
  const [editIndex, setEditIndex] = useState(null);
  const [formData, setFormData] = useState({});
  const { pendingChanges } = useHighlight();
  const { mutate } = useMutate();

  // Highlight des changements IA
  const hasChanges = pendingChanges.some(c => c.section === 'my_section');

  return (
    <Section title="My Section" hasChanges={hasChanges}>
      {/* Contenu avec édition inline */}
    </Section>
  );
}
```

---

## Fichiers Volumineux (>10KB)

| Fichier | Taille | Raison |
|---------|--------|--------|
| `OnboardingOrchestrator.jsx` | 54KB | Logique flow complexe |
| `CVImprovementPanel.jsx` | 45KB | Modal complète amélioration |
| `OnboardingProvider.jsx` | 42KB | État onboarding extensif |
| `Header.jsx` | 32KB | Section complexe avec score |
| `Experience.jsx` | 27KB | Nombreuses fonctionnalités |
| `TopBar.jsx` | 25KB | Navigation principale |
| `Skills.jsx` | 17KB | 4 catégories compétences |
| `Projects.jsx` | 14KB | Gestion projets |
| `HighlightProvider.jsx` | 13.9KB | Review système |
| `BackgroundTasksProvider.jsx` | 11.5KB | Queue management |
| `Education.jsx` | 11KB | Formation |
| `MatchScore.jsx` | 11.5KB | Affichage score |

---

## Communication Inter-Composants

### Events Window
```javascript
// Émission
window.dispatchEvent(new Event('cv:list:changed'));

// Écoute
window.addEventListener('cv:list:changed', handleChange);
```

### Events Utilisés
| Event | Émetteur | Écouteurs |
|-------|----------|-----------|
| `cv:list:changed` | TopBar | AdminProvider |
| `credits-updated` | API | Header, Subscription |
| `task:completed` | BackgroundTasksProvider | HighlightProvider, Onboarding |
| `realtime:cv:updated` | RealtimeRefreshProvider | Header, CVImprovementPanel |
| `tokens:updated` | Auth | Session refresh |
| `TOPBAR_READY` | TopBar | Onboarding |
| `cv:count:updated` | CVs API | Onboarding |

---

## Accessibilité

### Modal.jsx
- Focus trap (Tab cycling)
- Escape key close
- aria-modal, role="dialog"
- Scroll lock avec compensation scrollbar

### Onboarding
- Highlight avec overlay
- Tooltips positionnés
- Keyboard navigation
- Checklist visuelle

### Forms
- Labels associés
- Validation accessible
- Error messages
- Focus management
