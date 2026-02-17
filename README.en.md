<div align="center">

<img src="public/icons/logo.png" alt="FitMyCV Logo" width="360" />

# FitMyCV — AI-Powered CV Optimization SaaS

[![Live](https://img.shields.io/badge/Live-app.fitmycv.io-00C853)](https://app.fitmycv.io)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2024-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma_6-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4.1_%7C_o4--mini_%7C_GPT--4o-412991?logo=openai&logoColor=white)](https://openai.com/)
[![Docker](https://img.shields.io/badge/Docker-Prod-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

**[app.fitmycv.io](https://app.fitmycv.io)** · **[fitmycv.io](https://www.fitmycv.io)**

[🇫🇷 Français](README.md) | 🇬🇧 English

</div>

---

## Why this project

I built FitMyCV as an end-to-end project to develop and demonstrate my **AI Engineering** skills in a real production context — not a PoC, not a notebook, but a full SaaS with users, payments, and deployment infrastructure.

The product tailors CVs to job offers through multi-step LLM pipelines. The central constraint: **the AI never fabricates anything** — it only reformulates and reorganizes the candidate's existing experience, with anti-hallucination safeguards enforced in code.

---

## Skills demonstrated

### 1. Multi-model orchestration

Each pipeline phase uses a model chosen for its specific characteristics. Assignments are stored in the database and hot-swappable without redeployment.

| Phase | Model | Why this model |
|-------|-------|---------------|
| Job offer extraction (noisy HTML/Markdown) | `o4-mini` | Structured reasoning for complex extraction |
| Classification KEEP / REMOVE / MOVE | `gpt-4o` | High accuracy on discrete decisions |
| Experience adaptation (×N in parallel) | `o4-mini` (`reasoning_effort: low`) | Nuanced rewriting, speed-optimized |
| Skills deduction | `o4-mini` | Logical inference from adapted content |
| Targeted experience improvement | `gpt-4.1` | Highest quality for critical rewrites |
| PDF import (multi-page) | `gpt-4.1-mini` (Vision) | Multi-modal page-by-page extraction |
| Match scoring | `gpt-4.1-mini` | Structured scoring + suggestions |

**What this demonstrates**: the ability to select and configure the right model per task based on cost / quality / latency tradeoffs, rather than using a single model for everything.

---

### 2. Prompt Engineering

Prompts aren't hardcoded strings — they're a composable architecture:

- **Markdown files** with `{INCLUDE:path}` directives to reuse common fragments (adaptation rules, language policy, system base)
- **Variable substitution** (`{{experience}}`, `{{job_offer}}`) at call time
- **JSON Structured Output schemas** versioned alongside each prompt — the LLM is constrained to a strict format
- **Cached in production, hot-reloaded in dev** — the loader adapts behavior by environment

```
lib/prompts-shared/              ← Shared fragments
├── system-base.md
├── cv-adaptation-rules.md
├── scoring-rules.md
└── language-policy.md

lib/features/cv-adaptation/phases/batch-experiences/
├── system.md                    ← {INCLUDE:../../../prompts-shared/system-base.md}
├── user.md                      ← {{experience}}, {{job_offer}}, {{language}}
└── schemas/adaptationSchema.json
```

**What this demonstrates**: prompt engineering designed for maintainability and scalability, not copy-pasted strings in application code.

---

### 3. Production AI pipelines

Two distinct pipelines, each multi-step with controlled parallelism:

**Adaptation pipeline** (CV → job offer):

```
Job Offer (URL / PDF / Markdown)
  → Phase 0    Structured extraction (o4-mini, json_schema)
  → Phase 0.5  Cache warmup (50-token call to pre-populate OpenAI's server-side cache)
  → Phase 1    KEEP/REMOVE/MOVE classification (gpt-4o)
  → Phase 2    7 tasks in parallel (Promise.all):
               experiences · projects · skills · summary · extras · education · languages
  → Phase 3    Recomposition (no LLM call) + review mode initialization
```

**Improvement pipeline** (from match score suggestions):

```
  → Stage 1+2  Skill classification + preprocessor (in parallel)
  → Stage 3    Parallel improvement per section (p-limit(5) concurrent calls)
  → Stage 4    Summary update from improved content
```

**Notable implementation details**:
- First experience runs alone, followed by a 500ms delay before the parallel batch — to let OpenAI's server-side cache propagate before parallel calls hit
- In-process job queue (`MAX_CONCURRENT_JOBS = 3`) with per-user limits, no external broker
- `AbortController` propagated to all in-flight OpenAI calls — cancellation is instant and automatically refunds credits
- Real-time progress pushed to the client via Server-Sent Events (SSE)

**What this demonstrates**: the ability to orchestrate complex LLM calls in production with concurrency management, error handling, cancellation, and real-time feedback.

---

### 4. Anti-hallucination safeguards

The AI can't hallucinate because **the code prevents it**, not just the prompt:

| Safeguard | How |
|-----------|-----|
| Immutable fields | `company`, `dates`, `location` are **stripped** from the object before the LLM call and **restored** from the original after — the model never sees them |
| Quantified achievements | Only deliverables containing at least one digit are kept (`/\d/.test(item)`) |
| Independent scoring | GPT's own aggregate score is **discarded**; only sub-scores are extracted and recombined with a fixed weighted formula (35/30/20/15) |
| Structured Outputs | `json_schema` forces the model to respect a strict format — no free-form text |
| Review mode | Each AI modification is stored in `pendingChanges[]` — users accept or reject each diff individually |

**What this demonstrates**: a defensive approach where reliability comes from code architecture, not from trusting the model to behave.

---

### 5. Cost optimization & telemetry

Every OpenAI call is tracked individually and aggregated daily:

- **Per call** (`OpenAICall`): prompt / completion / cached tokens, cost, model, feature, duration
- **Daily aggregate** (`OpenAIUsage`): userId × feature × model, with cache savings
- **Pricing reference** (`OpenAIPricing`): standard + priority tier pricing per model
- **Threshold alerts** (`OpenAIAlert`): daily / monthly spend, per-user or global
- **Caching strategy**: prompt warmup, inter-batch delay for propagation, `reasoning_effort: low` on batch tasks

**What this demonstrates**: cost awareness and the ability to instrument an AI system for ongoing monitoring and optimization.

---

### 6. Full-Stack SaaS development

Beyond AI, the project covers the entire SaaS spectrum:

| Domain | Implementation |
|--------|---------------|
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS 4 — 138 components |
| **Backend** | 113 API routes, Prisma 6, 34 data models |
| **Auth** | NextAuth.js — email/password, Google, GitHub, Apple OAuth |
| **Payments** | Stripe — à la carte credits, no subscription |
| **Browser extension** | Chrome / Firefox Manifest V3 — job offer extraction from 11 job boards |
| **Import / Export** | Vision API (PDF→JSON), PDF and DOCX export with templates |
| **Multi-language** | French, English, German, Spanish |
| **Infrastructure** | Docker, GitHub Actions (automated CI/CD), Caddy, Cloudflare |
| **Versioning** | Full CV history, one-click restore |

---

## Tech stack

| Layer | Technologies |
|-------|-------------|
| **Application** | Next.js 16, React 19, Tailwind CSS 4, JavaScript ES2024 |
| **Database** | PostgreSQL, Prisma 6 (34 models) |
| **AI** | OpenAI API — GPT-4.1, GPT-4o, o4-mini, GPT-4.1-mini (Vision) |
| **Auth** | NextAuth.js (Google, GitHub, Apple) |
| **Payments** | Stripe |
| **Extension** | Vite, Manifest V3, Readability, Turndown |
| **Infra** | Docker, GitHub Actions, Caddy, Cloudflare |

---

## Documentation

Full technical documentation is available in [`docs/`](./docs/):

| Document | Content |
|----------|---------|
| [Architecture](./docs/architecture.md) | System architecture |
| [API Reference](./docs/api-reference.md) | 113 endpoints |
| [Data Models](./docs/data-models.md) | 34 Prisma models |
| [Components](./docs/components.md) | 138 React components |

---

## License

Proprietary — All rights reserved.
