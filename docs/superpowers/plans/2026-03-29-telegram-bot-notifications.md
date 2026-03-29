# Telegram Bot Notifications - Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre en place un bot Telegram configurable dans l'admin pour recevoir des notifications en temps réel (fin de session utilisateur, achat de crédits).

**Architecture:** Heartbeat client (30s) + Beacon API au `beforeunload` pour détecter les fins de session. Map en mémoire côté serveur pour tracker les sessions actives (pas de migration Prisma). Données de session (features, coûts API, dernière visite) agrégées depuis les tables existantes (`TelemetryEvent`, `OpenAICall`, `CvFile`). Service Telegram découplé (`lib/telegram/`) qui formate et envoie les messages. Configuration via le modèle `Setting` existant, gérée depuis un nouvel onglet admin.

**Tech Stack:** Next.js App Router, Prisma (modèles existants uniquement), Telegram Bot API (HTTP), Beacon API, `visibilitychange` event.

---

## Structure des fichiers

```
lib/telegram/
  client.js              — Client HTTP Telegram (sendMessage)
  formatters.js          — Formatage Markdown des messages (session, paiement)
  notifications.js       — Fonctions haut niveau (sendSessionEndNotif, sendPaymentNotif)

lib/session/
  sessionManager.js      — Logique serveur : Map en mémoire, start, heartbeat, end, cleanup stale

app/api/session/
  start/route.js         — POST : démarrer une session
  heartbeat/route.js     — POST : heartbeat (30s)
  end/route.js           — POST : fin de session (Beacon)

app/api/admin/telegram/
  route.js               — GET/PUT : config Telegram (settings)
  test/route.js          — POST : envoyer un message test

components/session/
  SessionTracker.jsx     — Composant client : heartbeat + beacon + visibilitychange

app/admin/analytics/     — Modifier page.jsx pour ajouter l'onglet
components/admin/
  TelegramTab.jsx        — UI config bot Telegram
```

---

## Task 1 : Créer la branche

**Files:**
- Créer : branche `feat/telegram-bot` depuis `dev`

- [ ] **Step 1 : Créer la branche**

```bash
git checkout dev
git pull origin dev
git checkout -b feat/telegram-bot
```

---

## Task 2 : Service Telegram

**Files:**
- Créer : `lib/telegram/client.js`
- Créer : `lib/telegram/formatters.js`
- Créer : `lib/telegram/notifications.js`

- [ ] **Step 1 : Créer `lib/telegram/client.js`**

Client minimaliste qui envoie des messages via l'API Telegram Bot.

```javascript
import { getSettingValue, getBooleanSettingValue } from '@/lib/settings/settingsUtils';
import { decryptJsonField } from '@/lib/security/fieldEncryption';

export async function sendTelegramMessage(text) {
  const enabled = await getBooleanSettingValue('telegram_enabled', false);
  if (!enabled) return null;

  const encryptedToken = await getSettingValue('telegram_bot_token', '');
  const encryptedChatId = await getSettingValue('telegram_chat_id', '');

  if (!encryptedToken || !encryptedChatId) return null;

  // Déchiffrer le token et le chat ID
  const token = decryptJsonField(encryptedToken);
  const chatId = decryptJsonField(encryptedChatId);

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[telegram] Erreur envoi message:', error);
    return null;
  }

  return response.json();
}
```

- [ ] **Step 2 : Créer `lib/telegram/formatters.js`**

Formatage des messages en Markdown Telegram.

