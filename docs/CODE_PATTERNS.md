# Patterns de Code - FitMyCV.io

> **Part of FitMyCV.io technical documentation**
> Quick reference: [CLAUDE.md](../CLAUDE.md) | Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md) | Development: [DEVELOPMENT.md](./DEVELOPMENT.md)

Ce document contient des exemples de code réutilisables et des patterns communs pour le développement dans FitMyCV.io.

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
10. [API Error Internationalization](#api-error-internationalization)
11. [Service Email Resend](#service-email-resend)
12. [OAuth Multi-Provider Account Linking](#oauth-multi-provider-account-linking)

---

## Accès aux CV (Database Storage)

Les CV sont stockés directement en base de données PostgreSQL dans le champ `CvFile.content` (JSON natif).

### Lire un CV

```javascript
import { readUserCvFile } from '@/lib/cv/storage';

// Retourne le JSON stringifié
const cvContent = await readUserCvFile(userId, filename);
const cvData = JSON.parse(cvContent);

console.log(cvData.header.name);
console.log(cvData.summary.description);
```

### Écrire un CV

```javascript
import { writeUserCvFile } from '@/lib/cv/storage';

// Accepte string JSON ou objet
await writeUserCvFile(userId, filename, cvData);
// ou
await writeUserCvFile(userId, filename, JSON.stringify(cvData, null, 2));
```

### Versionning (Optimisation IA)

Lors des optimisations IA, créer une version de sauvegarde **AVANT** modification :

```javascript
import { createCvVersion } from '@/lib/cv/versioning';
import { writeUserCvFile } from '@/lib/cv/storage';

// 1. Créer une version AVANT modification
await createCvVersion(userId, filename, 'Avant optimisation IA');

// 2. Écrire le CV optimisé
await writeUserCvFile(userId, filename, optimizedCv);
```

### Restaurer une version

```javascript
import { restoreCvVersion, getCvVersions } from '@/lib/cv/versioning';

// Lister les versions disponibles
const versions = await getCvVersions(userId, filename);
// [{ version: 2, changelog: "...", createdAt: ... }, ...]

// Restaurer une version (crée automatiquement une sauvegarde du contenu actuel)
const restoredContent = await restoreCvVersion(userId, filename, 2);
```

### Pattern Complet (API Route)

```javascript
import { getSession } from '@/lib/auth/session';
import { readUserCvFile, writeUserCvFile } from '@/lib/cv/storage';

export async function GET(request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cvContent = await readUserCvFile(session.user.id, 'cv-123.json');
    return Response.json(JSON.parse(cvContent));
  } catch (error) {
    return Response.json({ error: 'CV not found' }, { status: 404 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  try {
    await writeUserCvFile(session.user.id, body.filename, body.cvData);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to save CV' }, { status: 500 });
  }
}
```

**Documentation** : [DATABASE.md](./DATABASE.md#3-cvfile) | [API_REFERENCE.md](./API_REFERENCE.md#get-apicvsversionsfilefilename)

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

Routes utilisant `verifyRecaptcha()` (11 au total) :

**Auth Routes** :
- `app/api/auth/register/route.js:22` - Création compte
- `app/api/auth/request-reset/route.js:14` - Demande reset password
- `app/api/auth/resend-verification/route.js:33` - Renvoi email vérification

**Background Tasks** :
- `app/api/background-tasks/import-pdf/route.js:66` - Import CV PDF
- `app/api/background-tasks/generate-cv/route.js:107` - Génération CV avec IA
- `app/api/background-tasks/create-template-cv/route.js:63` - Création CV template
- `app/api/background-tasks/translate-cv/route.js:34` - Traduction CV
- `app/api/background-tasks/calculate-match-score/route.js:35` - Score match
- `app/api/background-tasks/generate-cv-from-job-title/route.js:27` - Génération depuis job title

**CV Operations** :
- `app/api/cvs/create/route.js:24` - Création CV manuelle

**Account Operations** :
- `app/api/account/link-oauth/route.js:55` - Liaison compte OAuth

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

## API Error Internationalization

Système centralisé pour les erreurs API avec traduction automatique.

### Côté Serveur (API Routes)

Utiliser les erreurs pré-définies pour des réponses cohérentes et traduisibles.

#### Fonction apiError()

```javascript
import { apiError, CommonErrors, AuthErrors, CvErrors } from '@/lib/api/apiErrors';

export async function POST(request) {
  // Erreurs communes
  if (!session?.user?.id) {
    return CommonErrors.notAuthenticated();
  }

  // Erreurs d'authentification
  if (!body.email) {
    return AuthErrors.emailRequired();
  }

  // Erreur personnalisée
  return apiError('errors.api.custom.myError', {
    params: { field: 'email' },
    status: 400
  });
}
```

#### Catégories d'erreurs

```javascript
import {
  CommonErrors,      // notAuthenticated, invalidPayload, serverError, notFound, forbidden
  AuthErrors,        // emailRequired, passwordRequired, tokenInvalid, providerNotLinked...
  CvErrors,          // notFound, invalidFilename, readError, deleteError...
  BackgroundErrors,  // noSourceProvided, pdfSaveError, queueError...
  AccountErrors,     // updateFailed, passwordUpdateFailed, deleteFailed...
  SubscriptionErrors,// limitReached, invalidPlan, checkoutError...
  OtherErrors        // feedbackFailed, consentRequired...
} from '@/lib/api/apiErrors';
```

#### Exemples courants

```javascript
// Ressource non trouvée (avec paramètre)
return CommonErrors.notFound('user');
// → { error: "errors.api.common.notFound", params: { resource: "user" }, status: 404 }

// Limite atteinte (avec redirection)
return SubscriptionErrors.limitReached('gpt_cv_generation');
// → { error: "...", actionRequired: true, redirectUrl: "/subscription", status: 400 }

// Provider OAuth non lié
return AuthErrors.providerNotLinked();
// → { error: "errors.api.auth.providerNotLinked", status: 404 }
```

### Côté Client (React)

Utiliser `parseApiError()` pour traduire les erreurs dans la langue de l'utilisateur.

#### parseApiError()

```javascript
import { parseApiError } from '@/lib/api/parseApiError';
import { useLanguage } from '@/lib/i18n/LanguageContext';

function MyComponent() {
  const { t } = useLanguage();

  const handleSubmit = async () => {
    const res = await fetch('/api/some-route', { method: 'POST' });

    if (!res.ok) {
      const data = await res.json();
      const { message, actionRequired, redirectUrl } = parseApiError(data, t);

      if (actionRequired && redirectUrl) {
        router.push(redirectUrl);
      } else {
        setError(message);  // Message traduit dans la langue de l'utilisateur
      }
    }
  };
}
```

#### parseTaskError() (pour les tâches background)

```javascript
import { parseTaskError } from '@/lib/api/parseApiError';

function TaskQueueDisplay({ task }) {
  const { t } = useLanguage();

  const displayError = task.errorMessage
    ? parseTaskError(task.errorMessage, t)
    : null;

  return displayError && <span className="text-red-500">{displayError}</span>;
}
```

#### getErrorFromResponse() (helper)

```javascript
import { getErrorFromResponse } from '@/lib/api/parseApiError';

const handleError = async (response) => {
  const message = await getErrorFromResponse(response, t);
  setError(message);
};
```

### Format des clés de traduction

Les clés suivent la convention `errors.api.<category>.<errorName>` :

```
errors.api.common.notAuthenticated
errors.api.auth.emailRequired
errors.api.cv.notFound
errors.api.subscription.limitReached
```

### Fichiers de traduction

Les traductions sont dans `locales/{lang}/errors.json` :

```json
{
  "errors": {
    "api": {
      "common": {
        "notAuthenticated": "Vous devez être connecté",
        "serverError": "Erreur serveur inattendue"
      },
      "auth": {
        "emailRequired": "L'email est requis",
        "providerNotLinked": "Ce compte n'est pas lié"
      }
    }
  }
}
```

### Ajouter une nouvelle erreur

1. **Définir l'erreur** dans `lib/api/apiErrors.js` :

```javascript
export const MyErrors = {
  customError: () => apiError('errors.api.my.customError', { status: 400 }),
  withParams: (field) => apiError('errors.api.my.withParams', {
    params: { field },
    status: 422
  }),
};
```

2. **Ajouter les traductions** dans `locales/{lang}/errors.json` :

```json
{
  "errors": {
    "api": {
      "my": {
        "customError": "Custom error message",
        "withParams": "Error with field: {{field}}"
      }
    }
  }
}
```

**Fichiers** :
- Définitions : `lib/api/apiErrors.js`
- Parsing client : `lib/api/parseApiError.js`
- Traductions : `locales/{lang}/errors.json`

---

## Service Email Resend

Service centralisé pour l'envoi d'emails transactionnels via Resend.

### Configuration

```javascript
// Variables d'environnement requises
// .env
RESEND_API_KEY="re_xxxx..."
EMAIL_FROM="noreply@fitmycv.io"  // Email vérifié sur Resend
NEXT_PUBLIC_SITE_URL="http://localhost:3001"
```

### Fonctions Disponibles

Le service `lib/email/emailService.js` expose 14 fonctions :

| Fonction | Description |
|----------|-------------|
| `sendVerificationEmail()` | Envoyer email de vérification |
| `sendPasswordResetEmail()` | Envoyer email de réinitialisation |
| `sendEmailChangeVerification()` | Envoyer email pour changement d'adresse |
| `createVerificationToken()` | Créer token de vérification (24h) |
| `verifyToken()` | Vérifier un token de vérification |
| `deleteVerificationToken()` | Supprimer un token après usage |
| `isEmailVerified()` | Vérifier si email est vérifié |
| `markEmailAsVerified()` | Marquer email comme vérifié |
| `createPasswordResetToken()` | Créer token reset (1h) |
| `verifyPasswordResetToken()` | Vérifier token reset |
| `deletePasswordResetToken()` | Supprimer token reset |
| `createEmailChangeRequest()` | Créer demande changement email |
| `verifyEmailChangeToken()` | Vérifier token changement |
| `deleteEmailChangeRequest()` | Supprimer demande changement |

### Envoyer un Email de Vérification

```javascript
import { createVerificationToken, sendVerificationEmail } from '@/lib/email/emailService';

export async function POST(request) {
  const { email, name, userId } = await request.json();

  // 1. Créer le token (stocké en base, expire dans 24h)
  const token = await createVerificationToken(userId);

  // 2. Envoyer l'email
  const result = await sendVerificationEmail({
    email,
    name,
    token,
    userId, // optionnel, pour logging
  });

  if (!result.success) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  return Response.json({ success: true });
}
```

### Envoyer un Email de Reset Password

```javascript
import { createPasswordResetToken, sendPasswordResetEmail } from '@/lib/email/emailService';

export async function POST(request) {
  const { email } = await request.json();

  // 1. Créer token (vérifie aussi que l'utilisateur existe et a un password)
  const result = await createPasswordResetToken(email);

  if (!result.success) {
    // result.error === 'oauth_only' si compte OAuth uniquement
    if (result.error === 'oauth_only') {
      return Response.json({
        error: 'Compte OAuth uniquement',
        message: result.message
      }, { status: 400 });
    }
    return Response.json({ success: true }); // Sécurité : ne pas révéler si email existe
  }

  // 2. Envoyer l'email si token créé
  if (result.token) {
    const user = await prisma.user.findUnique({ where: { email } });
    await sendPasswordResetEmail({
      email,
      name: user.name,
      token: result.token,
      userId: result.userId,
    });
  }

  return Response.json({ success: true });
}
```

### Vérifier et Consommer un Token

```javascript
import { verifyToken, markEmailAsVerified, deleteVerificationToken } from '@/lib/email/emailService';

export async function GET(request) {
  const token = new URL(request.url).searchParams.get('token');

  // 1. Vérifier le token
  const { valid, userId, error } = await verifyToken(token);

  if (!valid) {
    return Response.json({ error }, { status: 400 });
  }

  // 2. Marquer email comme vérifié
  await markEmailAsVerified(userId);

  // 3. Supprimer le token
  await deleteVerificationToken(token);

  return Response.json({ success: true });
}
```

### Templates Email (Base de Données)

Les templates sont stockés en base (`EmailTemplate`) et chargés dynamiquement :

```javascript
// Le service charge automatiquement les templates depuis la DB
// Si aucun template n'existe, un template HTML hardcodé est utilisé

// Variables disponibles dans les templates :
// {{userName}} - Nom de l'utilisateur
// {{verificationUrl}} - URL de vérification
// {{resetUrl}} - URL de réinitialisation
// {{newEmail}} - Nouvelle adresse email
```

### Logging des Emails

Tous les emails sont automatiquement loggés dans la table `EmailLog` :

```javascript
// Automatique dans sendVerificationEmail, sendPasswordResetEmail, etc.
// Champs loggés :
// - templateId, templateName
// - recipientEmail, recipientUserId
// - subject, status (sent/failed)
// - error, resendId
// - isTestEmail
```

### Gestion des Erreurs

```javascript
const result = await sendVerificationEmail({ email, name, token });

if (!result.success) {
  // Erreurs possibles :
  // - "Service d'email non configuré" - RESEND_API_KEY manquant
  // - "Erreur lors de l'envoi de l'email" - Erreur API Resend
  // - Message d'erreur Resend spécifique
  console.error('Email error:', result.error);
}
```

**Fichiers** :
- Service : `lib/email/emailService.js`
- Admin API : `app/api/admin/email-templates/route.js`
- Admin UI : `components/admin/EmailTemplatesTab.jsx`

**Documentation** : [API_REFERENCE.md - Admin Email](./API_REFERENCE.md#get-apiadminemail-templates) | [ADMIN_GUIDE.md](./ADMIN_GUIDE.md)

---

## OAuth Multi-Provider Account Linking

Système permettant de lier plusieurs providers OAuth (Google, GitHub, Apple) à un même compte.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Account Linking Flow                      │
├─────────────────────────────────────────────────────────────┤
│  1. POST /api/account/link-oauth                            │
│     └─> Génère URL OAuth avec state token (cookie)          │
│                                                             │
│  2. Redirection vers provider (Google/GitHub/Apple)         │
│     └─> User s'authentifie chez le provider                 │
│                                                             │
│  3. GET /api/auth/callback/link/[provider]                  │
│     └─> Valide state, échange code, crée lien Account       │
│                                                             │
│  4. Redirection vers /account avec résultat                 │
│     └─> ?linkSuccess=true ou ?linkError=xxx                 │
└─────────────────────────────────────────────────────────────┘
```

### Initier la Liaison (Composant Client)

```javascript
'use client';
import { useLanguage } from '@/lib/i18n/LanguageContext';

function LinkedAccountsSection() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  const handleLinkProvider = async (provider) => {
    setLoading(true);

    // 1. Obtenir le token reCAPTCHA
    const recaptchaToken = await executeRecaptcha('link_oauth');

    // 2. Appeler l'API pour obtenir l'URL OAuth
    const res = await fetch('/api/account/link-oauth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, recaptchaToken }),
    });

    if (res.ok) {
      const { authUrl } = await res.json();
      // 3. Rediriger vers le provider OAuth
      window.location.href = authUrl;
    } else {
      const data = await res.json();
      // Gérer l'erreur (provider déjà lié, etc.)
      setError(parseApiError(data, t).message);
    }

    setLoading(false);
  };

  return (
    <button onClick={() => handleLinkProvider('google')}>
      Lier Google
    </button>
  );
}
```

### API Route - Initier Liaison

```javascript
// app/api/account/link-oauth/route.js
import { auth } from '@/lib/auth/session';
import { verifyRecaptcha } from '@/lib/recaptcha/verifyRecaptcha';
import crypto from 'crypto';
import { cookies } from 'next/headers';

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return AuthErrors.notAuthenticated();
  }

  const { provider, recaptchaToken } = await request.json();

  // 1. Vérifier reCAPTCHA
  const recaptchaResult = await verifyRecaptcha(recaptchaToken, {
    callerName: 'link-oauth',
    scoreThreshold: 0.5,
  });
  if (!recaptchaResult.success) {
    return AuthErrors.recaptchaFailed();
  }

  // 2. Vérifier que le provider n'est pas déjà lié
  const existingAccount = await prisma.account.findFirst({
    where: { userId: session.user.id, provider },
  });
  if (existingAccount) {
    return AuthErrors.providerAlreadyLinked();
  }

  // 3. Générer state token (protection CSRF)
  const stateToken = crypto.randomBytes(32).toString('hex');
  const stateData = JSON.stringify({
    token: stateToken,
    userId: session.user.id,
    provider,
    timestamp: Date.now(),
  });

  // 4. Stocker en cookie httpOnly (expire 10 min)
  const cookieStore = await cookies();
  cookieStore.set('oauth_link_state', stateData, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  // 5. Construire URL OAuth
  const authUrl = buildOAuthUrl(provider, stateToken);

  return Response.json({ authUrl, provider });
}
```

### API Route - Callback OAuth

```javascript
// app/api/auth/callback/link/[provider]/route.js
import { auth } from '@/lib/auth/session';
import { cookies } from 'next/headers';

export async function GET(request, { params }) {
  const { provider } = await params;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const redirectUrl = new URL('/account', process.env.NEXT_PUBLIC_SITE_URL);

  // 1. Gérer erreur OAuth
  if (error) {
    redirectUrl.searchParams.set('linkError', 'oauth_error');
    return Response.redirect(redirectUrl);
  }

  // 2. Vérifier session
  const session = await auth();
  if (!session?.user?.id) {
    redirectUrl.searchParams.set('linkError', 'session_expired');
    return Response.redirect(redirectUrl);
  }

  // 3. Valider state token
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get('oauth_link_state');
  if (!stateCookie) {
    redirectUrl.searchParams.set('linkError', 'invalid_state');
    return Response.redirect(redirectUrl);
  }

  const stateData = JSON.parse(stateCookie.value);

  // Vérifier expiration (10 min)
  if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
    redirectUrl.searchParams.set('linkError', 'expired');
    return Response.redirect(redirectUrl);
  }

  // Vérifier token et userId
  if (stateData.token !== state || stateData.userId !== session.user.id) {
    redirectUrl.searchParams.set('linkError', 'invalid_state');
    return Response.redirect(redirectUrl);
  }

  // 4. Échanger code contre tokens
  const tokens = await exchangeCodeForTokens(provider, code);
  const oauthUser = await getOAuthUserInfo(provider, tokens.access_token);

  // 5. Vérifier que l'email correspond
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (oauthUser.email.toLowerCase() !== user.email.toLowerCase()) {
    redirectUrl.searchParams.set('linkError', 'email_mismatch');
    return Response.redirect(redirectUrl);
  }

  // 6. Vérifier que le provider n'est pas lié à un autre compte
  const existingLink = await prisma.account.findFirst({
    where: { provider, providerAccountId: oauthUser.id },
  });
  if (existingLink && existingLink.userId !== session.user.id) {
    redirectUrl.searchParams.set('linkError', 'already_linked_other');
    return Response.redirect(redirectUrl);
  }

  // 7. Créer le lien
  await prisma.account.create({
    data: {
      userId: session.user.id,
      type: 'oauth',
      provider,
      providerAccountId: oauthUser.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : null,
    },
  });

  // 8. Nettoyer cookie et rediriger
  cookieStore.delete('oauth_link_state');
  redirectUrl.searchParams.set('linkSuccess', 'true');
  return Response.redirect(redirectUrl);
}
```

### Délier un Provider

```javascript
// Côté client
const handleUnlink = async (provider) => {
  const res = await fetch('/api/account/unlink-oauth', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  });

  if (res.ok) {
    // Rafraîchir la liste des comptes liés
    refreshLinkedAccounts();
  } else {
    const data = await res.json();
    // Erreurs possibles :
    // - providerNotLinked : Provider non lié
    // - cannotUnlinkLastProvider : Dernier provider, ne peut pas délier
    setError(parseApiError(data, t).message);
  }
};
```

### Règles de Sécurité

1. **State token** : Protège contre CSRF, généré avec `crypto.randomBytes(32)`
2. **Expiration** : State expire après 10 minutes
3. **Vérification email** : L'email OAuth doit correspondre à l'email du compte FitMyCV
4. **Protection dernier provider** : Impossible de délier si c'est le seul moyen de connexion
5. **reCAPTCHA** : Requis pour initier la liaison

### Codes d'Erreur

| Code | Description |
|------|-------------|
| `linkSuccess=true` | Liaison réussie |
| `linkSuccess=already_linked` | Déjà lié (même compte) |
| `linkError=oauth_error` | Erreur OAuth du provider |
| `linkError=missing_params` | Code ou state manquant |
| `linkError=invalid_state` | State invalide (CSRF) |
| `linkError=expired` | State token expiré |
| `linkError=session_expired` | Session utilisateur expirée |
| `linkError=email_mismatch` | Email OAuth ≠ email FitMyCV |
| `linkError=already_linked_other` | Provider lié à un autre compte |

**Fichiers** :
- Initiation : `app/api/account/link-oauth/route.js`
- Callback : `app/api/auth/callback/link/[provider]/route.js`
- Délier : `app/api/account/unlink-oauth/route.js`
- Liste : `app/api/account/linked-accounts/route.js`
- Composant : `components/account/LinkedAccountsSection.jsx`

**Documentation** : [API_REFERENCE.md - Account](./API_REFERENCE.md#post-apiaccountlink-oauth) | [SECURITY.md](./SECURITY.md)

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
