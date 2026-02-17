<div align="center">

<img src="public/icons/logo.png" alt="FitMyCV Logo" width="360" />

# FitMyCV — SaaS d'optimisation de CV par IA

[![En production](https://img.shields.io/badge/En_production-app.fitmycv.io-00C853)](https://app.fitmycv.io)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2024-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma_6-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4.1_%7C_o4--mini_%7C_GPT--4o-412991?logo=openai&logoColor=white)](https://openai.com/)
[![Docker](https://img.shields.io/badge/Docker-Prod-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

**[app.fitmycv.io](https://app.fitmycv.io)** · **[fitmycv.io](https://www.fitmycv.io)**

<img src="public/icons/fr.svg" alt="Français" width="24" height="24">&nbsp;&nbsp;<a href="README.en.md"><img src="public/icons/gb.svg" alt="English" width="24" height="24"></a>

</div>

<div align="center">

### [Documentation](https://app.fitmycv.io/docs)

Architecture · 113 endpoints API · 34 modèles de données · 138 composants React

</div>

---

## Pourquoi ce projet

J'ai construit FitMyCV comme un projet end-to-end pour développer et démontrer mes compétences en **AI Engineering** dans un contexte de production réel — pas un PoC, pas un notebook, mais un SaaS complet avec des utilisateurs, des paiements et une infrastructure de déploiement.

Le produit adapte des CV à des offres d'emploi via des pipelines LLM multi-étapes. La contrainte centrale : **chaque élément généré par l'IA doit être justifiable par le CV de l'utilisateur** — le système reformule, réorganise et déduit des compétences, mais ne peut jamais halluciner d'expériences ou de qualifications inexistantes, grâce à des garde-fous appliqués dans le code.

---

## Compétences démontrées

### 1. Orchestration multi-modèles

Chaque phase du pipeline utilise un modèle choisi pour ses caractéristiques spécifiques. Les affectations sont stockées en base de données et modifiables à chaud.

| Phase | Modèle | Pourquoi ce modèle |
|-------|--------|-------------------|
| Extraction d'offre (HTML/Markdown bruité) | `o4-mini` | Raisonnement structuré pour extraction complexe |
| Classification KEEP / REMOVE / MOVE | `gpt-4o` | Haute précision sur des décisions discrètes |
| Adaptation des expériences (×N en parallèle) | `o4-mini` (`reasoning_effort: low`) | Réécriture nuancée, optimisée en vitesse |
| Déduction des compétences | `o4-mini` | Inférence logique depuis le contenu adapté |
| Amélioration ciblée des expériences | `gpt-4.1` | Qualité maximale pour les réécritures critiques |
| Import PDF (multi-pages) | `gpt-4.1-mini` (Vision) | Extraction multi-modale page par page |
| Score de matching | `gpt-4.1-mini` | Scoring structuré + suggestions |

**Pourquoi OpenAI** : la diversité de la gamme (raisonnement, vision, mini, full) permet d'affecter le bon modèle à chaque phase avec un rapport qualité/prix maîtrisé. Le projet est conçu pour être évolutif — intégrer d'autres foundation models comme Gemini ou Mistral serait une prochaine étape facilement envisageable.

**Ce que ça démontre** : la capacité à sélectionner et configurer le bon modèle pour chaque tâche selon le compromis coût / qualité / latence, plutôt que d'utiliser un modèle unique pour tout.

---

### 2. Prompt Engineering

Les prompts ne sont pas des chaînes en dur — c'est une architecture composable :

- **Fichiers Markdown** avec directive `{INCLUDE:chemin}` pour réutiliser des fragments communs (règles d'adaptation, politique de langue, système de base)
- **Substitution de variables** (`{{experience}}`, `{{job_offer}}`) au moment de l'appel
- **Schémas JSON Structured Output** versionnés aux côtés de chaque prompt — le LLM est contraint de respecter un format strict
- **Cache en production, hot reload en dev** — le loader adapte son comportement selon l'environnement

```
lib/prompts-shared/              ← Fragments partagés
├── system-base.md
├── cv-adaptation-rules.md
├── scoring-rules.md
└── language-policy.md

lib/features/cv-adaptation/phases/batch-experiences/
├── system.md                    ← {INCLUDE:../../../prompts-shared/system-base.md}
├── user.md                      ← {{experience}}, {{job_offer}}, {{language}}
└── schemas/adaptationSchema.json
```

**Ce que ça démontre** : une ingénierie de prompts pensée pour la maintenabilité et la scalabilité, pas du copier-coller de chaînes dans le code.

---

### 3. Pipeline IA de production

Deux pipelines distincts, chacun multi-étapes avec parallélisme contrôlé :

**Pipeline Adaptation** (CV → offre d'emploi) :

```
Offre (URL / PDF / Markdown)
  → Phase 0    Extraction structurée (o4-mini, json_schema)
  → Phase 0.5  Warmup cache (appel à 50 tokens pour pré-charger le cache serveur OpenAI)
  → Phase 1    Classification KEEP/REMOVE/MOVE (gpt-4o)
  → Phase 2    7 tâches en parallèle (Promise.all) :
               expériences · projets · compétences · résumé · extras · formation · langues
  → Phase 3    Recomposition (aucun appel LLM) + initialisation du mode révision
```

**Pipeline Amélioration** (depuis les suggestions du score de matching) :

```
  → Stage 1+2  Classification des compétences + préprocesseur (en parallèle)
  → Stage 3    Amélioration parallèle par section (p-limit(5) appels concurrents)
  → Stage 4    Mise à jour du résumé post-améliorations
```

**Détails d'implémentation notables** :
- La 1ère expérience s'exécute seule, suivie d'un délai de 500ms avant le batch restant — pour laisser le cache serveur d'OpenAI se propager avant les appels parallèles
- File de jobs in-process (`MAX_CONCURRENT_JOBS = 3`) avec limites par utilisateur, sans broker externe
- `AbortController` propagé à tous les appels OpenAI en cours — l'annulation est instantanée et rembourse automatiquement les crédits
- Progression poussée en temps réel au client via Server-Sent Events (SSE)

**Ce que ça démontre** : la capacité à orchestrer des appels LLM complexes en production avec gestion de la concurrence, des erreurs, de l'annulation et du feedback temps réel.

---

### 4. Garde-fous anti-hallucination

L'IA ne peut pas halluciner parce que le **code l'en empêche**, pas seulement le prompt :

| Garde-fou | Comment |
|-----------|---------|
| Champs immuables | `entreprise`, `dates`, `lieu` sont **supprimés** de l'objet avant l'appel LLM et **restaurés** depuis l'original après — le modèle ne les voit jamais |
| Réalisations quantifiées | Seuls les points contenant au moins un chiffre sont conservés (`/\d/.test(item)`) |
| Score indépendant | Le score global retourné par GPT est **ignoré** ; seuls les sous-scores sont extraits et recombinés avec une formule pondérée fixe (35/30/20/15) |
| Structured Outputs | `json_schema` force le modèle à respecter un format strict — pas de texte libre |
| Mode révision | Chaque modification IA est stockée dans `pendingChanges[]` — l'utilisateur accepte ou refuse chaque diff |

**Ce que ça démontre** : une approche défensive où la fiabilité repose sur l'architecture du code, pas sur la bonne volonté du modèle.

---

### 5. Optimisation des coûts et télémétrie

Chaque appel OpenAI est tracé individuellement et agrégé quotidiennement :

- **Par appel** (`OpenAICall`) : tokens prompt / completion / cached, coût, modèle, feature, durée
- **Agrégat journalier** (`OpenAIUsage`) : userId × feature × modèle, avec économies de cache
- **Référentiel de prix** (`OpenAIPricing`) : tarifs standard + priority tier par modèle
- **Alertes sur seuils** (`OpenAIAlert`) : dépense quotidienne / mensuelle, par utilisateur ou globale
- **Stratégie de cache** : warmup de prompt, délai inter-batch pour propagation, `reasoning_effort: low` sur les tâches batch

**Ce que ça démontre** : la maîtrise des coûts et la capacité à instrumenter un système IA pour le suivre et l'optimiser en continu.

---

### 6. Développement Full-Stack SaaS

Au-delà de l'IA, le projet couvre l'ensemble du spectre SaaS :

| Couche | Technologies | Périmètre |
|--------|-------------|-----------|
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS 4 | 138 composants |
| **Backend** | Next.js API Routes, Prisma 6, PostgreSQL | 113 endpoints, 34 modèles |
| **IA** | OpenAI API — GPT-4.1, GPT-4o, o4-mini, GPT-4.1-mini (Vision) | 2 pipelines, 12 phases |
| **Auth** | NextAuth.js — email/password, Google, GitHub, Apple OAuth | JWT, sessions 7j |
| **Paiements** | Stripe | Crédits à la carte, sans abonnement |
| **Extension** | Vite, Manifest V3, Readability, Turndown | Chrome + Firefox, 11 sites d'emploi |
| **Import / Export** | Vision API (PDF→JSON), PDF et DOCX | Templates personnalisés |
| **Multi-langues** | 4 langues (FR, EN, DE, ES) | Politique de langue par prompt |
| **Infra** | Docker, GitHub Actions, Caddy, Cloudflare | CI/CD automatisé, déploiement continu |

---

## Prochaine étape : RAG

Le mode révision collecte déjà les décisions des utilisateurs (acceptation ou refus de chaque modification IA). Ces données constituent une base idéale pour implémenter un système de Retrieval-Augmented Generation qui enrichirait les futures générations à partir des préférences réelles des utilisateurs.

---

## Licence

Propriétaire — Tous droits réservés.