```javascript
export function formatSessionEnd({ user, session }) {
  const isNew = isNewUser(user);
  const statusEmoji = isNew ? '🆕' : '🔄';
  const statusLabel = isNew ? 'Nouveau compte' : 'Utilisateur existant';
  const duration = formatDuration(session.durationMs);
  const lastVisit = formatLastVisit(user.previousLoginAt); // Fourni par sessionManager via TelemetryEvent
  const jobTitle = session.jobTitle || '_Aucun CV importé_';
  const features = session.features?.length > 0
    ? session.features.join(' · ')
    : '_Aucune_';
  const cost = session.apiCost > 0
    ? `$${session.apiCost.toFixed(4)} (${session.apiCalls} appels)`
    : '$0.00';

  return [
    `👋 *Session terminée*`,
    ``,
    `👤 *${user.name || 'Anonyme'}* — ${user.email}`,
    `${statusEmoji} ${statusLabel}`,
    ``,
    `💼 *Poste :* ${jobTitle}`,
    ``,
    `⏱ *Durée :* ${duration}`,
    `📅 *Dernière visite :* ${lastVisit}`,
    ``,
    `⚡ *Features :* ${features}`,
    `💰 *Coût API :* ${cost}`,
  ].join('\n');
}

export function formatPayment({ user, pack, balanceAfter, balanceBefore }) {
  return [
    `💳 *Achat de crédits*`,
    ``,
    `👤 *${user.name || 'Anonyme'}* — ${user.email}`,
    ``,
    `📦 *Pack :* ${pack.creditAmount} crédits`,
    `💶 *Montant :* ${pack.price.toFixed(2)} ${pack.priceCurrency}`,
    ``,
    `🏦 *Solde :* ${balanceAfter} crédits _(avait ${balanceBefore})_`,
  ].join('\n');
}

function isNewUser(user) {
  if (!user.createdAt) return false;
  const hoursSinceCreation = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60);
  return hoursSinceCreation < 24;
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes} min ${seconds.toString().padStart(2, '0')}s`;
}

function formatLastVisit(previousLoginAt) {
  if (!previousLoginAt) return '_Première visite_';
  const daysAgo = Math.floor((Date.now() - new Date(previousLoginAt).getTime()) / (1000 * 60 * 60 * 24));
  const dateStr = new Date(previousLoginAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  if (daysAgo === 0) return `aujourd'hui`;
  if (daysAgo === 1) return `hier (${dateStr})`;
  return `il y a ${daysAgo} jours (${dateStr})`;
}
```

- [ ] **Step 3 : Créer `lib/telegram/notifications.js`**

Fonctions haut-niveau qui vérifient les toggles individuels.

```javascript
import { getBooleanSettingValue } from '@/lib/settings/settingsUtils';
import { sendTelegramMessage } from './client';
import { formatSessionEnd, formatPayment } from './formatters';

export async function sendSessionEndNotification(data) {
  const enabled = await getBooleanSettingValue('telegram_notify_session_end', true);
  if (!enabled) return;
  const message = formatSessionEnd(data);
  return sendTelegramMessage(message);
}

export async function sendPaymentNotification(data) {
  const enabled = await getBooleanSettingValue('telegram_notify_payment', true);
  if (!enabled) return;
  const message = formatPayment(data);
  return sendTelegramMessage(message);
}
```

- [ ] **Step 4 : Commit**

```bash
git add lib/telegram/
git commit -m "feat: add Telegram bot service with message formatters"
```

---

## Task 3 : Session tracking (serveur)

**Files:**
- Créer : `lib/session/sessionManager.js`
- Créer : `app/api/session/start/route.js`
- Créer : `app/api/session/heartbeat/route.js`
- Créer : `app/api/session/end/route.js`

- [ ] **Step 1 : Créer `lib/session/sessionManager.js`**

Gère la logique serveur des sessions actives via un Map en mémoire (pas de migration DB).

```javascript
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { sendSessionEndNotification } from '@/lib/telegram/notifications';

// Map en mémoire : sessionId → { userId, startedAt, lastHeartbeat }
const activeSessions = new Map();

const STALE_TIMEOUT = 2 * 60 * 1000; // 2 minutes sans heartbeat = stale

const FEATURE_EMOJI_MAP = {
  import_pdf: '📄 Import PDF',
  generate_cv: '✨ Génération CV',
  match_score: '🎯 Score matching',
  optimize_cv: '🔧 Optimisation CV',
  translate_cv: '🌍 Traduction',
  export_pdf: '📤 Export PDF',
};

export function startSession(userId) {
  // Fermer les éventuelles sessions existantes de cet utilisateur
  for (const [id, session] of activeSessions) {
    if (session.userId === userId) {
      endSession(id).catch(() => {});
    }
  }

  const sessionId = randomUUID();
  activeSessions.set(sessionId, {
    userId,
    startedAt: new Date(),
    lastHeartbeat: new Date(),
  });

  return sessionId;
}

export function heartbeat(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return false;
  session.lastHeartbeat = new Date();
  return true;
}

export async function endSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return null;

  activeSessions.delete(sessionId);

  const sessionData = await aggregateSessionData(session);

  sendSessionEndNotification(sessionData).catch((err) =>
    console.error('[session] Erreur notification Telegram:', err)
  );

  return sessionData;
}

