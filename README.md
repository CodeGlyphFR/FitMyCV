# CV Site v1.0.8

Plateforme Next.js pour créer, personnaliser et diffuser des CV ciblés par offre d'emploi. L'utilisateur démarre avec un CV générique, sélectionne une offre (lien ou pièce jointe) et s'appuie sur l'IA pour générer une version optimisée ATS et prête à candidater.

## Fonctionnalités clés
- Authentification NextAuth (OAuth Google/GitHub/Apple ou login/mot de passe) avec stockage Prisma/SQLite.
- Gestion multi-CV par utilisateur (fichiers JSON chiffrés côté serveur).
- Générateur IA piloté par un script Python utilisant l'API OpenAI et des prompts spécialisés ATS.
- Interface Tailwind CSS modulable : résumé, compétences, expériences, formations, langues, extras et projets.
- Validation JSON Schema et correction automatique de la structure avant rendu.
- Export PDF/textuel côté script (via OpenAI) et suivi des fichiers générés.

## Stack technique
- [Next.js 14](https://nextjs.org/) (App Router) & React 18
- [NextAuth](https://next-auth.js.org/) + [Prisma](https://www.prisma.io/) (SQLite par défaut)
- Tailwind CSS
- Script Python (`scripts/generate_cv.py`) avec SDK `openai>=1.12`
- Stockage local des CV chiffré en AES-256-GCM (`CV_ENCRYPTION_KEY`)

## Prérequis
- Node.js 18+
- npm 9+ (ou pnpm/yarn adapté)
- Python 3.9+ avec `pip`
- Clé API OpenAI valide
- Clé de chiffrement 256 bits encodée en base64

## Installation
```bash
# cloner le dépôt
git clone git@github.com:eds-78/CV_Builder.git
cd CV_Builder

# installer les dépendances JavaScript
npm install

# configurer l'environnement Python (optionnel mais recommandé)
python -m venv .venv
source .venv/bin/activate  # ou .venv\Scripts\activate sous Windows
pip install -r requirements.txt
```

## Variables d'environnement
Copiez `.env.example` vers `.env.local` puis renseignez vos valeurs :

```bash
cp .env.example .env.local
```

Variables nécessaires (extrait) :

| Variable | Description |
| --- | --- |
| `OPENAI_API_KEY` | Clé API pour `openai` |
| `OPENAI_MODEL` | Modèle par défaut (ex. `gpt-4.1-mini`) |
| `DATABASE_URL` | URL Prisma (ex. `file:./prisma/dev.db`) |
| `NEXTAUTH_SECRET` | Secret de chiffrement NextAuth |
| `NEXTAUTH_URL` | URL publique de l'app |
| `NEXT_PUBLIC_SITE_URL` | URL exposée au front |
| `CV_ENCRYPTION_KEY` | Clé base64 de 32 octets pour chiffrer les CV |
| `GOOGLE_CLIENT_ID`, `GITHUB_ID`, ... | Identifiants OAuth (optionnels) |

> ⚠️ `CV_ENCRYPTION_KEY` doit représenter exactement 32 octets. Pour en générer une nouvelle :
>
> ```bash
> openssl rand -base64 32
> ```

## Lancer le projet
```bash
# migrations Prisma (SQLite par défaut)
npx prisma migrate deploy

# lancer le script Prisma Studio (optionnel)
npx prisma studio

# démarrer l'application Next.js
npm run dev
# ➜ http://localhost:3000
```

Le générateur IA utilise le script Python `scripts/generate_cv.py`. Assurez-vous d'avoir installé `openai` (et `docx2pdf` si vous souhaitez convertir automatiquement les fichiers Word).

## Structure des dossiers
```
app/              # Routes Next.js (App Router) et API
components/       # Composants UI (sections CV, TopBar, etc.)
data/schema.json  # Schéma JSON validant la structure CV
lib/              # Auth, Prisma, chiffrement et utilitaires
prisma/           # Schéma Prisma + base SQLite
scripts/          # Script Python de génération AI
public/           # Assets publics
```

## Qualité & sécurité
- Données CV chiffrées avant écriture disque (`AES-256-GCM`).
- Validation schema JSON via AJV avant rendu.
- Workspace temporaire isolé pour l'IA (répertoires éphémères).

## Aller plus loin
- Voir `docs/USAGE.md` pour une procédure détaillée (onboarding utilisateur, génération AI, gestion multi-CV).
- Intégrer un provider OAuth en production (Google/GitHub/Apple).
- Configurer un stockage persistant (S3, GCS…) pour les fichiers CV si nécessaire.

## Licence
Projet privé Erick DE SMET – Version 1.0.8.
