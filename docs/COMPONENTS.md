# Composants React - FitMyCv.ai

Catalogue complet des 89 composants React de l'application.

---

## Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Composants CV (Affichage)](#composants-cv-affichage)
- [TopBar & Navigation](#topbar--navigation)
- [Admin & Analytics](#admin--analytics)
- [Authentication](#authentication)
- [UI Components](#ui-components)
- [Providers & Context](#providers--context)
- [Autres composants](#autres-composants)

---

## Vue d'ensemble

### Organisation

Les composants sont organisés par fonctionnalité dans `components/` :

```
components/
├── TopBar/           # Navigation principale (1 composant + sous-composants)
├── admin/            # Admin et analytics (20+ composants)
├── auth/             # Authentification (4 composants)
├── ui/               # UI réutilisables (10+ composants)
├── cookies/          # Gestion cookies RGPD (4 composants)
├── feedback/         # Système de feedback (3 composants)
├── account/          # Paramètres compte (1 composant)
├── notifications/    # Notifications (2 composants)
├── [CV]              # Affichage CV (10 composants)
└── [Providers]       # Context providers (8 composants)
```

### Conventions

- **Client Components** : Marqués avec `'use client'`
- **Server Components** : Par défaut (pas de `'use client'`)
- **Props** : TypeScript-like JSDoc pour la documentation
- **Styling** : Tailwind CSS

---

## Composants CV (Affichage)

### Header.jsx

Affiche l'en-tête du CV (nom, titre, contact).

**Props** :

```javascript
{
  data: {
    full_name: string,
    current_title: string,
    contact: {
      email: string,
      phone: string,
      links: string[],
      location: string
    }
  },
  lang: string // 'fr' | 'en' | 'es' | ...
}
```

**Usage** :

```jsx
<Header data={cvData.header} lang="fr" />
```

---

### Summary.jsx

Résumé professionnel et domaines d'expertise.

**Props** :

```javascript
{
  data: {
    description: string,
    domains: string[]
  },
  lang: string
}
```

**Rendu** :

- Description (paragraphe)
- Domaines (badges)

---

### Skills.jsx

Compétences techniques et soft skills.

**Props** :

```javascript
{
  data: {
    hard_skills: string[],
    soft_skills: string[],
    tools: string[],
    methodologies: string[]
  },
  lang: string
}
```

**Sections** :

1. Hard Skills
2. Soft Skills
3. Outils
4. Méthodologies

---

### Experience.jsx

Expériences professionnelles.

**Props** :

```javascript
{
  data: Array<{
    title: string,
    company: string,
    start_date: string,
    end_date: string,
    responsibilities: string[],
    deliverables: string[],
    skills_used: string[]
  }>,
  lang: string
}
```

**Rendu** :

- Timeline verticale
- Titre + Entreprise
- Dates
- Responsabilités (liste)
- Livrables (liste)
- Compétences utilisées (badges)

---

### Education.jsx

Formations et diplômes.

**Props** :

```javascript
{
  data: Array<{
    degree: string,
    institution: string,
    start_date: string,
    end_date: string,
    description: string
  }>,
  lang: string
}
```

---

### Languages.jsx

Langues parlées avec niveaux.

**Props** :

```javascript
{
  data: Array<{
    language: string,
    proficiency: string // A1, A2, B1, B2, C1, C2, Native
  }>,
  lang: string
}
```

**Rendu** :

- Badges de niveau avec couleurs
- Native (vert), C1/C2 (bleu), B1/B2 (jaune), A1/A2 (gris)

---

### Projects.jsx

Projets personnels ou professionnels.

**Props** :

```javascript
{
  data: Array<{
    name: string,
    description: string,
    technologies: string[],
    url: string
  }>,
  lang: string
}
```

---

### Extras.jsx

Informations complémentaires (permis, hobbies, etc.).

**Props** :

```javascript
{
  data: Array<{
    title: string,
    description: string
  }>,
  lang: string
}
```

---

### Section.jsx

Wrapper générique pour les sections de CV.

**Props** :

```javascript
{
  title: string,
  children: ReactNode,
  className: string
}
```

**Usage** :

```jsx
<Section title="Compétences">
  <Skills data={cvData.skills} lang="fr" />
</Section>
```

---

## TopBar & Navigation

### TopBar/TopBar.jsx

Barre de navigation principale de l'application.

**Localisation** : `components/TopBar/TopBar.jsx`

**Fonctionnalités** :

- Liste déroulante des CVs
- Boutons d'action (Générer, Importer, Traduire, Exporter)
- Match Score
- Amélioration CV
- Suppression CV
- Compte utilisateur

**Hooks utilisés** :

```javascript
// components/TopBar/hooks/
- useCvOperations.js      // Opérations CV (delete, etc.)
- useExportModal.js       // Modal export
- useGeneratorModal.js    // Modal générateur
- useModalStates.js       // États modals
- useScrollBehavior.js    // Comportement scroll
- useTopBarState.js       // État global TopBar
- useSubscriptionData.js  // Données abonnement et crédits
```

**Modals** :

```javascript
// components/TopBar/modals/
- CvGeneratorModal.jsx  // Génération CV
- DeleteCvModal.jsx     // Suppression CV
- ExportPdfModal.jsx    // Export PDF
- NewCvModal.jsx        // Nouveau CV vide
- PdfImportModal.jsx    // Import PDF
```

**Usage** :

```jsx
import TopBar from '@/components/TopBar';

<TopBar
  cvData={cvData}
  currentFilename={filename}
  onCvChange={handleCvChange}
/>
```

---

### TaskQueueModal.jsx

Modal affichant la queue de tâches (mobile).

**Props** :

```javascript
{
  isOpen: boolean,
  onClose: () => void,
  tasks: Array<BackgroundTask>
}
```

**Statuts** :

- ⏳ Queued
- 🔄 Running (avec progress bar)
- ✅ Completed
- ❌ Failed
- 🚫 Cancelled

---

### TaskQueueDropdown.jsx

Dropdown de tâches (desktop).

**Props** : Similaires à TaskQueueModal

---

## Admin & Analytics

### AdminProvider.jsx

Provider global pour l'admin (settings, mutations).

**Context** :

```javascript
{
  settings: Object,
  refreshSettings: () => Promise<void>,
  mutate: (action, data) => Promise<void>
}
```

**Usage** :

```jsx
const { settings, mutate } = useAdminContext();

await mutate('deleteUser', { userId });
```

---

### Tabs du Dashboard

#### OverviewTab.jsx

Vue d'ensemble : KPIs, graphiques, statistiques.

**Métriques affichées** :

- Utilisateurs totaux / nouveaux
- CVs générés / totaux
- Coûts OpenAI
- Taux de succès
- Graphiques temporels

---

#### UsersTab.jsx

Gestion des utilisateurs.

**Fonctionnalités** :

- Liste paginée
- Recherche par email/nom
- Filtres (rôle, date)
- Suppression utilisateur
- Détails utilisateur

---

#### FeaturesTab.jsx

Analytics par feature.

**Métriques** :

- Nombre d'utilisations
- Durée moyenne
- Taux de succès
- Distribution par niveau d'analyse

---

#### ErrorsTab.jsx

Liste des erreurs et exceptions.

**Colonnes** :

- Date/Heure
- Type d'erreur
- Message
- Stack trace
- Utilisateur

---

#### FeedbackTab.jsx

Feedbacks utilisateurs.

**Filtres** :

- Note (1-5 étoiles)
- Bug reports only
- Statut (new/reviewed/resolved)
- Date

---

#### OpenAICostsTab.jsx

Coûts et usage OpenAI détaillés.

**Graphiques** :

- Évolution des coûts
- Répartition par modèle
- Répartition par feature
- Top utilisateurs

**Scroll chaining prevention** : Implémenté (`lib/openai/client.js:61-106`)

---

#### ExportsTab.jsx

Analytics des exports PDF.

---

#### SettingsTab.jsx

Configuration des settings admin.

**Catégories** :

- AI Models
- Features
- General

**Actions** :

- Créer setting
- Modifier setting
- Supprimer setting
- Historique

---

#### SubscriptionPlansTab.jsx

Gestion des plans d'abonnement.

**CRUD** :

- Créer plan
- Modifier plan
- Supprimer plan
- Gérer feature limits

---

### KPICard.jsx

Carte KPI réutilisable.

**Props** :

```javascript
{
  title: string,
  value: number | string,
  icon: ReactNode,
  color: 'blue' | 'green' | 'yellow' | 'red',
  trend: number  // %
}
```

---

### CustomSelect.jsx

Select custom avec portal (évite scroll chaining).

**Props** :

```javascript
{
  options: Array<{ value: string, label: string }>,
  value: string,
  onChange: (value) => void,
  placeholder: string
}
```

**Features** :

- Portal rendering (position: fixed)
- Prévention scroll chaining (`components/admin/CustomSelect.jsx:57-77`)
- Keyboard navigation

---

### UserFilter.jsx

Filtre utilisateurs avec dropdown.

**Props** :

```javascript
{
  users: Array<User>,
  selectedUserId: string,
  onChange: (userId) => void
}
```

**Features** :

- Recherche fuzzy
- Portal rendering
- Scroll prevention (`components/admin/UserFilter.jsx:63-83`)

---

### DateRangePicker.jsx

Sélecteur de plage de dates.

**Props** :

```javascript
{
  startDate: Date,
  endDate: Date,
  onChange: (startDate, endDate) => void
}
```

---

### TabsBar.jsx

Barre d'onglets avec drag-to-scroll pour le dashboard admin.

**Localisation** : `components/admin/TabsBar.jsx`

**Props** :

```javascript
{
  tabs: Array<{
    id: string,
    label: string,
    icon: string
  }>,
  activeTab: string,
  onTabChange: (tabId: string) => void
}
```

**Features** :

- **Drag-to-scroll** : Clic glissé pour scroller horizontalement
- **Scrollbar masquée** : Classe `.scrollbar-hidden` (visible uniquement au hover si navigateur le supporte)
- **Curseur visuel** : `grab` au repos, `grabbing` pendant le drag
- **Protection des clics** : Empêche l'activation des onglets pendant le drag
- **Support tactile** : Fonctionne au doigt sur mobile (`touch-pan-x`)
- **Vitesse de scroll** : Multipliée par 2 pour un meilleur ressenti

**Usage** :

```jsx
<TabsBar
  tabs={TABS}
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>
```

**Implémentation** :

```javascript
// Gestion du drag
const handleMouseDown = (e) => {
  setIsDragging(true);
  setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
  setScrollLeft(scrollContainerRef.current.scrollLeft);
};

const handleMouseMove = (e) => {
  if (!isDragging) return;
  const x = e.pageX - scrollContainerRef.current.offsetLeft;
  const walk = (x - startX) * 2; // Vitesse x2
  scrollContainerRef.current.scrollLeft = scrollLeft - walk;
};
```

---

### Toast.jsx

Notifications toast.

**Types** :

- Success (vert)
- Error (rouge)
- Warning (jaune)
- Info (bleu)

---

## Authentication

### AuthScreen.jsx

Écran de connexion/inscription.

**Modes** :

- Login
- Register

**Features** :

- OAuth (Google, GitHub, Apple)
- Credentials (email/password)
- Forgot password
- Email verification

---

### AuthBackground.jsx

Background animé pour les pages auth.

---

### PasswordStrengthIndicator.jsx

Indicateur de force du mot de passe.

**Niveaux** :

- Weak (rouge)
- Medium (jaune)
- Strong (vert)

**Critères** :

- Longueur ≥ 8
- Majuscule + minuscule
- Chiffre
- Caractère spécial

---

### EmailVerificationError.jsx

Affichage d'erreur de vérification email.

---

## UI Components

### Modal.jsx

Modal réutilisable.

**Props** :

```javascript
{
  isOpen: boolean,
  onClose: () => void,
  title: string,
  children: ReactNode,
  size: 'sm' | 'md' | 'lg' | 'xl'
}
```

**Features** :

- Backdrop blur
- Escape key
- Click outside
- Animations

---

### DefaultCvIcon.jsx

Icône CV par défaut.

---

### ImportIcon.jsx

Icône import PDF.

---

### TranslateIcon.jsx

Icône traduction.

---

### GptLogo.jsx

Logo GPT/IA.

---

### QueueIcon.jsx

Icône queue de tâches.

---

### TokenCounter.jsx

Compteur de tokens.

**Props** :

```javascript
{
  count: number,
  max: number
}
```

**Rendu** :

- Jetons restants
- Barre de progression
- Couleur selon le niveau

---

### FormRow.jsx

Ligne de formulaire.

**Props** :

```javascript
{
  label: string,
  error: string,
  required: boolean,
  children: ReactNode
}
```

---

### PasswordInput.jsx

Input mot de passe avec toggle visibilité.

---

## Providers & Context

### RootProviders.jsx

Provider racine (SessionProvider NextAuth).

**Localisation** : `components/RootProviders.jsx`

---

### BackgroundTasksProvider.jsx

Provider de tâches background.

**Context** :

```javascript
{
  tasks: Array<BackgroundTask>,
  refreshTasks: () => void,
  deviceId: string
}
```

---

### HighlightProvider.jsx

Provider de highlight CV (recherche).

---

### RecaptchaProvider.jsx

Provider reCAPTCHA v3.

---

### NotificationProvider.jsx

Provider de notifications.

**API** :

```javascript
const { showNotification } = useNotification();

showNotification({
  type: 'success',
  message: 'CV généré avec succès!'
});
```

---

### RealtimeRefreshProvider.jsx

Provider de rafraîchissement en temps réel (SSE).

---

## Autres composants

### EmptyState.jsx

État vide (onboarding).

**Affichage** :

- Icône
- Titre
- Description
- Call-to-action

---

### MatchScore.jsx

Affichage du match score avec indicateur circulaire.

**Props** :

```javascript
{
  score: number,  // 0-100
  status: 'idle' | 'inprogress' | 'failed',
  onRefresh: () => void
}
```

**Couleurs** :

- 0-50 : Rouge
- 51-75 : Jaune
- 76-100 : Vert

---

### CVImprovementPanel.jsx

Panel d'amélioration CV avec suggestions.

**Props** :

```javascript
{
  suggestions: Array<Suggestion>,
  onOptimize: () => void,
  optimiseStatus: 'idle' | 'inprogress' | 'failed'
}
```

---

### SourceInfo.jsx

Informations sur la source du CV.

**Affichage** :

- Type (link/pdf)
- URL ou nom du fichier
- Niveau d'analyse

---

### LanguageSwitcher.jsx

Switcher de langue du CV.

**Langues** :

- Français (fr)
- English (en)
- Español (es)
- Deutsch (de)

---

### ChangesPanel.jsx

Panel de changements/historique.

---

### LoadingOverlay.jsx

Overlay de chargement global.

---

### Footer.jsx

Footer de l'application.

**Liens** :

- Politique de confidentialité
- Conditions d'utilisation
- Gestion des cookies

---

### ScrollToTopOnMount.jsx

Scroll automatique en haut au montage.

---

**89 composants React documentés** | Architecture modulaire et réutilisable