async function aggregateSessionData(session) {
  const { userId, startedAt } = session;
  const endedAt = new Date();
  const durationMs = endedAt.getTime() - startedAt.getTime();

  // Charger l'utilisateur
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  if (!user) return null;

  // Dernière visite précédente via TelemetryEvent (login avant le courant)
  const previousLogin = await prisma.telemetryEvent.findFirst({
    where: { userId, type: 'login', status: 'success' },
    orderBy: { timestamp: 'desc' },
    skip: 1,
    select: { timestamp: true },
  });

  // Features utilisées pendant la session
  const telemetryEvents = await prisma.telemetryEvent.findMany({
    where: {
      userId,
      timestamp: { gte: startedAt, lte: endedAt },
      category: 'feature',
    },
    select: { type: true },
    distinct: ['type'],
  });

  const features = telemetryEvents
    .map((e) => FEATURE_EMOJI_MAP[e.type] || e.type)
    .filter(Boolean);

  // Coût API pendant la session
  const apiCalls = await prisma.openAICall.aggregate({
    where: {
      userId,
      createdAt: { gte: startedAt, lte: endedAt },
    },
    _sum: { estimatedCost: true },
    _count: true,
  });

  // Titre de poste depuis le dernier CV importé
  const latestCv = await prisma.cvFile.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { content: true },
  });

  const jobTitle = latestCv?.content?.header?.current_title || null;

  return {
    user: { ...user, previousLoginAt: previousLogin?.timestamp || null },
    session: {
      durationMs,
      features,
      apiCost: apiCalls._sum.estimatedCost || 0,
      apiCalls: apiCalls._count || 0,
      jobTitle,
    },
  };
}

// Nettoyage des sessions stale (appelé à chaque start)
export function cleanupStaleSessions() {
  const now = Date.now();
  for (const [id, session] of activeSessions) {
    if (now - session.lastHeartbeat.getTime() > STALE_TIMEOUT) {
      endSession(id).catch(() => {});
    }
  }
}
```

- [ ] **Step 2 : Créer `app/api/session/start/route.js`**

```javascript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { startSession, cleanupStaleSessions } from '@/lib/session/sessionManager';

export async function POST() {
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) {
    return Response.json({ error: 'Non authentifié' }, { status: 401 });
  }

  // Profiter de chaque start pour nettoyer les sessions stale
  cleanupStaleSessions();

  const sessionId = startSession(authSession.user.id);
  return Response.json({ sessionId });
}
```

- [ ] **Step 3 : Créer `app/api/session/heartbeat/route.js`**

```javascript
import { NextRequest } from 'next/server';
import { heartbeat } from '@/lib/session/sessionManager';

export async function POST(request) {
  const { sessionId } = await request.json();
  if (!sessionId) {
    return Response.json({ error: 'sessionId requis' }, { status: 400 });
  }

  try {
    await heartbeat(sessionId);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Session introuvable' }, { status: 404 });
  }
}
```

- [ ] **Step 4 : Créer `app/api/session/end/route.js`**

```javascript
import { endSession } from '@/lib/session/sessionManager';

export async function POST(request) {
  try {
    const { sessionId } = await request.json();
    if (!sessionId) {
      return Response.json({ error: 'sessionId requis' }, { status: 400 });
    }

    await endSession(sessionId);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: true });
  }
}
```

- [ ] **Step 5 : Commit**

```bash
git add lib/session/ app/api/session/
git commit -m "feat: add session tracking with heartbeat and end detection"
```

---

## Task 4 : SessionTracker (composant client)

**Files:**
- Créer : `components/session/SessionTracker.jsx`
- Modifier : `app/layout.jsx` (ajouter le composant)

- [ ] **Step 1 : Créer `components/session/SessionTracker.jsx`**

```jsx
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';

const HEARTBEAT_INTERVAL = 30_000; // 30 secondes

