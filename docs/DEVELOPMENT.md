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

```
1. Créer une branche feature/improvement/bug/hotfix
2. Développer la fonctionnalité
3. Tester localement
4. Commit avec message conventionnel
5. Merge dans main avec --no-ff
6. Supprimer la branche locale
```

---

## Git Branching Strategy

### Types de branches

| Préfixe | Usage | Exemple |
|---------|-------|---------|
| `feature/` | Nouvelle fonctionnalité | `feature/oauth-apple` |
| `improvement/` | Amélioration fonctionnalité existante | `improvement/export-pdf-modal` |
| `bug/` | Correction bug majeur | `bug/match-score-calculation` |
| `hotfix/` | Correction bug critique | `hotfix/security-xss` |

### Workflow

#### 1. Créer une branche

```bash
# Feature
git checkout -b feature/nom-feature

# Improvement
git checkout -b improvement/nom-improvement

# Bug
git checkout -b bug/nom-bug

# Hotfix
git checkout -b hotfix/nom-hotfix
```

#### 2. Développer

```bash
# Faire des modifications
# Tester localement

# Commit
git add .
git commit -m "feat: Description de la feature"
```

#### 3. Merger dans main

```bash
# Se placer sur main
git checkout main

# Merger avec --no-ff (garde l'historique)
git merge feature/nom-feature --no-ff
```

**IMPORTANT** :

- **Toujours** utiliser `--no-ff` pour préserver l'historique
- **Ne jamais** squash ou rebase (sauf demande explicite)
- **Ne jamais** merge sans demande explicite

#### 4. Supprimer la branche

```bash
# Supprimer la branche locale
git branch -d feature/nom-feature
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
