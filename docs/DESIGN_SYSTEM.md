# Design System - FitMyCv.ai

> **Part of FitMyCv.ai technical documentation**
> Quick reference: [CLAUDE.md](../CLAUDE.md) | Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md) | Components: [COMPONENTS.md](./COMPONENTS.md)

## Table des matières

1. [Philosophie de Design](#philosophie-de-design)
2. [Couleurs & Thème](#couleurs--thème)
3. [Typographie](#typographie)
4. [Espacement & Layout](#espacement--layout)
5. [Composants UI](#composants-ui)
6. [Animations & Transitions](#animations--transitions)
7. [Responsive Design](#responsive-design)
8. [Accessibilité](#accessibilité)
9. [Patterns Avancés](#patterns-avancés)
10. [Admin Dashboard](#admin-dashboard)
11. [Z-Index Layering](#z-index-layering)
12. [Do's & DON'Ts](#dos--donts)
13. [Configuration Tailwind](#configuration-tailwind)

---

## Philosophie de Design

L'application utilise un design basé sur le **glassmorphism** avec un fond sombre (deep dark blue `rgb(2, 6, 23)`) et des éléments semi-transparents avec effet de flou (`backdrop-blur`). L'objectif est de créer une interface moderne, élégante et performante, optimisée pour tous les devices, particulièrement iOS.

---

## Couleurs & Thème

### Palette Principale

```css
/* Emerald/Green - Couleur Primaire de la Marque */
emerald-300: #6EE7B7  /* Accents, highlights */
emerald-400: #34D399  /* Éléments interactifs */
emerald-500: #10B981  /* Boutons primaires, focus states */
emerald-600: #059669  /* États hover */

/* Sky/Blue - Couleur Secondaire */
sky-400: #38BDF8
sky-500: #0EA5E9      /* Actions secondaires */

/* Couleurs Sémantiques */
red-300/400/500       /* Erreurs (text/border/bg) */
orange-300/500        /* Avertissements */
green-300/400/500     /* Succès */
blue-300/400/500      /* Information */
yellow-200/300/400    /* Badges, highlights */

/* Grayscale */
gray-900: #111827     /* Arrière-plans sombres (dropdowns admin) */
white/black           /* Texte et contrastes */
```

### Arrière-plan de Base

```css
--bg-base: rgb(2, 6, 23)  /* Deep dark blue - fond principal */
```

### Système Glassmorphism

**Standard Glass Card** :
```jsx
<div className="bg-white/15 backdrop-blur-md rounded-2xl border-2 border-white/30" />
```

**Light Glass** (inputs, éléments secondaires) :
```jsx
<div className="bg-white/20 backdrop-blur-sm border border-white/40 rounded-lg" />
```

**Optimisation iOS** (réduction intensité blur pour performance) :
```css
@supports (-webkit-touch-callout: none) {
  .ios-blur-light { backdrop-filter: blur(2px) !important; }
  .ios-blur-medium { backdrop-filter: blur(6px) !important; }
  .ios-optimized-blur { backdrop-filter: blur(4px) !important; }
}
```

### Gradients

**Animated Blob Gradients** (arrière-plans animés) :
```css
background: linear-gradient(to bottom right,
  rgba(52, 211, 153, 0.9),   /* emerald-400/90 */
  rgba(14, 165, 233, 0.7),   /* sky-500/70 */
  transparent
);
```

**Gold Shimmer** (fonctionnalités premium) :
```css
background: linear-gradient(90deg, #b8860b 0%, #d4af37 25%, #f0c419 50%, #d4af37 75%, #b8860b 100%);
background-size: 200% 100%;
animation: gold-shimmer 3s ease-in-out infinite;
```

**Button Gradients** :
```jsx
/* Blue */ className="bg-gradient-to-r from-blue-500 to-sky-500"
/* Purple */ className="bg-gradient-to-r from-purple-500 to-violet-600"
/* Emerald */ className="bg-gradient-to-r from-emerald-500 to-emerald-600"
```

---

## Typographie

### Configuration de Base

```css
html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
```

### Échelle Typographique

```css
text-xs: 0.75rem (12px)
text-sm: 0.875rem (14px)
text-base: 1rem (16px)
text-lg: 1.125rem (18px)
text-xl: 1.25rem (20px)
text-2xl: 1.5rem (24px)
text-3xl: 1.875rem (30px)
text-4xl: 2.25rem (36px)
```

### Hiérarchie & Usages

```jsx
/* Page Titles */
<h1 className="text-4xl font-bold text-white mb-3 drop-shadow-lg">

/* Section Titles */
<h2 className="text-2xl font-semibold text-white drop-shadow-lg mb-2">

/* Card Titles */
<h3 className="text-xl font-bold text-white mb-1.5">

/* Labels (uppercase small) */
<label className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">

/* Body Text */
<p className="text-sm text-white/80">

/* Small Text */
<span className="text-xs text-white/60">
```

**IMPORTANT** : Toujours ajouter `drop-shadow` ou `drop-shadow-lg` au texte sur fond glassmorphique pour assurer la lisibilité.

---

## Espacement & Layout

### Scale d'Espacement

```css
gap-1/2/3/4/6: 0.25rem/0.5rem/0.75rem/1rem/1.5rem
p-2/3/4/6/8: 0.5rem/0.75rem/1rem/1.5rem/2rem
mb-2/3/4: 0.5rem/0.75rem/1rem
```

### Breakpoints (Custom)

```javascript
screens: {
  'sm': '991px',      // Tablet/desktop
  'md': '991px',      // Same as sm
  'topbar': '991px'   // TopBar responsive
}
```

**Approche Mobile-First** :
```jsx
<div className="text-sm md:text-base px-3 md:px-6">
  /* Mobile par défaut, desktop avec md: prefix */
</div>
```

### Containers

```jsx
max-w-lg: 512px   /* Modal default */
max-w-4xl: 896px  /* Modal large */
max-w-2xl: 672px  /* Content max-width */

/* Full-width avec padding */
<div className="w-full px-4 md:px-6">
```

---

## Composants UI

### Buttons

**Primary (Emerald)** :
```jsx
<button className="rounded-lg border-2 border-emerald-500 bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 transition-all duration-200 disabled:opacity-50">
```

**Secondary (Glass)** :
```jsx
<button className="rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white hover:bg-white/30 hover:shadow-xl transition-all duration-200">
```

**Danger** :
```jsx
<button className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg border border-red-400/30 hover:bg-red-500/30 transition backdrop-blur-xl">
```

**Icon Button** :
```jsx
<button className="h-8 w-8 flex items-center justify-center rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm hover:bg-white/30 hover:shadow-xl transition-all duration-200">
```

**Gradient Button** :
```jsx
<button className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white shadow-lg shadow-blue-500/20 px-4 py-2 rounded-lg transition-colors">
```

### Cards

**Admin Card** :
```jsx
<div className="bg-white/10 backdrop-blur-xl rounded-lg shadow-lg border border-white/20 p-6">
```

**Subscription Plan Card** :
```jsx
<div className="backdrop-blur-md bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-2 border-blue-500/50 rounded-xl p-4 shadow-lg">
```

**Empty State Card** :
```jsx
<div className="bg-white/15 backdrop-blur-md rounded-2xl p-8 shadow-lg border-2 border-white/30 hover:border-blue-400 hover:bg-blue-500/25 transition-all duration-300 gpu-accelerate">
```

### Inputs

**Standard** :
```jsx
<input className="w-full rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 shadow-sm transition-all duration-200 hover:bg-white/25 hover:border-white/60 focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none" />
```

**Admin** :
```jsx
<input className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400 backdrop-blur-xl" />
```

**Search (underline)** :
```jsx
<input className="w-full bg-transparent border-0 border-b-2 border-white/30 focus:border-emerald-400 pl-8 pr-2 py-1 text-sm italic text-white placeholder-white/50 focus:outline-none transition-colors duration-200" />
```

### Modals

**Structure complète** :
```jsx
{/* Backdrop */}
<div className="fixed inset-0 z-[10002] bg-black/50">
  {/* Container */}
  <div className="relative z-10 w-full max-w-lg rounded-2xl border-2 border-white/30 bg-white/15 backdrop-blur-md ios-blur-medium gpu-accelerate shadow-2xl">
    {/* Header */}
    <div className="flex items-center justify-between p-4 pb-2 flex-shrink-0">
      <div className="font-semibold text-emerald-300 drop-shadow-lg">

    {/* Content */}
    <div className="text-white/90 overflow-y-auto flex-1 px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
  </div>
</div>
```

### Badges

```jsx
/* Success */ <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-300 border border-green-400/30">
/* Error */   <span className="px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-300 border border-red-400/30">
/* Info */    <span className="px-2 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-400/30">
/* Warning */ <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-500/20 text-yellow-300 border border-yellow-400/30">
/* Soon */    <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 text-[10px] uppercase font-semibold">
```

### Dropdowns (Custom Select)

**Button** :
```jsx
<button className="w-full px-4 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400 backdrop-blur-xl flex items-center justify-between">
```

**Menu (Portal)** :
```jsx
<div style={{ position: 'fixed', zIndex: 10003 }}
     className="rounded-lg border border-white/30 bg-gray-900/95 backdrop-blur-xl backdrop-saturate-150 shadow-[0_8px_32px_rgba(0,0,0,0.4)] max-h-60 overflow-y-auto [overscroll-behavior:contain]">
```

**Item** :
```jsx
<button className="w-full px-4 py-2 text-left text-sm hover:bg-white/25 text-white transition-colors bg-white/20 border-l-2 border-blue-400">
```

---

## Animations & Transitions

### Keyframes Animations

**Blob Animations** (arrière-plans) :
```css
@keyframes auth-blob {
  0% { transform: translate3d(0, 0, 0) scale(1) rotate(0deg); opacity: 0.55; }
  20% { transform: translate3d(-18%, -12%, 0) scale(1.18) rotate(-10deg); opacity: 0.95; }
  45% { transform: translate3d(22%, 14%, 0) scale(0.92) rotate(12deg); opacity: 0.75; }
  70% { transform: translate3d(-10%, 18%, 0) scale(1.08) rotate(4deg); opacity: 0.85; }
  100% { transform: translate3d(0, 0, 0) scale(1) rotate(0deg); opacity: 0.55; }
}
.animate-auth-blob       /* 18s */
.animate-auth-blob-fast  /* 14s */
.animate-auth-blob-slow  /* 26s */
```

**Notifications** :
```css
@keyframes notification-in {
  0% { transform: translateX(100%); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}
.animate-notification-in  /* 0.3s ease-out */
.animate-notification-out /* 0.3s ease-in forwards */
```

**Shimmer** (loading) :
```css
@keyframes shimmer {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
.animate-shimmer  /* 1s ease-in-out infinite */
```

**Gold Shimmer** (premium) :
```css
@keyframes gold-shimmer {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.animate-gold-shimmer  /* 3s ease-in-out infinite */
```

### Transitions Standards

```css
transition-all duration-200       /* Standard hover/focus */
transition-all duration-300       /* Changements majeurs */
transition-all duration-500       /* Effets de glow */
transition-transform duration-150 /* Hover scale (performance) */
transition-colors duration-200    /* Changements de couleur uniquement */
```

### États Hover & Focus

```jsx
/* Button Hover */
hover:bg-white/30 hover:shadow-xl hover:scale-[1.02]

/* Link Hover */
hover:text-emerald-300 hover:underline

/* Focus Ring (toujours emerald-400) */
focus:ring-2 focus:ring-emerald-400/50 focus:outline-none

/* Active State (iOS) */
button:active { opacity: 0.7; transform: scale(0.98); }
```

---

## Responsive Design

### Safe Areas (iOS)

```css
/* TopBar avec safe area */
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);

/* Modal positioning */
top: env(safe-area-inset-top);
left: env(safe-area-inset-left);
right: env(safe-area-inset-right);
bottom: env(safe-area-inset-bottom);
```

### Touch Optimizations

```css
/* iOS touch handling */
button, a, [role="button"] {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  min-height: 32px;  /* Minimum touch target */
  min-width: 32px;
  -webkit-user-select: none;
  user-select: none;
  -webkit-transform: translateZ(0);
  transform: translateZ(0);
}

/* Prévention zoom iOS sur focus d'input */
input, textarea, select { font-size: 16px !important; }
```

### Patterns Responsive

```jsx
/* Hide on mobile, show on desktop */
<div className="hidden md:block">

/* Show on mobile only */
<div className="block md:hidden">

/* Responsive Grid */
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">

/* Flex direction */
<div className="flex flex-col md:flex-row">
```

---

## Accessibilité

### ARIA & Semantic HTML

```jsx
/* Button labels */
<button aria-label="Fermer la notification">

/* Modal dialog */
<div role="dialog" aria-modal="true" aria-labelledby="modal-title">

/* Tooltips */
<div role="tooltip">

/* Live regions */
<div role="status" aria-live="polite">
```

### Focus Management

```jsx
/* Focus trap dans modals */
const focusableElements = modal.querySelectorAll(
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
);

/* Restaurer focus précédent */
previousFocusRef.current = document.activeElement;
// ... modal closes
previousFocusRef.current.focus();
```

### Contraste Couleurs (WCAG AA)

- **Texte normal** : 4.5:1 (white sur semi-transparent avec fond sombre)
- **Texte large** : 3:1
- **Composants UI** : 3:1

### Navigation Clavier

```jsx
/* Escape pour fermer */
useEffect(() => {
  const handleEscape = (e) => {
    if (e.key === 'Escape') onClose();
  };
  document.addEventListener('keydown', handleEscape);
  return () => document.removeEventListener('keydown', handleEscape);
}, []);

/* Enter pour soumettre */
onKeyDown={(e) => {
  if (e.key === 'Enter') handleSubmit();
}}
```

---

## Patterns Avancés

### GPU Acceleration

```css
.gpu-accelerate {
  -webkit-transform: translateZ(0);
  transform: translateZ(0);
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  -webkit-perspective: 1000;
  perspective: 1000;
}
```

### Scroll Chaining Prevention

**Pour dropdowns (portals)** :
```jsx
useEffect(() => {
  if (!isOpen) return;
  const scrollY = window.scrollY;

  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = '100%';

  return () => {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollY);
  };
}, [isOpen]);
```

**Pour listes scrollables** :
```jsx
useEffect(() => {
  const scrollContainer = scrollContainerRef.current;
  if (!scrollContainer) return;

  function preventScrollChaining(e) {
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    const isAtTop = scrollTop <= 1;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

    if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  scrollContainer.addEventListener('wheel', preventScrollChaining, { passive: false });
  return () => scrollContainer.removeEventListener('wheel', preventScrollChaining);
}, []);
```

**Références d'implémentation** :
- CustomSelect : `components/admin/CustomSelect.jsx:57-77`
- UserFilter : `components/admin/UserFilter.jsx:63-83`
- OpenAICostsTab : `components/admin/OpenAICostsTab.jsx:61-106`

### Scrollbar Hidden

```css
/* Tailwind utilities */
[scrollbar-width:none] [&::-webkit-scrollbar]:hidden

/* CSS direct */
.scrollbar-hidden {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hidden::-webkit-scrollbar {
  display: none;
}
```

### Autofill Styling

```css
/* Autofill glassmorphism */
.backdrop-blur-sm:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 1000px rgba(255, 255, 255, 0.2) inset !important;
  -webkit-text-fill-color: white !important;
  border-color: rgba(255, 255, 255, 0.4) !important;
}
```

---

## Admin Dashboard

### Classes Utilitaires Admin (globals.css)

```css
.admin-card {
  @apply bg-white/10 backdrop-blur-xl rounded-lg shadow-lg border border-white/20;
}

.admin-button-primary {
  @apply px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg border border-blue-400/30 hover:bg-blue-500/30 transition backdrop-blur-xl;
}

.admin-input {
  @apply w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400 backdrop-blur-xl;
}

.admin-badge-success {
  @apply admin-badge bg-green-500/20 text-green-300 border border-green-400/30;
}
```

### Tab Bar (Drag-to-Scroll)

```jsx
<div className="flex space-x-4 md:space-x-6 overflow-x-auto scrollbar-hidden touch-pan-x px-4 md:px-0 select-none">
  <button className={`
    flex items-center gap-2 px-3 md:px-4 py-2 md:py-3
    border-b-2 font-medium text-xs md:text-sm transition whitespace-nowrap flex-shrink-0
    ${activeTab === tab.id
      ? 'border-blue-400 text-white'
      : 'border-transparent text-white/60 hover:text-white hover:border-white/20'
    }
  `}>
```

---

## Z-Index Layering

```css
z-0:       Background (GlobalBackground)
z-10:      Main content
z-[10001]: TopBar, Notification backdrop
z-[10002]: Dropdown menus, User menu
z-[10003]: Notifications, Custom selects
z-[10004]: Tooltips
z-[9999]:  Toast notifications
```

---

## Do's & DON'Ts

### ✅ DO's

- **Toujours utiliser glassmorphism** avec `bg-white/XX backdrop-blur-XX`
- **Ajouter drop-shadow au texte** sur fonds transparents pour lisibilité
- **Utiliser emerald-400/500** comme couleur d'action primaire
- **Implémenter optimisations iOS** avec `@supports (-webkit-touch-callout: none)`
- **Utiliser GPU acceleration** pour éléments avec backdrop-blur intense
- **Suivre approche mobile-first** avec breakpoint md: à 991px
- **Ajouter safe-area-inset** pour compatibilité notch iOS
- **Utiliser transition-all duration-200** pour interactions fluides
- **Implémenter focus states** avec emerald-400 ring
- **Prévenir scroll chaining** dans modals et dropdowns
- **Cacher scrollbars** avec utility classes quand approprié
- **Respecter touch targets 32px minimum** pour iOS

### ❌ DON'Ts

- **Ne pas utiliser fonds solides** - toujours transparence + blur
- **Ne pas oublier contraste texte** - toujours drop-shadow sur glass
- **Ne pas utiliser blur lourd sur iOS** - utiliser ios-blur-XX classes
- **Ne pas hardcoder couleurs** - utiliser utilities Tailwind
- **Ne pas oublier hover states** - toujours feedback visuel
- **Ne pas utiliser desktop-first** - commencer mobile
- **Ne pas ignorer touch targets** - minimum 32px hauteur/largeur
- **Ne pas oublier animations** - utiliser keyframes pour transitions importantes
- **Ne pas négliger accessibilité** - ARIA labels et focus management
- **Ne pas utiliser `!important`** - structurer spécificité CSS correctement

---

## Configuration Tailwind

```javascript
// tailwind.config.js
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      screens: {
        'sm': '991px',
        'md': '991px',
        'topbar': '991px',
      },
      backdropBlur: {
        '4xl': '80px',
        '5xl': '120px',
      },
      keyframes: {
        'auth-blob': {
          '0%': { transform: 'translate3d(0, 0, 0) scale(1) rotate(0deg)', opacity: '0.55' },
          '20%': { transform: 'translate3d(-18%, -12%, 0) scale(1.18) rotate(-10deg)', opacity: '0.95' },
          '45%': { transform: 'translate3d(22%, 14%, 0) scale(0.92) rotate(12deg)', opacity: '0.75' },
          '70%': { transform: 'translate3d(-10%, 18%, 0) scale(1.08) rotate(4deg)', opacity: '0.85' },
          '100%': { transform: 'translate3d(0, 0, 0) scale(1) rotate(0deg)', opacity: '0.55' }
        },
        'notification-in': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        'notification-out': {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' }
        },
        'shimmer': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' }
        },
        'gold-shimmer': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' }
        }
      },
      animation: {
        'auth-blob': 'auth-blob 18s ease-in-out infinite',
        'auth-blob-fast': 'auth-blob 14s ease-in-out infinite',
        'auth-blob-slow': 'auth-blob 26s ease-in-out infinite',
        'notification-in': 'notification-in 0.3s ease-out',
        'notification-out': 'notification-out 0.3s ease-in forwards',
        'shimmer': 'shimmer 1s ease-in-out infinite',
        'gold-shimmer': 'gold-shimmer 3s ease-in-out infinite',
      },
    },
  },
  darkMode: "class",
  plugins: [],
};
```

---

## Liens Connexes

- [CLAUDE.md](../CLAUDE.md) - Quick reference
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture système
- [COMPONENTS.md](./COMPONENTS.md) - Structure composants React
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Guide développement
- [CODE_PATTERNS.md](./CODE_PATTERNS.md) - Patterns de code réutilisables