export default function SessionTracker() {
  const { data: session, status } = useSession();
  const sessionIdRef = useRef(null);
  const intervalRef = useRef(null);

  const startTracking = useCallback(async () => {
    if (sessionIdRef.current) return;
    try {
      const res = await fetch('/api/session/start', { method: 'POST' });
      const data = await res.json();
      if (data.sessionId) {
        sessionIdRef.current = data.sessionId;
      }
    } catch {}
  }, []);

  const sendHeartbeat = useCallback(async () => {
    if (!sessionIdRef.current) return;
    try {
      await fetch('/api/session/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      });
    } catch {}
  }, []);

  const endTracking = useCallback(() => {
    if (!sessionIdRef.current) return;
    const body = JSON.stringify({ sessionId: sessionIdRef.current });
    // Beacon API pour fiabilité au déchargement
    const sent = navigator.sendBeacon('/api/session/end', new Blob([body], { type: 'application/json' }));
    if (!sent) {
      // Fallback fetch keepalive
      fetch('/api/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
    sessionIdRef.current = null;
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;

    startTracking();

    // Heartbeat interval
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Événements de fermeture
    const handleBeforeUnload = () => endTracking();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        endTracking();
      } else if (document.visibilityState === 'visible' && !sessionIdRef.current) {
        startTracking();
        intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalRef.current);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      endTracking();
    };
  }, [status, startTracking, sendHeartbeat, endTracking]);

  return null; // Composant invisible
}
```

- [ ] **Step 2 : Ajouter `SessionTracker` dans le layout**

Dans `app/layout.jsx`, importer et ajouter le composant dans le `RootProviders` wrapper, à côté des autres composants globaux (après `CookieBanner`, `FeedbackButton`, etc.) :

```jsx
import SessionTracker from '@/components/session/SessionTracker';
```

Et dans le JSX, ajouter :
```jsx
<SessionTracker />
```

- [ ] **Step 3 : Commit**

```bash
git add components/session/ app/layout.jsx
git commit -m "feat: add client-side session tracker with heartbeat and beacon"
```

---

## Task 5 : Notification de paiement

**Files:**
- Modifier : `app/api/webhooks/stripe/handlers/checkout.js` ou `payments.js`

- [ ] **Step 1 : Identifier le handler de paiement de crédits**

Lire `app/api/webhooks/stripe/handlers/checkout.js` pour trouver où le paiement de crédits est traité (événement `checkout.session.completed`). C'est là que le `CreditBalance` est mis à jour et la `CreditTransaction` créée.

- [ ] **Step 2 : Ajouter la notification Telegram après un achat réussi**

Après la mise à jour du solde de crédits, ajouter :

```javascript
import { sendPaymentNotification } from '@/lib/telegram/notifications';

// ... après la mise à jour du CreditBalance et création de CreditTransaction ...

// Notification Telegram
const creditPack = await prisma.creditPack.findFirst({
  where: { stripePriceId: session.line_items?.data?.[0]?.price?.id },
});

sendPaymentNotification({
  user: { name: user.name, email: user.email },
  pack: {
    creditAmount: creditPack?.creditAmount || creditsToAdd,
    price: session.amount_total / 100,
    priceCurrency: session.currency?.toUpperCase() || 'EUR',
  },
  balanceAfter: updatedBalance.balance,
  balanceBefore: updatedBalance.balance - creditsToAdd,
}).catch((err) => console.error('[stripe] Erreur notification Telegram:', err));
```

Adapter les noms de variables au code existant dans le handler. L'appel est non-bloquant (`.catch`).

- [ ] **Step 3 : Commit**

```bash
git add app/api/webhooks/stripe/
git commit -m "feat: send Telegram notification on credit purchase"
```

---

## Task 6 : API admin Telegram

**Files:**
- Créer : `app/api/admin/telegram/route.js`
- Créer : `app/api/admin/telegram/test/route.js`

- [ ] **Step 1 : Créer `app/api/admin/telegram/route.js`**

```javascript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import prisma from '@/lib/prisma';
import { encryptJsonField, decryptJsonField } from '@/lib/security/fieldEncryption';

const TELEGRAM_SETTINGS = [
  { name: 'telegram_enabled', category: 'telegram', description: 'Activer le bot Telegram', defaultValue: '0' },
  { name: 'telegram_bot_token', category: 'telegram', description: 'Token du bot Telegram', defaultValue: '', encrypted: true },
  { name: 'telegram_chat_id', category: 'telegram', description: 'Chat ID Telegram', defaultValue: '', encrypted: true },
  { name: 'telegram_notify_session_end', category: 'telegram', description: 'Notification fin de session', defaultValue: '1' },
  { name: 'telegram_notify_payment', category: 'telegram', description: 'Notification achat crédits', defaultValue: '1' },
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return Response.json({ error: 'Non autorisé' }, { status: 403 });
  }

  const settings = await prisma.setting.findMany({
    where: { category: 'telegram' },
  });

  const result = {};
  for (const def of TELEGRAM_SETTINGS) {
    const found = settings.find((s) => s.settingName === def.name);
    let value = found?.value ?? def.defaultValue;
    // Déchiffrer les champs sensibles pour l'affichage admin
    if (def.encrypted && value) {
      try { value = decryptJsonField(value); } catch { value = ''; }
    }
    result[def.name] = value;
  }

  return Response.json(result);
}

