# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FitMyCV.io is a Next.js 14 application that creates AI-optimized CVs tailored to specific job offers. Built with React 18, Tailwind CSS, Prisma ORM, and OpenAI integration.

## Essential Commands

```bash
# Development
npm run dev                    # Start dev server (port 3001)
npm run build                  # Production build
npm start                      # Start production server (port 3000)

# Database
npx prisma migrate dev --name <name>  # Create migration
npx prisma migrate deploy             # Apply migrations
npx prisma generate                   # Regenerate Prisma client
npx prisma studio                     # Visual DB editor
npx prisma db seed                    # Seed database
npm run db:reset                      # Reset database (dev only)
```

## Architecture

### Tech Stack
- **Frontend**: React 18, Next.js 14 App Router, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma 6, PostgreSQL (prod) / SQLite (dev)
- **AI**: OpenAI API (GPT-4o models)
- **Services**: Stripe (payments), Resend (email), Puppeteer (scraping/PDF)
- **Auth**: NextAuth.js with credentials + OAuth (Google, GitHub, Apple)

### Directory Structure
```
app/                    # Next.js App Router (pages + API routes)
├── api/               # 96 API endpoints
├── auth/              # Authentication pages
├── admin/             # Admin dashboard
└── account/           # User settings

components/            # React components (100+)
├── TopBar/           # Main navigation + modals
├── ui/               # Reusable UI components
├── admin/            # Admin components
└── [CV sections]     # Header, Skills, Experience, Education...

lib/                   # Core libraries
├── auth/             # NextAuth config & session
├── cv/               # CV storage, validation, encryption
├── openai/           # AI functions (generate, translate, improve)
├── backgroundTasks/  # Job queue system (max 3 concurrent)
├── subscription/     # Plans, credits, feature limits
├── email/            # Resend email service
└── api/              # API errors & i18n

prisma/               # Database schema (30+ models)
locales/              # Translations (en, fr, de, es)
```

### Background Task System
Long-running tasks (CV generation, PDF import, translation) use a job queue:
- Max 3 concurrent jobs
- Tasks tracked in `BackgroundTask` model
- Status: queued → running → completed/failed

### CV Storage
CVs are stored as JSON in PostgreSQL (`CvFile.content` field), with versioning for AI optimizations (`CvVersion` model).

## Code Patterns

### API Route Pattern
```javascript
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

export async function GET(request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... logic
  return Response.json({ data });
}
```

### CV Operations
```javascript
import { readUserCvFile, writeUserCvFile } from '@/lib/cv/storage';
import { validateCvData } from '@/lib/cv/validation';

const cvContent = await readUserCvFile(userId, filename);
const { valid, data, errors } = validateCvData(JSON.parse(cvContent));
await writeUserCvFile(userId, filename, modifiedData);
```

### Background Job Pattern
```javascript
import { enqueueJob } from '@/lib/backgroundTasks/jobQueue';
import { runMyJob } from '@/lib/backgroundTasks/myJob';

const task = await prisma.backgroundTask.create({ data: { ... } });
enqueueJob(() => runMyJob(task));
```

### Feature Usage Limits
```javascript
import { checkFeatureLimit, incrementFeatureUsage } from '@/lib/subscription/featureUsage';

const { allowed, needsCredit } = await checkFeatureLimit(userId, 'gpt_cv_generation');
if (!allowed) return Response.json({ error: 'Limit reached' }, { status: 403 });
// ... do work
await incrementFeatureUsage(userId, 'gpt_cv_generation');
```

## Git Workflow

3-branch strategy: `main` ← `release` ← `dev`

- **Branches**: `feature/`, `improvement/`, `bug/` from `dev`; `hotfix/` from `main`
- **PRs required**: Always for merges to `dev`, `release`, `main`
- **Tags**: `-rc` on release, final version on main
- **Commits**: Conventional format (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`)

## Key Files Reference

| Area | Files |
|------|-------|
| Auth config | `lib/auth/options.js`, `lib/auth/session.js` |
| CV validation | `lib/cv/validation.js`, `data/schema.json` |
| AI functions | `lib/openai/*.js` |
| Job queue | `lib/backgroundTasks/jobQueue.js` |
| Subscription | `lib/subscription/featureUsage.js`, `lib/subscription/credits.js` |
| API errors | `lib/api/apiErrors.js` |
| Translations | `locales/{lang}/*.json` |

## Documentation

Full documentation available in `docs/`:
- `ARCHITECTURE.md` - System architecture, data flows
- `API_REFERENCE.md` - All 96 API endpoints
- `CODE_PATTERNS.md` - Reusable code patterns with examples
- `DEVELOPMENT.md` - Git workflow, standards, debugging
- `SUBSCRIPTION.md` - Plans, credits, feature limits
- `DESIGN_SYSTEM.md` - UI/UX guidelines, Tailwind patterns
