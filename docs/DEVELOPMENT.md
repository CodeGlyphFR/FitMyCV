# Guide de développement - FitMyCv.ai

> **Part of FitMyCv.ai technical documentation**
> Quick reference: [CLAUDE.md](../CLAUDE.md) | Commands: [COMMANDS_REFERENCE.md](./COMMANDS_REFERENCE.md) | Patterns: [CODE_PATTERNS.md](./CODE_PATTERNS.md) | Environment: [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)

Guide complet pour développer sur FitMyCv.ai.

---

## Table des matières

- [Workflow de développement](#workflow-de-développement)
- [Git Branching Strategy](#git-branching-strategy)
- [Standards de code](#standards-de-code)
- [Tests](#tests)
- [Debugging](#debugging)
- [Scripts utilitaires](#scripts-utilitaires)
- [Contributing](#contributing)

---

## Workflow de développement

### Setup initial

```bash
# 1. Cloner le projet
git clone <repository-url>
cd fitmycv

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp .env.example .env.local
# Éditer .env.local avec vos clés

# 4. Configurer la base de données
echo 'DATABASE_URL="file:./dev.db"' > prisma/.env
npx prisma migrate deploy
npx prisma generate

# 5. Lancer le serveur dev
npm run dev
```

### Cycle de développement

Le workflow suit une architecture **3-branches** (main → release → dev) avec PRs obligatoires.

```
1. Créer une branche feature/improvement/bug depuis dev
2. Développer la fonctionnalité
3. Tester localement (npm run dev, npm run build)
4. Commit avec message conventionnel
5. Push et créer PR vers dev
6. Après merge : supprimer la branche feature
7. Quand prêt : créer PR dev → release (tag -rc)
8. Tests sur release
9. Après validation : créer PR release → main (tag final)
```

**Workflow visuel :**
```
Feature  ───┐ ┌───┐ ┌───     (PR → dev)
         ╲ ╱ ╲ ╱ ╱
Dev      ──○───○───○───     (PR → release, tag -rc)
          ╱         ╲
Release  ─────────────○──    (PR → main, tag final)
        ╱              ╲
Main   ○────────────────○
```

---

## Git Branching Strategy

### Structure des branches

Le projet utilise une architecture **3-branches** avec hiérarchie stricte :

| Branche | Rôle | Base | Merge vers | Tag | PR requis |
|---------|------|------|------------|-----|-----------|
| `main` | Production stable | - | - | v1.2.3 | - |
| `release` | Testing/Staging | `main` | `main` | v1.2.3-rc | ✅ Oui |
| `dev` | Développement actif | `release` | `release` | - | ✅ Oui |
| `feature/*` | Nouvelle fonctionnalité | `dev` | `dev` | - | ✅ Oui |
| `improvement/*` | Amélioration existante | `dev` | `dev` | - | ✅ Oui |
| `bug/*` | Correction bug | `dev` | `dev` | - | ✅ Oui |
| `hotfix/*` | Urgence production | `main` | `main`+`release`+`dev` | v1.2.y | ❌ Non |

### Types de branches

| Préfixe | Usage | Exemple | Base |
|---------|-------|---------|------|
| `feature/` | Nouvelle fonctionnalité | `feature/oauth-apple` | `dev` |
| `improvement/` | Amélioration fonctionnalité existante | `improvement/export-pdf-modal` | `dev` |
| `bug/` | Correction bug majeur | `bug/match-score-calculation` | `dev` |
| `hotfix/` | Correction bug critique production | `hotfix/security-xss` | `main` |

### Workflow

#### 1. Créer une branche

**Pour feature/improvement/bug** (partent toujours de `dev`) :

```bash
# Se placer sur dev
git checkout dev
git pull origin dev

# Feature
git checkout -b feature/nom-feature

# Improvement
git checkout -b improvement/nom-improvement

# Bug
git checkout -b bug/nom-bug
```

**Pour hotfix** (part de `main`) :

```bash
# Se placer sur main
git checkout main
git pull origin main

# Hotfix
git checkout -b hotfix/nom-critique
```

#### 2. Développer

```bash
# Faire des modifications
# Tester localement
npm run dev          # Test développement
npm run build        # Test build
npm start            # Test production local

# Commit(s)
git add .
git commit -m "feat: Description de la feature"
```

#### 3. Créer Pull Request et merger

**A. Feature/Bug/Improvement → dev** :

```bash
# Push la branche
git push origin feature/nom-feature

# Créer PR vers dev
gh pr create --base dev --head feature/nom-feature --title "feat: Description"

# Après review et merge via GitHub UI:
# Supprimer la branche feature
git branch -d feature/nom-feature
git push origin --delete feature/nom-feature
```

**B. dev → release** (quand prêt pour testing) :

```bash
# Créer PR dev → release
gh pr create --base release --head dev --title "Release v1.x.x-rc"

# Après merge via GitHub UI:
git checkout release
git pull origin release

# Taguer la release candidate
git tag -a v1.x.x-rc -m "Release Candidate v1.x.x for testing"
git push origin v1.x.x-rc

# Tests sur release
npm run build && npm start  # Tester en conditions proches production
```

**C. release → main** (après validation) :

```bash
# Créer PR release → main
gh pr create --base main --head release --title "Production Release v1.x.x"

# Après merge via GitHub UI:
git checkout main
git pull origin main

# Taguer la version finale
git tag -a v1.x.x -m "Production release v1.x.x"
git push origin v1.x.x
```

**IMPORTANT** :

- **Toujours** utiliser `--no-ff` pour préserver l'historique
- **Ne jamais** squash ou rebase (sauf demande explicite)
- **Ne jamais** merge sans demande explicite
- **PRs obligatoires** pour dev→release et release→main
- **Tags** : `-rc` sur release, version finale sur main

#### 4. Supprimer les branches feature

```bash
# Supprimer la branche locale
git branch -d feature/nom-feature

# Supprimer la branche remote (si elle n'a pas été supprimée via GitHub)
git push origin --delete feature/nom-feature
```

---

## Workflow Hotfix (Urgences Production)

Les **hotfixes** sont des corrections critiques qui doivent être déployées rapidement en production. Ils suivent un workflow spécial car ils :
- Partent de `main` (pas de `dev`)
- Doivent être mergés dans **les 3 branches** (`main`, `release`, `dev`)
- Ne nécessitent **pas de PR** (urgence)

### Quand utiliser un hotfix ?

Utiliser un hotfix **uniquement** pour :
- ❌ Bugs critiques en production (security, crash, data loss)
- ❌ Problèmes bloquants affectant tous les utilisateurs
- ✅ Corrections urgentes ne pouvant pas attendre le prochain release

**Ne PAS utiliser pour** :
- Bugs mineurs (utiliser `bug/` depuis `dev`)
- Nouvelles features (utiliser `feature/` depuis `dev`)
- Améliorations (utiliser `improvement/` depuis `dev`)

### Workflow Hotfix Complet

#### 1. Créer le hotfix depuis main

```bash
# Se placer sur main (production)
git checkout main
git pull origin main

# Créer branche hotfix
git checkout -b hotfix/description-critique
```

#### 2. Corriger et tester rapidement

```bash
# Faire les corrections minimales nécessaires
# ... modifications ...

# Tester localement
npm run dev          # Test rapide
npm run build        # Build production
npm start            # Test production local

# Commit
git add .
git commit -m "hotfix: Description du bug critique corrigé"
git push origin hotfix/description-critique
```

#### 3. Merger dans main (production)

```bash
# Revenir sur main
git checkout main

# Merger le hotfix (--no-ff pour garder l'historique)
git merge hotfix/description-critique --no-ff

# Taguer la version patch
git tag -a v1.2.y -m "Hotfix v1.2.y - Description"
git push origin main --tags
```

**Note** : Déployer immédiatement en production après ce merge.

#### 4. Backport dans release (éviter régression)

```bash
# Se placer sur release
git checkout release
git pull origin release

# Merger le hotfix
git merge hotfix/description-critique --no-ff
git push origin release
```

**Pourquoi** : Si `release` ne contient pas le hotfix, le prochain merge `release → main` réintroduira le bug.

#### 5. Backport dans dev (éviter régression)

```bash
# Se placer sur dev
git checkout dev
git pull origin dev

# Merger le hotfix
git merge hotfix/description-critique --no-ff
git push origin dev
```

**Pourquoi** : Si `dev` ne contient pas le hotfix, les futures features partiront d'une base buggée.

#### 6. Supprimer la branche hotfix

```bash
# Supprimer localement
git branch -d hotfix/description-critique

# Supprimer sur remote
git push origin --delete hotfix/description-critique
```

### Workflow Visuel Hotfix

```
               hotfix/critical
              /     |     \
             /      |      \
Main    ───●───────●       \
          /        merge    \
         /                   \
Release ──────────────────────●──
                               \
Dev    ─────────────────────────●
```

### Checklist Hotfix

Avant de créer un hotfix, vérifier :

- [ ] Le bug est **critique** et nécessite un déploiement immédiat ?
- [ ] La correction est **minimale** et ciblée (pas de refactoring) ?
- [ ] Les tests passent en local (npm run build && npm start) ?

Après le hotfix :

- [ ] Mergé dans `main` avec tag v1.2.y ?
- [ ] Déployé en production ?
- [ ] Backporté dans `release` ?
- [ ] Backporté dans `dev` ?
- [ ] Branche hotfix supprimée ?
- [ ] Documentation mise à jour si nécessaire ?

### Exemple Complet

```bash
# Contexte : Bug critique de sécurité XSS en production

# 1. Créer hotfix
git checkout main && git pull origin main
git checkout -b hotfix/security-xss

# 2. Corriger
# ... fix XSS vulnerability ...
git add . && git commit -m "hotfix: Fix XSS vulnerability in CV export"
git push origin hotfix/security-xss

# 3. Merge main + tag
git checkout main
git merge hotfix/security-xss --no-ff
git tag -a v1.2.1 -m "Hotfix v1.2.1 - Security XSS fix"
git push origin main --tags

# 4. Backport release
git checkout release && git pull origin release
git merge hotfix/security-xss --no-ff
git push origin release

# 5. Backport dev
git checkout dev && git pull origin dev
git merge hotfix/security-xss --no-ff
git push origin dev

# 6. Cleanup
git branch -d hotfix/security-xss
git push origin --delete hotfix/security-xss

# 7. Déployer en production immédiatement
```

---

## Standards de code

### Messages de commit

**Format** : Conventional Commits

```
<type>: <description>

[optional body]
```

**Types** :

| Type | Usage |
|------|-------|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `docs` | Documentation |
| `style` | Formatage (pas de changement de code) |
| `refactor` | Refactoring |
| `perf` | Amélioration performance |
| `test` | Ajout de tests |
| `chore` | Tâches de maintenance |

**Exemples** :

```bash
git commit -m "feat: Ajout système complet de gestion des plans d'abonnement"
git commit -m "fix: Correction calcul match score avec skills manquants"
git commit -m "docs: Mise à jour README avec nouvelle API"
git commit -m "refactor: Simplification du job queue manager"
```

**IMPORTANT** :

- **Ne JAMAIS** mentionner "Claude Code" ou "Generated with"
- **Ne JAMAIS** ajouter "🤖" ou emojis dans les commits
- Écrire en français (sauf mots techniques)

### Code Style

#### JavaScript/JSX

**Indentation** : 2 espaces

**Quotes** : Simple quotes `'` pour strings

**Semicolons** : Optionnels (mais cohérents)

**Example** :

```javascript
// ✅ Good
export async function generateCv(url, analysisLevel) {
  const model = await getModelForAnalysisLevel(analysisLevel);

  const response = await openai.chat.completions.create({
    model,
    messages: [systemPrompt, userPrompt],
  });

  return response.choices[0].message.content;
}

// ❌ Bad
export async function generateCv(url,analysisLevel){
const model=await getModelForAnalysisLevel(analysisLevel)
const response=await openai.chat.completions.create({model,messages:[systemPrompt,userPrompt]})
return response.choices[0].message.content
}
```

#### React Components

**Naming** : PascalCase

**Structure** :

```javascript
// 1. Imports
import { useState, useEffect } from 'react';
import Component from '@/components/Component';

// 2. Component
export default function MyComponent({ prop1, prop2 }) {
  // 3. State
  const [state, setState] = useState(null);

  // 4. Effects
  useEffect(() => {
    // Logic
  }, []);

  // 5. Handlers
  const handleClick = async () => {
    // Logic
  };

  // 6. Render
  return (
    <div className="...">
      {/* JSX */}
    </div>
  );
}
```

#### Tailwind CSS

**Order** : Layout → Spacing → Typography → Colors → Effects

```jsx
// ✅ Good
<div className="flex flex-col gap-4 p-4 text-lg font-semibold text-blue-600 bg-white rounded-lg shadow-md">

// ❌ Bad
<div className="text-blue-600 p-4 flex shadow-md rounded-lg gap-4 bg-white flex-col font-semibold text-lg">
```

### File Organization

```
lib/[feature]/
├── index.js          # Public API
├── [functions].js    # Fonctions métier
└── utils.js          # Utilitaires
```

**Example** :

```javascript
// lib/cv/index.js (Public API)
export { readCv, writeCv } from './storage';
export { validateCvData } from './validation';
export { encryptString, decryptString } from './crypto';
```

---

## Tests

### Tests manuels

Pour le moment, tests manuels uniquement.

**Checklist** :

- [ ] Inscription/Connexion
- [ ] Génération CV (rapid/medium/deep)
- [ ] Import PDF
- [ ] Traduction CV
- [ ] Match Score
- [ ] Optimisation CV
- [ ] Export PDF
- [ ] Dashboard admin

### Tests unitaires (TODO)

Framework recommandé : **Vitest**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

**Example** :

```javascript
// lib/cv/validation.test.js
import { describe, it, expect } from 'vitest';
import { validateCvData } from './validation';

describe('validateCvData', () => {
  it('should validate a valid CV', () => {
    const cv = {
      generated_at: '2025-01-15T10:00:00Z',
      header: { full_name: 'John Doe', /* ... */ },
      summary: { /* ... */ },
      skills: { /* ... */ },
      experience: [],
    };

    const result = validateCvData(cv);

    expect(result.valid).toBe(true);
  });

  it('should reject an invalid CV', () => {
    const cv = { invalid: true };

    const result = validateCvData(cv);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });
});
```

---

## Debugging

### Next.js Dev Tools

```bash
# Lancer en mode debug
NODE_OPTIONS='--inspect' npm run dev
```

Ouvrir Chrome DevTools → `chrome://inspect`

### Logs

```javascript
// Console logs
console.log('[generateCv] Starting generation...', { url, analysisLevel });
console.error('[generateCv] Error:', error);

// Secure logger (production)
import logger from '@/lib/security/secureLogger';

logger.context('cv', 'info', 'CV generated successfully');
logger.context('cv', 'error', 'CV generation failed', { error });
```

### Prisma Studio

```bash
# Ouvrir l'interface graphique DB
npx prisma studio
```

Visualiser et modifier les données en temps réel.

### React DevTools

Installer l'extension Chrome/Firefox : **React Developer Tools**

### Network Inspector

Chrome DevTools → Network

- Vérifier les requêtes API
- Inspecter les payloads
- Vérifier les headers

### Source Maps

Next.js génère automatiquement des source maps en dev :

- `.next/static/chunks/pages/`
- Permet de debugger le code source original

---

## Scripts utilitaires

### Package.json scripts

```json
{
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3000",
    "backfill:telemetry": "node scripts/backfill-telemetry.mjs"
  }
}
```

### Prisma scripts

```bash
# Créer une migration
npx prisma migrate dev --name nom_migration

# Appliquer les migrations
npx prisma migrate deploy

# Reset la DB (dev only)
npx prisma migrate reset

# Générer le client
npx prisma generate

# Ouvrir Studio
npx prisma studio

# Seed la DB
npx prisma db seed
```

### Scripts custom

#### Backfill Telemetry

**Fichier** : `scripts/backfill-telemetry.mjs`

Remplit les données de télémétrie manquantes.

```bash
npm run backfill:telemetry
```

#### Reset Subscription Plans

**Fichier** : `prisma/reset-subscription-plans.js`

Reset les plans d'abonnement par défaut.

```bash
node prisma/reset-subscription-plans.js
```

---

## Contributing

### Pull Requests

**Template** :

```markdown
## Description
Brève description de la feature/fix

## Type de changement
- [ ] Nouvelle feature (feature/)
- [ ] Amélioration (improvement/)
- [ ] Bug fix (bug/)
- [ ] Hotfix (hotfix/)

## Checklist
- [ ] Code testé localement
- [ ] Documentation mise à jour (si nécessaire)
- [ ] Pas de breaking changes
- [ ] Commit message conventionnel

## Tests effectués
- [ ] Inscription/Connexion
- [ ] Génération CV
- [ ] Dashboard admin
- [ ] ...
```

### Code Review

**Checklist** :

- [ ] Code lisible et maintenable
- [ ] Pas de code dupliqué
- [ ] Validation des inputs
- [ ] Gestion des erreurs
- [ ] Performance acceptable
- [ ] Sécurité respectée
- [ ] Pas de secrets en dur

---

## Environment Variables

### Gestion

**Dev** : `.env.local` (git ignored)
**Production** : `.env.production` ou variables d'environnement système

**IMPORTANT** :

- **Ne JAMAIS** commit les fichiers .env
- **Ne JAMAIS** commit les secrets
- Utiliser `.env.example` comme template

### Exemple .env.example

```bash
# Application
NODE_ENV=development
NEXT_PUBLIC_SITE_URL=http://localhost:3001

# Database
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL=http://localhost:3001

# OpenAI
OPENAI_API_KEY="sk-proj-..."

# Encryption
CV_ENCRYPTION_KEY="your-encryption-key-here"

# OAuth (optionnel)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Email (optionnel)
RESEND_API_KEY="..."
EMAIL_FROM="noreply@example.com"
```

---

## Best Practices

### Do's ✅

1. **Tester localement** avant de commit
2. **Valider les inputs** côté serveur
3. **Gérer les erreurs** avec try/catch
4. **Logger les événements** importants
5. **Utiliser des types** (JSDoc ou TypeScript)
6. **Commenter le code** complexe
7. **Suivre les conventions** de nommage
8. **Optimiser les performances** (lazy loading, memoization)

### Don'ts ❌

1. **Ne pas commit** de secrets ou clés API
2. **Ne pas skip** la validation
3. **Ne pas ignorer** les warnings
4. **Ne pas copier/coller** sans comprendre
5. **Ne pas mélanger** logique métier et UI
6. **Ne pas utiliser** `any` partout
7. **Ne pas oublier** de cleanup (useEffect)
8. **Ne pas abuser** de `!important` en CSS

---

**Happy coding!** Développement structuré et de qualité