export async function PUT(request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return Response.json({ error: 'Non autorisé' }, { status: 403 });
  }

  const body = await request.json();

  for (const def of TELEGRAM_SETTINGS) {
    if (body[def.name] !== undefined) {
      // Chiffrer les champs sensibles avant stockage
      let value = String(body[def.name]);
      if (def.encrypted && value) {
        value = encryptJsonField(value);
      }

      await prisma.setting.upsert({
        where: { settingName: def.name },
        update: { value },
        create: {
          settingName: def.name,
          value,
          category: def.category,
          description: def.description,
        },
      });
    }
  }

  return Response.json({ ok: true });
}
```

- [ ] **Step 2 : Créer `app/api/admin/telegram/test/route.js`**

```javascript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { sendTelegramMessage } from '@/lib/telegram/client';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return Response.json({ error: 'Non autorisé' }, { status: 403 });
  }

  const result = await sendTelegramMessage(
    '✅ *FitMyCV Bot connecté !*\n\nLe bot Telegram est correctement configuré et opérationnel.'
  );

  if (result) {
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Échec envoi. Vérifiez le token et le chat ID.' }, { status: 400 });
}
```

- [ ] **Step 3 : Commit**

```bash
git add app/api/admin/telegram/
git commit -m "feat: add admin API for Telegram bot configuration"
```

---

## Task 7 : Interface admin — Onglet Telegram

**Files:**
- Créer : `components/admin/TelegramTab.jsx`
- Modifier : `app/admin/analytics/page.jsx`

- [ ] **Step 1 : Créer `components/admin/TelegramTab.jsx`**

Composant avec :
- Champs : Token bot, Chat ID (masquable)
- Toggle principal : Activer/Désactiver le bot
- Toggles individuels : Notification fin de session, Notification paiement
- Bouton "Tester la connexion"
- Indicateur de statut (connecté/déconnecté)

Le composant utilise `useState` + `useEffect` pour charger/sauvegarder les settings via `/api/admin/telegram`. Le bouton test appelle `/api/admin/telegram/test`.

Suivre le pattern des autres onglets admin existants (ex: `SettingsTab`) pour le style et la structure. Utiliser les mêmes composants UI (boutons, toggles, inputs) que le reste de l'admin.

- [ ] **Step 2 : Ajouter l'onglet dans `app/admin/analytics/page.jsx`**

Ajouter dans le tableau `TABS` :
```javascript
{ id: 'telegram', label: 'Telegram', icon: '🤖' },
```

Importer le composant :
```javascript
import TelegramTab from '@/components/admin/TelegramTab';
```

Ajouter le cas dans le rendu conditionnel des tabs (là où les autres `activeTab === 'xxx'` sont gérés) :
```javascript
{activeTab === 'telegram' && <TelegramTab />}
```

- [ ] **Step 3 : Commit**

```bash
git add components/admin/TelegramTab.jsx app/admin/analytics/page.jsx
git commit -m "feat: add Telegram bot configuration tab in admin dashboard"
```

---

## Task 8 : Test d'intégration end-to-end

- [ ] **Step 1 : Vérifier le build**

```bash
npm run build
```

S'assurer qu'il n'y a aucune erreur de compilation.

- [ ] **Step 2 : Tester manuellement**

1. Lancer `npm run dev`
2. Aller dans Admin > Telegram
3. Configurer le token et le chat ID d'un bot Telegram de test
4. Cliquer "Tester la connexion" — vérifier la réception du message
5. Activer les notifications
6. Ouvrir l'app dans un autre navigateur avec un compte utilisateur
7. Naviguer, utiliser des features
8. Fermer l'onglet — vérifier la notification de fin de session sur Telegram
9. Simuler un achat de crédits — vérifier la notification de paiement

- [ ] **Step 3 : Commit final**

```bash
git add .
git commit -m "chore: final integration verification"
```
