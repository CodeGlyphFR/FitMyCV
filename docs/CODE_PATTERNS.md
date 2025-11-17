# Patterns de Code - FitMyCv.ai

> **Part of FitMyCv.ai technical documentation**
> Quick reference: [CLAUDE.md](../CLAUDE.md) | Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md) | Development: [DEVELOPMENT.md](./DEVELOPMENT.md)

Ce document contient des exemples de code réutilisables et des patterns communs pour le développement dans FitMyCv.ai.

## Table des matières

1. [Accès aux CV Chiffrés](#accès-aux-cv-chiffrés)
2. [Gestion Job Queue](#gestion-job-queue)
3. [Validation de CV](#validation-de-cv)
4. [Session Utilisateur](#session-utilisateur)
5. [Vérification reCAPTCHA](#vérification-recaptcha)
6. [Gestion Scroll Chaining](#gestion-scroll-chaining)
7. [Gestion Stripe et Abonnements](#gestion-stripe-et-abonnements)
8. [React useEffect et Dépendances Stables](#react-useeffect-et-dépendances-stables)
9. [Vérification Limites Features](#vérification-limites-features)

---

## Accès aux CV Chiffrés

Les CV sont chiffrés avec AES-256-GCM côté serveur. Utiliser les fonctions helpers pour lire/écrire automatiquement.

### Lire un CV

```javascript
import { readCv } from '@/lib/cv/storage';

// Déchiffre automatiquement
const cvData = await readCv(userId, filename);

// cvData est un objet JSON validé
console.log(cvData.header.name);
console.log(cvData.summary.description);
```

### Écrire un CV

```javascript
import { writeCv } from '@/lib/cv/storage';

// Chiffre automatiquement avant stockage
await writeCv(userId, filename, cvData);
```

### Pattern Complet (API Route)

```javascript
import { getSession } from '@/lib/auth/session';
import { readCv, writeCv } from '@/lib/cv/storage';
import { validateCvData } from '@/lib/cv/validation';

export async function GET(request) {
  // 1. Vérifier session
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Lire CV chiffré
  try {
    const cvData = await readCv(session.user.id, 'cv-123.json');
    return Response.json(cvData);
  } catch (error) {
    console.error('Error reading CV:', error);
    return Response.json({ error: 'CV not found' }, { status: 404 });
  }
}

export async function POST(request) {
  // 1. Vérifier session
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parser body
  const body = await request.json();

  // 3. Valider données
  const { valid, data, errors } = validateCvData(body.cvData);
  if (!valid) {
    return Response.json({ error: 'Invalid CV data', errors }, { status: 400 });
  }

  // 4. Écrire CV chiffré
  try {
    await writeCv(session.user.id, body.filename, data);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error writing CV:', error);
    return Response.json({ error: 'Failed to save CV' }, { status: 500 });
  }
}
```

**Documentation** : [SECURITY.md](./SECURITY.md) | [Architecture - Chiffrement CV](./ARCHITECTURE.md#chiffrement-des-cv)

---

## Gestion Job Queue

Le système de job queue gère les tâches longues (génération IA, import PDF, traductions) avec max 3 jobs concurrents.

### Enqueuer un Job

```javascript
import { enqueueJob } from '@/lib/backgroundTasks/jobQueue';
import { runGenerateCvJob } from '@/lib/backgroundTasks/generateCvJob';

// Enqueuer le job (sera exécuté dès qu'un slot est disponible)
enqueueJob(() => runGenerateCvJob(task));
```

### Obtenir l'État de la Queue

```javascript
import { getQueueSnapshot } from '@/lib/backgroundTasks/jobQueue';

const snapshot = getQueueSnapshot();
console.log('Running:', snapshot.running);  // Jobs en cours
console.log('Queued:', snapshot.queued);    // Jobs en attente
```

### Créer un Nouveau Type de Job

#### 1. Créer le fichier job dans `lib/backgroundTasks/`

```javascript
// lib/backgroundTasks/myNewJob.js
import prisma from '@/lib/prisma';
import { myOpenAIFunction } from '@/lib/openai/myFunction';

export async function runMyNewJob(task) {
  try {
    // 1. Marquer comme running
    await prisma.backgroundTask.update({
      where: { id: task.id },
      data: { status: 'running', startedAt: new Date() }
    });

    // 2. Exécuter logique métier
    const result = await myOpenAIFunction(task.input);

    // 3. Marquer comme completed
    await prisma.backgroundTask.update({
      where: { id: task.id },
      data: {
        status: 'completed',
        result: JSON.stringify(result),
        completedAt: new Date()
      }
    });

    return result;
  } catch (error) {
    // 4. Marquer comme failed
    await prisma.backgroundTask.update({
      where: { id: task.id },
      data: {
        status: 'failed',
        error: error.message,
        completedAt: new Date()
      }
    });
    throw error;
  }
}
```

#### 2. Créer la route API dans `app/api/background-tasks/`

```javascript
// app/api/background-tasks/my-new-job/route.js
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { enqueueJob } from '@/lib/backgroundTasks/jobQueue';
import { runMyNewJob } from '@/lib/backgroundTasks/myNewJob';

export async function POST(request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  // Créer tâche en DB
  const task = await prisma.backgroundTask.create({
    data: {
      userId: session.user.id,
      type: 'my-new-job',
      status: 'queued',
      input: JSON.stringify(body)
    }
  });

  // Enqueuer
  enqueueJob(() => runMyNewJob(task));

  return Response.json({ taskId: task.id });
}
```

**Documentation** : [Architecture - Background Tasks](./ARCHITECTURE.md#système-de-tâches-en-arrière-plan)

---

## Validation de CV

Validation JSON des CV contre le schema défini dans `data/schema.json`.

### Valider un CV

```javascript
import { validateCvData } from '@/lib/cv/validation';

const { valid, data, errors } = validateCvData(cvJson);

if (!valid) {
  console.error('Validation errors:', errors);
  // errors est un array d'erreurs AJV
  return;
}

// data est le CV validé et corrigé
console.log(data);
```

### Utilisation dans API Route

```javascript
import { validateCvData } from '@/lib/cv/validation';

export async function POST(request) {
  const body = await request.json();

  const { valid, data, errors } = validateCvData(body.cvData);

  if (!valid) {
    return Response.json({
      error: 'Invalid CV format',
      details: errors
    }, { status: 400 });
  }

  // Utiliser data (validé et corrigé)
  await saveCv(data);

  return Response.json({ success: true });
}
```

### Schema JSON (référence)

Le schema est défini dans `data/schema.json` et suit la structure :
- `header` : nom, titre, contact
- `summary` : description, domaines
- `skills` : hard_skills, soft_skills, tools, methodologies
- `experience` : expériences professionnelles
- `education`, `languages`, `extras`, `projects`
- `order_hint` : ordre d'affichage des sections
- `section_titles` : titres personnalisés

**Documentation** : [Architecture - Structure CV](./ARCHITECTURE.md#structure-des-données-cv)

---

## Session Utilisateur

Obtenir la session utilisateur authentifiée avec NextAuth.

### Dans API Route

```javascript
import { getSession } from '@/lib/auth/session';

export async function GET(request) {
  const session = await getSession();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const userEmail = session.user.email;
  const userRole = session.user.role; // 'USER' ou 'ADMIN'

  // Utiliser userId pour requêtes DB
  const cvs = await prisma.cvFile.findMany({
    where: { userId }
  });

  return Response.json({ cvs });
}
```

### Dans Composant Client

```javascript
'use client';
import { useSession } from 'next-auth/react';

export default function MyComponent() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  if (status === 'unauthenticated') {
    return <div>Please sign in</div>;
  }

  return (
    <div>
      <p>Welcome {session.user.name}</p>
      <p>Email: {session.user.email}</p>
    </div>
  );
}
```

### Dans Server Component

```javascript
import { getSession } from '@/lib/auth/session';

export default async function MyServerComponent() {
  const session = await getSession();

  if (!session) {
    return <div>Please sign in</div>;
  }

  return (
    <div>
      <p>Welcome {session.user.name}</p>
    </div>
  );
}
```

**Documentation** : [Features - Authentication](./FEATURES.md#authentification-multi-provider)

---

## Vérification reCAPTCHA

Fonction centralisée pour vérifier les tokens reCAPTCHA v3 avec support du bypass pour tests/développement.

### Utilisation de Base

```javascript
import { verifyRecaptcha } from '@/lib/recaptcha/verifyRecaptcha';

// Vérifier un token
const result = await verifyRecaptcha(recaptchaToken, {
  callerName: 'import-pdf',  // Nom pour les logs
  scoreThreshold: 0.5,        // Score minimum (0.0 = bot, 1.0 = humain)
});

if (!result.success) {
  // Vérification échouée
  console.error(result.error);
  return Response.json({ error: result.error }, { status: 403 });
}

// Vérification réussie (ou bypassée)
console.log('Score:', result.score);
console.log('Bypassed:', result.bypassed); // true si BYPASS_RECAPTCHA=true
```

### Pattern dans API Route

```javascript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { verifyRecaptcha } from "@/lib/recaptcha/verifyRecaptcha";

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const formData = await request.formData();
  const recaptchaToken = formData.get("recaptchaToken");

  // Vérification reCAPTCHA (optionnelle pour compatibilité)
  if (recaptchaToken) {
    const recaptchaResult = await verifyRecaptcha(recaptchaToken, {
      callerName: 'import-pdf',
      scoreThreshold: 0.5,
    });

    if (!recaptchaResult.success) {
      return NextResponse.json(
        { error: recaptchaResult.error || "Échec de la vérification anti-spam." },
        { status: recaptchaResult.error?.includes('Configuration') ? 500 : 403 }
      );
    }
  }

  // Suite de la logique métier
  // ...
}
```

### Bypass pour Tests/Développement

Pour désactiver la vérification reCAPTCHA en développement ou lors de tests automatisés (MCP Puppeteer, etc.) :

**1. Ajouter dans `.env` :**
```bash
BYPASS_RECAPTCHA=true
```

**2. La fonction retourne automatiquement success :**
```javascript
// Avec BYPASS_RECAPTCHA=true dans .env
const result = await verifyRecaptcha(token, { callerName: 'test' });

// result = {
//   success: true,
//   score: 1.0,
//   bypassed: true
// }
```

**3. Les logs affichent le bypass :**
```
[import-pdf] BYPASS MODE ENABLED - Skipping reCAPTCHA verification
```

### Options Disponibles

```javascript
await verifyRecaptcha(token, {
  // Nom du caller pour les logs (obligatoire pour debug)
  callerName: 'register',

  // Seuil minimum de score (défaut: 0.5)
  // 0.0 = certainement un bot
  // 0.5 = seuil recommandé par Google
  // 1.0 = certainement un humain
  scoreThreshold: 0.5,

  // Action attendue (optionnel, vérifie que le token correspond)
  expectedAction: 'submit_form',
});
```

### Codes d'Erreur

La fonction retourne différents types d'erreurs :

```javascript
// Token manquant
{ success: false, error: 'Token reCAPTCHA manquant' }

// Configuration serveur manquante
{ success: false, error: 'Configuration serveur manquante' }

// Vérification échouée
{ success: false, error: 'Échec de la vérification reCAPTCHA', errorCodes: [...] }

// Action non correspondante
{ success: false, error: 'Action reCAPTCHA non correspondante' }

// Score trop faible
{ success: false, score: 0.3, error: 'Score reCAPTCHA trop faible (0.3 < 0.5)' }

// Erreur réseau/serveur
{ success: false, error: 'Erreur serveur lors de la vérification reCAPTCHA' }
```

### Références d'Implémentation

Routes utilisant `verifyRecaptcha()` :
- `app/api/background-tasks/import-pdf/route.js:66`
- `app/api/background-tasks/generate-cv/route.js:107`
- `app/api/background-tasks/create-template-cv/route.js:63`
- `app/api/auth/register/route.js:22`
- `app/api/cvs/create/route.js:24`

**Documentation** : [SECURITY.md](./SECURITY.md) | [MCP_PUPPETEER.md - Bypass reCAPTCHA](./MCP_PUPPETEER.md)

---

## Gestion Scroll Chaining

Patterns pour éviter le scroll de la page quand on scrolle dans un dropdown ou une liste modale.

### Pattern 1: Dropdowns avec Portals (position: fixed)

Pour les dropdowns rendus via `createPortal` (CustomSelect, UserFilter, etc.).

```javascript
import { useEffect } from 'react';

function CustomDropdown({ isOpen, onClose }) {
  // Bloquer scroll du body quand dropdown ouvert
  useEffect(() => {
    if (!isOpen) return;

    // Sauvegarder position de scroll actuelle
    const scrollY = window.scrollY;

    // Bloquer scroll du body
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      // Restaurer scroll du body
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  return (
    <div
      className="fixed z-[10003] rounded-lg border border-white/30 bg-gray-900/95 backdrop-blur-xl max-h-60 overflow-y-auto [overscroll-behavior:contain]"
    >
      {/* Contenu dropdown */}
    </div>
  );
}
```

**Pourquoi** :
- Le dropdown peut scroller normalement grâce à `overscroll-behavior: contain`
- La page reste figée à sa position, pas de décalage
- Position et scroll restaurés à la fermeture

### Pattern 2: Listes Scrollables In-Page (non-portals)

Pour les listes directement dans le DOM (OpenAICostsTab, etc.).

```javascript
import { useEffect, useRef } from 'react';

function ScrollableList({ isVisible }) {
  const scrollContainerRef = useRef(null);

  // Prévenir scroll chaining aux limites
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!isVisible || !scrollContainer) return;

    function preventScrollChaining(e) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const isAtTop = scrollTop <= 1;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

      // Bloquer UNIQUEMENT aux limites pour éviter le scroll chaining
      if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    scrollContainer.addEventListener('wheel', preventScrollChaining, { passive: false });

    return () => {
      scrollContainer.removeEventListener('wheel', preventScrollChaining);
    };
  }, [isVisible]);

  return (
    <div
      ref={scrollContainerRef}
      className="max-h-96 overflow-y-auto [overscroll-behavior:contain]"
    >
      {/* Contenu liste */}
    </div>
  );
}
```

**Pourquoi** :
- Le scroll fonctionne normalement dans la liste
- Se bloque aux limites pour empêcher la propagation à la page
- Nécessite `[overscroll-behavior:contain]` sur le conteneur

### Références d'Implémentation

- CustomSelect : `components/admin/CustomSelect.jsx:57-77`
- UserFilter : `components/admin/UserFilter.jsx:63-83`
- OpenAICostsTab : `components/admin/OpenAICostsTab.jsx:61-106`

**Documentation** : [DESIGN_SYSTEM.md - Scroll Chaining Prevention](./DESIGN_SYSTEM.md#scroll-chaining-prevention)

---

## Gestion Stripe et Abonnements

Patterns pour créer des sessions Stripe et gérer les abonnements.

### Créer Session Checkout (Abonnement)

```javascript
import { stripe } from '@/lib/stripe';

export async function POST(request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { planId, billingPeriod } = body; // 'monthly' ou 'yearly'

  // 1. Récupérer le plan
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId }
  });

  // 2. Déterminer le prix Stripe
  const stripePriceId = billingPeriod === 'yearly'
    ? plan.stripePriceYearlyId
    : plan.stripePriceMonthlyId;

  // 3. Récupérer ou créer customer Stripe
  let stripeCustomerId = session.user.stripeCustomerId;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: session.user.email,
      metadata: { userId: session.user.id }
    });
    stripeCustomerId = customer.id;

    await prisma.user.update({
      where: { id: session.user.id },
      data: { stripeCustomerId }
    });
  }

  // 4. Créer session checkout
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: stripePriceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account/subscriptions?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account/subscriptions`,
    metadata: {
      userId: session.user.id,
      planId: planId
    }
  });

  return Response.json({ sessionId: checkoutSession.id });
}
```

### Créer Session Checkout (Crédits)

```javascript
import { stripe } from '@/lib/stripe';

export async function POST(request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { packId } = body;

  // 1. Récupérer le pack de crédits
  const pack = await prisma.creditPack.findUnique({
    where: { id: packId }
  });

  // 2. Créer session checkout (mode payment, pas subscription)
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: pack.stripePriceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account/subscriptions?success=true&type=credits`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account/subscriptions`,
    metadata: {
      userId: session.user.id,
      creditAmount: pack.amount.toString(),
      packId: packId
    }
  });

  return Response.json({ sessionId: checkoutSession.id });
}
```

### Gérer Webhook Stripe

```javascript
import { stripe } from '@/lib/stripe';

export async function POST(request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Logger webhook
  await prisma.stripeWebhookLog.create({
    data: {
      eventId: event.id,
      eventType: event.type,
      payload: JSON.stringify(event.data.object)
    }
  });

  // Gérer événements
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object);
      break;

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object);
      break;

    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return Response.json({ received: true });
}
```

**Documentation** : [STRIPE_SETUP.md](./STRIPE_SETUP.md) | [SUBSCRIPTION.md](./SUBSCRIPTION.md)

---

## React useEffect et Dépendances Stables

Patterns pour éviter les boucles infinies causées par des objets recréés à chaque render.

### Problème : Boucles Infinies avec Objets

Les hooks custom qui retournent des objets (state, operations, modals, etc.) créent de nouvelles références à chaque render. Si on les met dans les dépendances d'un `useEffect`, cela déclenche une boucle infinie.

### Pourquoi setState est Stable

React **garantit** que les fonctions `setState` ont une identité stable entre les renders. Cela signifie que `state.setSomething` est toujours la même fonction, même si l'objet `state` change.

**Référence officielle** : [React docs - useState](https://react.dev/reference/react/useState#setstate-is-stable)

### Pattern de Base

```javascript
// ❌ INCORRECT - Boucle infinie
React.useEffect(() => {
  state.setSomething(value);
}, [state]); // 'state' est recréé à chaque render

// ✅ CORRECT - Stable
React.useEffect(() => {
  state.setSomething(value);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // setState est garanti stable par React
```

### Cas d'Usage

#### 1. setState Simple

```javascript
const [isOpen, setIsOpen] = React.useState(false);

// ✅ Pas besoin d'ajouter setIsOpen aux dépendances
React.useEffect(() => {
  if (someCondition) {
    setIsOpen(true);
  }
}, [someCondition]); // setIsOpen omis (stable)
```

#### 2. Custom Hook avec Setters

```javascript
// Hook custom qui retourne un objet
function useModalState() {
  const [isOpen, setIsOpen] = React.useState(false);
  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false)
  };
}

// Utilisation
function MyComponent() {
  const modal = useModalState(); // Nouvel objet à chaque render

  // ✅ On n'a besoin que de modal.isOpen (primitive)
  React.useEffect(() => {
    if (modal.isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [modal.isOpen]); // Seulement la primitive

  // ✅ Si on doit appeler modal.close(), omettre 'modal'
  React.useEffect(() => {
    function handleEscape(e) {
      if (e.key === 'Escape') {
        modal.close(); // Stable via setState
      }
    }
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // modal.close omis (stable)
}
```

#### 3. Multiples Hooks Custom

```javascript
function ComplexComponent() {
  const state = useComponentState(); // { items, setItems, current, setCurrent }
  const modals = useModalState();    // { listOpen, setListOpen, ... }
  const operations = useOperations(); // { reload, delete, ... }

  // ✅ N'inclure QUE les primitives nécessaires
  React.useEffect(() => {
    // On écoute les changements de listOpen et items
    if (modals.listOpen && state.items.length > 0) {
      calculateDropdownPosition();
    }
  }, [modals.listOpen, state.items]); // Seulement les primitives

  // ✅ Si on appelle uniquement des setters, tableau vide
  React.useEffect(() => {
    const unsubscribe = subscribeToEvents((event) => {
      state.setItems(event.items);
      modals.setListOpen(false);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Setters omis (stables)
}
```

### Quand Désactiver le Linter

Utiliser `eslint-disable-next-line react-hooks/exhaustive-deps` quand :

1. **setState functions** - Garantis stables par React
2. **Fonctions wrappant setState** - Si elles ne font QUE du setState
3. **Callbacks stables** - Fonctions passées qui ne changent jamais

```javascript
// Bon usage de eslint-disable
React.useEffect(() => {
  // Appelle uniquement des setters stables
  modal.open();
  state.reset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [triggerCondition]); // Seulement la condition trigger
```

**⚠️ Attention** : Si la fonction lit des valeurs (props, state), elle doit être dans les dépendances OU recréée avec `useCallback`.

### Anti-Patterns à Éviter

```javascript
// ❌ Inclure tout l'objet
React.useEffect(() => {
  if (state.isOpen) {
    doSomething();
  }
}, [state]); // Boucle infinie

// ❌ Mettre les setters explicitement
React.useEffect(() => {
  state.setIsOpen(true);
}, [state.setIsOpen]); // Inutile et verbeux

// ❌ Omettre des primitives nécessaires
React.useEffect(() => {
  if (props.userId) { // Lit une valeur
    fetchUser(props.userId);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // INCORRECT - manque props.userId
```

### Références d'Implémentation

Fixes appliqués dans TopBar.jsx (14 useEffect) :
- `components/TopBar/TopBar.jsx:138` - Portal ready
- `components/TopBar/TopBar.jsx:146` - CV list reload
- `components/TopBar/TopBar.jsx:161` - Event listeners
- `components/TopBar/TopBar.jsx:300` - Outside click handlers

**Documentation** : [React Docs - useState](https://react.dev/reference/react/useState) | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## Vérification Limites Features

Vérifier si un utilisateur peut utiliser une feature selon son plan d'abonnement.

### Vérifier et Débiter

```javascript
import { checkFeatureLimit, incrementFeatureUsage } from '@/lib/subscription/featureUsage';

export async function POST(request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Vérifier limite AVANT d'exécuter l'action
  const { allowed, reason, needsCredit, currentCount, limit } = await checkFeatureLimit(
    session.user.id,
    'gpt_cv_generation',
    { analysisLevel: 'medium' } // Contexte optionnel
  );

  if (!allowed) {
    if (needsCredit) {
      return Response.json({
        error: 'Feature limit reached',
        needsCredit: true,
        message: 'You need to purchase credits to use this feature'
      }, { status: 403 });
    } else {
      return Response.json({
        error: 'Feature limit reached',
        needsUpgrade: true,
        message: 'Please upgrade your plan to continue'
      }, { status: 403 });
    }
  }

  // 2. Exécuter l'action
  const result = await performAction();

  // 3. Incrémenter compteur APRÈS succès
  await incrementFeatureUsage(session.user.id, 'gpt_cv_generation');

  return Response.json({ result });
}
```

### Pattern avec Remboursement (si échec)

```javascript
import { checkFeatureLimit, incrementFeatureUsage, refundFeatureUsage } from '@/lib/subscription/featureUsage';

export async function POST(request) {
  const session = await getSession();
  const userId = session.user.id;

  // 1. Vérifier limite
  const { allowed } = await checkFeatureLimit(userId, 'gpt_cv_generation');
  if (!allowed) {
    return Response.json({ error: 'Limit reached' }, { status: 403 });
  }

  // 2. Débiter AVANT l'action
  await incrementFeatureUsage(userId, 'gpt_cv_generation');

  try {
    // 3. Exécuter action (peut échouer)
    const result = await performLongRunningAction();
    return Response.json({ result });

  } catch (error) {
    // 4. Rembourser si échec
    await refundFeatureUsage(userId, 'gpt_cv_generation');
    throw error;
  }
}
```

### Features Disponibles

9 macro-features trackées :
1. `gpt_cv_generation` - Génération CV avec IA
2. `import_pdf` - Import CV depuis PDF
3. `translate_cv` - Traduction de CV
4. `match_score` - Score de correspondance
5. `optimize_cv` - Optimisation automatique
6. `generate_from_job_title` - Génération depuis titre
7. `export_cv` - Export PDF
8. `edit_cv` - Édition de CV
9. `create_cv_manual` - Création manuelle

**Documentation** : [SUBSCRIPTION.md - Features](./SUBSCRIPTION.md#9-macro-features-trackées)

---

## Liens Connexes

- [CLAUDE.md](../CLAUDE.md) - Quick reference
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture système complète
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Guide développement
- [API_REFERENCE.md](./API_REFERENCE.md) - Référence API complète
- [SUBSCRIPTION.md](./SUBSCRIPTION.md) - Système d'abonnements
- [STRIPE_SETUP.md](./STRIPE_SETUP.md) - Configuration Stripe
- [SECURITY.md](./SECURITY.md) - Sécurité et chiffrement
- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) - Guidelines UI/UX
- [COMMANDS_REFERENCE.md](./COMMANDS_REFERENCE.md) - Commandes CLI
