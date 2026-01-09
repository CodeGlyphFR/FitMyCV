# Tech-Spec : CV Generation Pipeline v2

## 1. Vue d'Ensemble

### 1.1 Objectif
Refactoriser le système de génération de CV IA en passant d'un appel monolithique à un pipeline découpé en phases spécialisées. L'objectif est d'améliorer la qualité des résultats en réduisant la charge cognitive par appel IA.

### 1.2 Problèmes du Système Actuel
- L'IA reçoit trop de contexte en une seule fois ("bouillie de contexte")
- Invention de données/compétences non présentes dans le CV source
- Mauvaise adaptation des expériences
- Phrases mal construites ("parle comme Tarzan")
- Confusion responsibilities/deliverables
- Mauvaise gestion des skills (suppression incorrecte, pas de détection implicite)

### 1.3 Solution Proposée
Pipeline en 3 phases avec appels IA spécialisés :
- **Phase 0.5** : Classification des expériences (KEEP/REMOVE/MOVE_TO_PROJECTS)
- **Phase 1** : Batches par section avec dépendances
- **Phase 2** : Recomposition immédiate dès qu'une offre est prête

---

## 2. Architecture Technique

### 2.1 Nouveau Schéma de Données

#### Tables Prisma à créer

```prisma
// Table principale pour une tâche de génération v2
model CvGenerationTask {
  id                String   @id @default(uuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Références
  sourceCvFileId    String?  // CvFile source (nullable si mode template)
  sourceCvFile      CvFile?  @relation("SourceCv", fields: [sourceCvFileId], references: [id])

  // Status global
  status            String   @default("pending") // pending, running, completed, failed, cancelled
  currentPhase      String?  // classify, batching, recomposing

  // Progression
  totalOffers       Int      @default(0)
  completedOffers   Int      @default(0)

  // Résultats
  generatedCvIds    String[] // IDs des CvFile générés

  // Erreur
  error             String?

  // Metadata
  payload           Json?    // Config originale (mode, options, etc.)

  // Timestamps
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  completedAt       DateTime?

  // Relations
  subtasks          CvGenerationSubtask[]
  offers            CvGenerationOffer[]
  creditTransaction CreditTransaction?   @relation(fields: [creditTransactionId], references: [id])
  creditTransactionId String? @unique

  @@index([userId])
  @@index([status])
  @@index([createdAt])
}

// Table pour le tracking par offre d'emploi
model CvGenerationOffer {
  id                String   @id @default(uuid())
  taskId            String
  task              CvGenerationTask @relation(fields: [taskId], references: [id], onDelete: Cascade)

  // Référence offre
  jobOfferId        String?  // JobOffer existante (si scraping)
  jobOffer          JobOffer? @relation(fields: [jobOfferId], references: [id])
  offerIndex        Int      // Index dans la liste des offres (0, 1, 2...)

  // Status
  status            String   @default("pending") // pending, classifying, batching, recomposing, completed, failed
  currentStep       String?  // classify, experiences, projects, extras, skills, summary, recompose

  // Résultats intermédiaires (JSON)
  classificationResult Json?  // Résultat Phase 0.5
  batchResults       Json?    // Résultats Phase 1 agrégés

  // CV généré
  generatedCvFileId  String?
  generatedCvFile    CvFile?  @relation(fields: [generatedCvFileId], references: [id])

  // Erreur spécifique à cette offre
  error              String?

  // Timestamps
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  completedAt        DateTime?

  // Relations
  subtasks           CvGenerationSubtask[]

  @@index([taskId])
  @@index([status])
}

// Table pour chaque sous-tâche IA
model CvGenerationSubtask {
  id                String   @id @default(uuid())
  taskId            String
  task              CvGenerationTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  offerId           String?
  offer             CvGenerationOffer? @relation(fields: [offerId], references: [id], onDelete: Cascade)

  // Type de sous-tâche
  type              String   // classify, batch_experience, batch_project, batch_extras, batch_skills, batch_summary

  // Pour les batches granulaires
  itemIndex         Int?     // Index de l'item (experience[0], project[1], etc.)

  // Status
  status            String   @default("pending") // pending, running, completed, failed

  // Résultat
  result            Json?

  // Métriques
  promptTokens      Int?
  completionTokens  Int?
  durationMs        Int?
  modelUsed         String?

  // Erreur
  error             String?
  retryCount        Int      @default(0)

  // Timestamps
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  completedAt       DateTime?

  @@index([taskId])
  @@index([offerId])
  @@index([type])
  @@index([status])
}
```

#### Settings à ajouter (table Setting existante)

| settingName | category | defaultValue | description |
|-------------|----------|--------------|-------------|
| `model_cv_classify` | ai_models | gpt-4o-mini | Modèle pour la classification des expériences |
| `model_cv_batch_experience` | ai_models | gpt-4o-mini | Modèle pour l'adaptation d'une expérience |
| `model_cv_batch_projects` | ai_models | gpt-4o-mini | Modèle pour l'adaptation d'un projet |
| `model_cv_batch_extras` | ai_models | gpt-4o-mini | Modèle pour l'adaptation des extras |
| `model_cv_batch_skills` | ai_models | gpt-4o-mini | Modèle pour l'adaptation des compétences |
| `model_cv_batch_summary` | ai_models | gpt-4o-mini | Modèle pour la génération du summary |

### 2.2 Architecture des Phases

```
┌─────────────────────────────────────────────────────────────────────┐
│                        API: POST /api/cv/generate-v2                │
│                     Crée CvGenerationTask + debit crédit            │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         PHASE 0: SCRAPING                           │
│           (existant - JobOffer déjà créées par /api/job-offers)     │
│                   Crée CvGenerationOffer pour chaque offre          │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 │  Séquentiel par offre (cache OpenAI)
                                 ▼
        ┌────────────────────────────────────────────────────┐
        │                    OFFRE N                         │
        │                                                    │
        │  ┌──────────────────────────────────────────────┐ │
        │  │         PHASE 0.5: CLASSIFICATION            │ │
        │  │    Détermine KEEP/REMOVE/MOVE pour chaque    │ │
        │  │           expérience et projet               │ │
        │  └─────────────────────┬────────────────────────┘ │
        │                        │                          │
        │                        ▼                          │
        │  ┌──────────────────────────────────────────────┐ │
        │  │              PHASE 1: BATCHES                │ │
        │  │                                              │ │
        │  │  PARALLÈLE (même contexte) :                 │ │
        │  │  ┌─────────────┬──────────────┬───────────┐  │ │
        │  │  │Experiences  │  Projects    │  Extras   │  │ │
        │  │  │[0..n]       │  [0..n]      │  (1 appel)│  │ │
        │  │  └──────┬──────┴──────┬───────┴─────┬─────┘  │ │
        │  │         │             │             │        │ │
        │  │         └─────────────┼─────────────┘        │ │
        │  │                       │                      │ │
        │  │                       ▼                      │ │
        │  │  SÉQUENTIEL (dépendances) :                  │ │
        │  │  ┌────────────────────────────────────────┐  │ │
        │  │  │  Skills (après exp + proj terminés)   │  │ │
        │  │  └─────────────────────┬──────────────────┘  │ │
        │  │                        │                     │ │
        │  │                        ▼                     │ │
        │  │  ┌────────────────────────────────────────┐  │ │
        │  │  │  Summary (après skills + extras)       │  │ │
        │  │  └─────────────────────┬──────────────────┘  │ │
        │  │                        │                     │ │
        │  └────────────────────────┼─────────────────────┘ │
        │                           │                       │
        │                           ▼                       │
        │  ┌──────────────────────────────────────────────┐ │
        │  │         PHASE 2: RECOMPOSITION               │ │
        │  │                                              │ │
        │  │  1. Assembler tous les résultats            │ │
        │  │  2. header.current_title = jobOffer.title   │ │
        │  │  3. Créer CvFile + CvVersion                │ │
        │  │  4. SSE → User peut accéder au CV !         │ │
        │  │                                              │ │
        │  └──────────────────────────────────────────────┘ │
        │                                                    │
        │  ════════════════════════════════════════════════ │
        │         CV OFFRE N DISPONIBLE IMMÉDIATEMENT       │
        │  (pendant que les autres offres continuent)       │
        └────────────────────────────────────────────────────┘
```

### 2.3 Flux de Dépendances Détaillé

```
CLASSIFICATION (1 appel)
         │
         ▼
    ╔════════════════════════════════════════════╗
    ║            PARALLÈLE                       ║
    ║                                            ║
    ║  Experiences[0] ─┐                         ║
    ║  Experiences[1] ─┤                         ║
    ║  Experiences[n] ─┤                         ║
    ║                  │                         ║
    ║  Projects[0] ────┼──► Collecteur           ║
    ║  Projects[1] ────┤      │                  ║
    ║  Projects[n] ────┤      │                  ║
    ║                  │      │                  ║
    ║  Extras ─────────┘      │                  ║
    ╚════════════════════════╪═══════════════════╝
                             │
                             │ Quand TOUS terminés
                             ▼
                      ┌─────────────┐
                      │   Skills    │ (utilise contexte exp + proj)
                      └──────┬──────┘
                             │
                             ▼
                      ┌─────────────┐
                      │   Summary   │ (utilise skills + exp + extras)
                      └──────┬──────┘
                             │
                             ▼
                      ┌─────────────┐
                      │  Recompose  │ (assemble tout + titre offre)
                      └──────┬──────┘
                             │
                             ▼
                    SSE: offer_completed
                    (CV disponible pour l'utilisateur)
```

**Pourquoi cette séquence :**
1. **Experiences + Projects + Extras en parallèle** : Ils ont tous le même contexte (classification + offre). Pas de dépendance entre eux.
2. **Skills après Exp + Proj** : Les skills sont déduits/adaptés en fonction des expériences et projets déjà adaptés.
3. **Summary en dernier** : Le résumé synthétise l'ENSEMBLE du CV adapté (skills + expériences + extras).

### 2.4 Flux SSE pour le Frontend

```javascript
// Événements SSE émis par le pipeline
{
  // Nouvelle tâche créée
  event: 'cv_generation_v2:created',
  data: { taskId, totalOffers }
}

{
  // Offre en cours de traitement
  event: 'cv_generation_v2:offer_progress',
  data: {
    taskId,
    offerId,
    offerIndex,      // 0, 1, 2...
    totalOffers,     // total
    step,            // 'classify' | 'experiences' | 'projects' | 'extras' | 'skills' | 'summary' | 'recompose'
    status           // 'running' | 'completed'
  }
}

{
  // Offre terminée - CV DISPONIBLE IMMÉDIATEMENT
  event: 'cv_generation_v2:offer_completed',
  data: {
    taskId,
    offerId,
    offerIndex,
    generatedCvFileId,
    generatedCvFileName
  }
}

{
  // Tâche entière terminée (toutes les offres)
  event: 'cv_generation_v2:completed',
  data: {
    taskId,
    generatedCvIds,
    totalGenerated,
    totalFailed
  }
}

{
  // Erreur sur une offre
  event: 'cv_generation_v2:error',
  data: { taskId, offerId?, error }
}
```

---

## 3. Modifications Backend

### 3.1 Nouveaux Fichiers à Créer

#### `lib/cv-pipeline-v2/orchestrator.js`
Orchestrateur principal du pipeline.

```javascript
/**
 * Orchestrateur du pipeline de génération CV v2
 *
 * Traite les offres SÉQUENTIELLEMENT (pour optimiser le cache OpenAI)
 * mais chaque offre peut compléter et notifier l'utilisateur
 * INDÉPENDAMMENT des autres.
 */

import { runClassificationPhase } from './phases/classify';
import { runBatchPhase } from './phases/batch';
import { runRecomposePhase } from './phases/recompose';
import { sseManager } from '@/lib/sse/sseManager';

export async function startCvGenerationV2(taskId) {
  const task = await prisma.cvGenerationTask.findUnique({
    where: { id: taskId },
    include: { offers: true }
  });

  await prisma.cvGenerationTask.update({
    where: { id: taskId },
    data: { status: 'running' }
  });

  // Traiter les offres séquentiellement (pour le cache OpenAI)
  // MAIS chaque offre notifie l'utilisateur dès qu'elle est terminée
  for (const offer of task.offers) {
    try {
      // Phase 0.5: Classification
      await runClassificationPhase(task, offer);

      // Phase 1: Batches (parallèle entre exp/proj/extras, séquentiel pour skills/summary)
      await runBatchPhase(task, offer);

      // Phase 2: Recomposition → CV disponible immédiatement
      await runRecomposePhase(task, offer);

      // Incrémenter le compteur
      await prisma.cvGenerationTask.update({
        where: { id: taskId },
        data: { completedOffers: { increment: 1 } }
      });

    } catch (error) {
      // Marquer l'offre en échec mais CONTINUER les autres
      await markOfferFailed(offer.id, error);
      sseManager.broadcast(task.userId, 'cv_generation_v2:error', {
        taskId: task.id,
        offerId: offer.id,
        error: error.message
      });
    }
  }

  // Finaliser la tâche
  await finalizeTask(taskId);
}
```

#### `lib/cv-pipeline-v2/phases/classify.js`

```javascript
/**
 * Phase 0.5: Classification
 *
 * Analyse le CV source + offre pour déterminer:
 * - Quelles expériences GARDER et reformuler
 * - Quelles expériences SUPPRIMER (> 7 ans + hors domaine)
 * - Quels side-projects DÉPLACER vers section projects
 */

export async function runClassificationPhase(task, offer) {
  // 1. Mettre à jour le status
  await updateOfferStep(offer.id, 'classify');

  // 2. Charger les données
  const sourceCv = await loadSourceCv(task);
  const jobOffer = await loadJobOffer(offer.jobOfferId);

  // 3. Émettre SSE - début classification
  sseManager.broadcast(task.userId, 'cv_generation_v2:offer_progress', {
    taskId: task.id,
    offerId: offer.id,
    offerIndex: offer.offerIndex,
    step: 'classify',
    status: 'running'
  });

  // 4. Appeler l'IA avec le prompt de classification
  const classificationResult = await callClassifyAI(sourceCv, jobOffer);

  // 5. Sauvegarder le résultat
  await prisma.cvGenerationOffer.update({
    where: { id: offer.id },
    data: { classificationResult }
  });

  // 6. Émettre SSE - fin classification
  sseManager.broadcast(task.userId, 'cv_generation_v2:offer_progress', {
    taskId: task.id,
    offerId: offer.id,
    offerIndex: offer.offerIndex,
    step: 'classify',
    status: 'completed'
  });

  return classificationResult;
}
```

#### `lib/cv-pipeline-v2/phases/batch.js`

```javascript
/**
 * Phase 1: Batches
 *
 * 1. PARALLÈLE : Experiences + Projects + Extras (même contexte)
 * 2. SÉQUENTIEL : Skills (dépend de exp + proj)
 * 3. SÉQUENTIEL : Summary (dépend de skills + extras)
 */

export async function runBatchPhase(task, offer) {
  const classification = offer.classificationResult;
  const sourceCv = await loadSourceCv(task);
  const jobOffer = await loadJobOffer(offer.jobOfferId);

  // ══════════════════════════════════════════════════════════════
  // ÉTAPE 1: PARALLÈLE - Experiences + Projects + Extras
  // ══════════════════════════════════════════════════════════════

  // Émettre SSE pour les 3 en "running"
  emitBatchProgress(task, offer, ['experiences', 'projects', 'extras'], 'running');

  const [experiencesResults, projectsResults, extrasResult] = await Promise.all([
    batchExperiences(task, offer, classification, sourceCv, jobOffer),
    batchProjects(task, offer, classification, sourceCv, jobOffer),
    batchExtras(task, offer, sourceCv, jobOffer)
  ]);

  emitBatchProgress(task, offer, ['experiences', 'projects', 'extras'], 'completed');

  // ══════════════════════════════════════════════════════════════
  // ÉTAPE 2: Skills (après experiences + projects)
  // ══════════════════════════════════════════════════════════════

  await updateOfferStep(offer.id, 'skills');
  emitBatchProgress(task, offer, ['skills'], 'running');

  const skillsResult = await batchSkills(task, offer, {
    experiences: experiencesResults,
    projects: projectsResults,
    sourceCv,
    jobOffer
  });

  emitBatchProgress(task, offer, ['skills'], 'completed');

  // ══════════════════════════════════════════════════════════════
  // ÉTAPE 3: Summary (après skills + extras)
  // ══════════════════════════════════════════════════════════════

  await updateOfferStep(offer.id, 'summary');
  emitBatchProgress(task, offer, ['summary'], 'running');

  const summaryResult = await batchSummary(task, offer, {
    skills: skillsResult,
    experiences: experiencesResults,
    extras: extrasResult,
    sourceCv,
    jobOffer
  });

  emitBatchProgress(task, offer, ['summary'], 'completed');

  // ══════════════════════════════════════════════════════════════
  // Agréger tous les résultats
  // ══════════════════════════════════════════════════════════════

  await prisma.cvGenerationOffer.update({
    where: { id: offer.id },
    data: {
      batchResults: {
        experiences: experiencesResults,
        projects: projectsResults,
        extras: extrasResult,
        skills: skillsResult,
        summary: summaryResult,
      }
    }
  });
}

/**
 * Batch des expériences - 1 appel par expérience KEEP (parallèle)
 */
async function batchExperiences(task, offer, classification, sourceCv, jobOffer) {
  const experiencesToKeep = classification.experiences
    .filter(e => e.action === 'KEEP');

  // Paralléliser les appels pour chaque expérience
  const results = await Promise.all(
    experiencesToKeep.map(async (exp, index) => {
      const originalExp = sourceCv.experience[exp.originalIndex];
      return batchSingleExperience(task, offer, originalExp, jobOffer, index);
    })
  );

  return results;
}

/**
 * Batch des projets - inclut les MOVED depuis experiences (parallèle)
 */
async function batchProjects(task, offer, classification, sourceCv, jobOffer) {
  // Projets originaux à garder
  const projectsToKeep = classification.projects
    .filter(p => p.action === 'KEEP');

  // Expériences à déplacer vers projects
  const movedToProjects = classification.experiences
    .filter(e => e.action === 'MOVE_TO_PROJECTS');

  const allProjects = [
    ...projectsToKeep.map(p => sourceCv.projects[p.originalIndex]),
    ...movedToProjects.map(e => sourceCv.experience[e.originalIndex])
  ];

  // Paralléliser les appels pour chaque projet
  const results = await Promise.all(
    allProjects.map(async (proj, index) => {
      return batchSingleProject(task, offer, proj, jobOffer, index);
    })
  );

  return results;
}
```

#### `lib/cv-pipeline-v2/phases/recompose.js`

```javascript
/**
 * Phase 2: Recomposition
 *
 * Déclenché DÈS que tous les batches d'une offre sont terminés.
 * L'utilisateur peut accéder au CV IMMÉDIATEMENT, même si
 * d'autres offres sont encore en cours de traitement.
 */

export async function runRecomposePhase(task, offer) {
  await updateOfferStep(offer.id, 'recompose');

  const batchResults = offer.batchResults;
  const sourceCv = await loadSourceCv(task);
  const jobOffer = await loadJobOffer(offer.jobOfferId);

  // Émettre SSE - début recomposition
  sseManager.broadcast(task.userId, 'cv_generation_v2:offer_progress', {
    taskId: task.id,
    offerId: offer.id,
    offerIndex: offer.offerIndex,
    step: 'recompose',
    status: 'running'
  });

  // ══════════════════════════════════════════════════════════════
  // Construire le CV final (assemblage, pas d'appel IA)
  // ══════════════════════════════════════════════════════════════

  const finalCv = {
    ...sourceCv,

    // Header avec titre de l'offre (COPIE DIRECTE)
    header: {
      ...sourceCv.header,
      current_title: jobOffer.title
    },

    // Summary généré
    summary: batchResults.summary,

    // Expériences adaptées
    experience: batchResults.experiences,

    // Projets adaptés (incluant les MOVED)
    projects: batchResults.projects,

    // Skills adaptés
    skills: batchResults.skills,

    // Extras adaptés
    extras: batchResults.extras,
  };

  // ══════════════════════════════════════════════════════════════
  // Sauvegarder le CV
  // ══════════════════════════════════════════════════════════════

  const cvFile = await createCvFile(task.userId, finalCv, jobOffer);
  await createCvVersion(cvFile.id, 'gpt_cv_generation_v2');

  // Mettre à jour l'offre
  await prisma.cvGenerationOffer.update({
    where: { id: offer.id },
    data: {
      status: 'completed',
      generatedCvFileId: cvFile.id,
      completedAt: new Date()
    }
  });

  // ══════════════════════════════════════════════════════════════
  // SSE: CV DISPONIBLE IMMÉDIATEMENT POUR L'UTILISATEUR
  // ══════════════════════════════════════════════════════════════

  sseManager.broadcast(task.userId, 'cv_generation_v2:offer_completed', {
    taskId: task.id,
    offerId: offer.id,
    offerIndex: offer.offerIndex,
    generatedCvFileId: cvFile.id,
    generatedCvFileName: cvFile.filename
  });

  // Trigger refresh de la liste CV côté client
  sseManager.broadcast(task.userId, 'cv:list:changed', {});
}
```

#### `lib/cv-pipeline-v2/prompts/`
Dossier contenant les prompts spécialisés.

```
lib/cv-pipeline-v2/prompts/
├── classify.md           # Classification expériences/projets
├── batch-experience.md   # Adapter UNE expérience
├── batch-project.md      # Adapter UN projet
├── batch-extras.md       # Adapter les extras
├── batch-skills.md       # Adapter les compétences (avec contexte exp/proj)
└── batch-summary.md      # Générer le summary (avec contexte complet)
```

### 3.2 Nouvelle Route API

#### `app/api/cv/generate-v2/route.js`

```javascript
/**
 * POST /api/cv/generate-v2
 *
 * Body:
 * {
 *   sourceCvFile: string,        // Filename du CV source
 *   jobOfferIds: string[],       // IDs des JobOffer à traiter
 *   mode: 'adapt' | 'template'   // Mode génération
 * }
 */

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return apiError(CommonErrors.notAuthenticated());
  }

  const userId = session.user.id;
  const { sourceCvFile, jobOfferIds, mode } = await request.json();

  // 1. Vérifier les crédits
  const cost = jobOfferIds.length; // 1 crédit par offre
  const { allowed, needsCredit } = await canUseFeature(userId, 'gpt_cv_generation');
  if (!allowed) {
    return apiError({ error: 'credits.insufficient', status: 403 });
  }

  // 2. Débiter les crédits
  const transaction = await debitCredit(userId, cost, 'gpt_cv_generation', {
    offerCount: jobOfferIds.length,
    pipelineVersion: 'v2'
  });

  // 3. Créer la tâche principale
  const task = await prisma.cvGenerationTask.create({
    data: {
      userId,
      sourceCvFileId: sourceCvFile ? await getCvFileId(userId, sourceCvFile) : null,
      status: 'pending',
      totalOffers: jobOfferIds.length,
      creditTransactionId: transaction.id,
      payload: { mode, sourceCvFile }
    }
  });

  // 4. Créer les offres associées
  await prisma.cvGenerationOffer.createMany({
    data: jobOfferIds.map((jobOfferId, index) => ({
      taskId: task.id,
      jobOfferId,
      offerIndex: index,
      status: 'pending'
    }))
  });

  // 5. Lancer le pipeline en background
  enqueueJob(() => startCvGenerationV2(task.id));

  // 6. Émettre SSE
  sseManager.broadcast(userId, 'cv_generation_v2:created', {
    taskId: task.id,
    totalOffers: jobOfferIds.length
  });

  return Response.json({
    success: true,
    taskId: task.id,
    totalOffers: jobOfferIds.length
  });
}
```

### 3.3 Modifications Fichiers Existants

#### `lib/admin/settingsConfig.js`

```diff
// Mapping des settings individuels vers des labels lisibles
export const SETTING_LABELS = {
  // Modèles IA - Génération CV
  model_cv_generation: 'Génération CV (legacy)',
+ model_cv_classify: 'Pipeline v2 - Classification',
+ model_cv_batch_experience: 'Pipeline v2 - Experience',
+ model_cv_batch_projects: 'Pipeline v2 - Projects',
+ model_cv_batch_extras: 'Pipeline v2 - Extras',
+ model_cv_batch_skills: 'Pipeline v2 - Skills',
+ model_cv_batch_summary: 'Pipeline v2 - Summary',

  // ...autres settings
};

// Structure hiérarchique pour les modèles IA
export const AI_MODELS_STRUCTURE = {
- 'Génération CV': ['model_cv_generation'],
+ 'Génération CV (Legacy)': ['model_cv_generation'],
+ 'Pipeline CV v2': [
+   'model_cv_classify',
+   'model_cv_batch_experience',
+   'model_cv_batch_projects',
+   'model_cv_batch_extras',
+   'model_cv_batch_skills',
+   'model_cv_batch_summary',
+ ],
  'Extraction d\'offre': ['model_extract_job_offer'],
  // ...autres groupes
};
```

#### `lib/backgroundTasks/taskFeatureMapping.js`

```diff
export const TASK_FEATURE_MAPPING = {
  'generation': 'gpt_cv_generation',
+ 'cv_generation_v2': 'gpt_cv_generation',
  'import': 'import_pdf',
  // ...
};

export const DEFAULT_DURATIONS = {
  'generation': 30000,
+ 'cv_generation_v2': 45000, // Par offre (pas total)
  'import': 25000,
  // ...
};
```

---

## 4. Modifications Frontend

### 4.1 Composant TaskQueueModal.jsx

Afficher la progression par étapes pour les tâches pipeline v2, avec indication du nombre d'offres.

```jsx
// Nouveau composant pour les tâches pipeline v2
function PipelineTaskProgress({ task }) {
  const { t } = useLanguage();

  // Étapes du pipeline (dans l'ordre d'exécution)
  const STEPS = [
    { key: 'classify', label: t('taskQueue.steps.classify') },
    { key: 'experiences', label: t('taskQueue.steps.experiences') },
    { key: 'projects', label: t('taskQueue.steps.projects') },
    { key: 'extras', label: t('taskQueue.steps.extras') },
    { key: 'skills', label: t('taskQueue.steps.skills') },
    { key: 'summary', label: t('taskQueue.steps.summary') },
    { key: 'recompose', label: t('taskQueue.steps.recompose') },
  ];

  const currentStep = task.payload?.currentStep || 'classify';
  const currentStepIndex = STEPS.findIndex(s => s.key === currentStep);
  const completedOffers = task.payload?.completedOffers || 0;
  const totalOffers = task.payload?.totalOffers || 1;

  return (
    <div className="flex flex-col gap-1">
      {/* Indicateur offres si multi-offres */}
      {totalOffers > 1 && (
        <div className="text-xs text-white/60">
          {completedOffers}/{totalOffers} offres
        </div>
      )}

      {/* Indicateur étapes */}
      <div className="flex items-center gap-1">
        {STEPS.map((step, index) => (
          <div
            key={step.key}
            className={`w-2 h-2 rounded-full transition-colors ${
              index < currentStepIndex
                ? 'bg-emerald-400'                    // Terminé
                : index === currentStepIndex
                  ? 'bg-blue-400 animate-pulse'       // En cours
                  : 'bg-white/20'                     // À venir
            }`}
            title={step.label}
          />
        ))}
      </div>
    </div>
  );
}

// Dans TaskItem, ajouter la condition:
function TaskItem({ task, onCancel, onTaskClick }) {
  // ...

  // Pour les tâches pipeline v2, afficher les étapes au lieu du donut
  const isPipelineV2 = task.type === 'cv_generation_v2';

  return (
    <div className="...">
      {/* ... */}
      <div className="flex items-center gap-2 ml-4">
        {isPipelineV2 && task.status === 'running' ? (
          <PipelineTaskProgress task={task} />
        ) : showProgressDonut && (task.status === 'running' || task.status === 'completed') ? (
          <TaskProgressIndicator task={task} onComplete={() => setShowProgressDonut(false)} />
        ) : (
          <span className={`text-sm font-medium ${statusDisplay.color}`}>
            {statusDisplay.label}
          </span>
        )}
        {/* ... */}
      </div>
    </div>
  );
}
```

### 4.2 Hook useSSEPipelineProgress.js (nouveau)

```javascript
/**
 * Hook pour écouter la progression du pipeline via SSE
 * Permet d'afficher les CV dès qu'ils sont prêts (sans attendre les autres)
 */
import { useEffect, useState, useCallback } from 'react';

export function useSSEPipelineProgress(taskId) {
  const [progress, setProgress] = useState({
    currentOffer: 0,
    totalOffers: 0,
    currentStep: null,
    completedOffers: [],      // { id, cvFileId, cvFileName }
    status: 'pending'
  });

  useEffect(() => {
    if (!taskId) return;

    const handleOfferProgress = (event) => {
      if (event.detail.taskId === taskId) {
        setProgress(prev => ({
          ...prev,
          currentOffer: event.detail.offerIndex,
          totalOffers: event.detail.totalOffers,
          currentStep: event.detail.step,
          status: 'running'
        }));
      }
    };

    // CV disponible immédiatement !
    const handleOfferCompleted = (event) => {
      if (event.detail.taskId === taskId) {
        setProgress(prev => ({
          ...prev,
          completedOffers: [
            ...prev.completedOffers,
            {
              id: event.detail.offerId,
              cvFileId: event.detail.generatedCvFileId,
              cvFileName: event.detail.generatedCvFileName
            }
          ]
        }));
      }
    };

    const handleCompleted = (event) => {
      if (event.detail.taskId === taskId) {
        setProgress(prev => ({
          ...prev,
          status: 'completed'
        }));
      }
    };

    const handleError = (event) => {
      if (event.detail.taskId === taskId) {
        setProgress(prev => ({
          ...prev,
          error: event.detail.error
        }));
      }
    };

    window.addEventListener('cv_generation_v2:offer_progress', handleOfferProgress);
    window.addEventListener('cv_generation_v2:offer_completed', handleOfferCompleted);
    window.addEventListener('cv_generation_v2:completed', handleCompleted);
    window.addEventListener('cv_generation_v2:error', handleError);

    return () => {
      window.removeEventListener('cv_generation_v2:offer_progress', handleOfferProgress);
      window.removeEventListener('cv_generation_v2:offer_completed', handleOfferCompleted);
      window.removeEventListener('cv_generation_v2:completed', handleCompleted);
      window.removeEventListener('cv_generation_v2:error', handleError);
    };
  }, [taskId]);

  return progress;
}
```

### 4.3 Traductions i18n

```json
// locales/fr.json
{
  "taskQueue": {
    "steps": {
      "classify": "Classification",
      "experiences": "Expériences",
      "projects": "Projets",
      "extras": "Extras",
      "skills": "Compétences",
      "summary": "Résumé",
      "recompose": "Finalisation"
    },
    "messages": {
      "pipelineInProgress": "Génération ({current}/{total})",
      "pipelineOfferReady": "CV prêt pour l'offre {index}",
      "pipelineCompleted": "{count} CV générés"
    }
  }
}

// locales/en.json
{
  "taskQueue": {
    "steps": {
      "classify": "Classification",
      "experiences": "Experiences",
      "projects": "Projects",
      "extras": "Extras",
      "skills": "Skills",
      "summary": "Summary",
      "recompose": "Finalizing"
    },
    "messages": {
      "pipelineInProgress": "Generating ({current}/{total})",
      "pipelineOfferReady": "CV ready for offer {index}",
      "pipelineCompleted": "{count} CVs generated"
    }
  }
}
```

### 4.4 Admin SettingsTab - Automatique

Le composant `SettingsTab.jsx` utilise `AI_MODELS_STRUCTURE` de `settingsConfig.js`.
L'ajout du groupe "Pipeline CV v2" sera automatiquement affiché.

---

## 5. Migration de Données

### 5.1 Script de Migration Prisma

```bash
npx prisma migrate dev --name add_cv_generation_pipeline_v2
```

### 5.2 Seed des Settings

```javascript
// prisma/seed-pipeline-v2.js

const PIPELINE_V2_SETTINGS = [
  { settingName: 'model_cv_classify', category: 'ai_models', value: 'gpt-4o-mini', description: 'Classification des expériences (KEEP/REMOVE/MOVE)' },
  { settingName: 'model_cv_batch_experience', category: 'ai_models', value: 'gpt-4o-mini', description: 'Adaptation d\'une expérience' },
  { settingName: 'model_cv_batch_projects', category: 'ai_models', value: 'gpt-4o-mini', description: 'Adaptation d\'un projet' },
  { settingName: 'model_cv_batch_extras', category: 'ai_models', value: 'gpt-4o-mini', description: 'Adaptation des extras' },
  { settingName: 'model_cv_batch_skills', category: 'ai_models', value: 'gpt-4o-mini', description: 'Adaptation des compétences' },
  { settingName: 'model_cv_batch_summary', category: 'ai_models', value: 'gpt-4o-mini', description: 'Génération du résumé' },
];

async function seedPipelineV2Settings() {
  for (const setting of PIPELINE_V2_SETTINGS) {
    await prisma.setting.upsert({
      where: { settingName: setting.settingName },
      update: {},
      create: setting
    });
  }
}
```

---

## 6. Plan d'Implémentation

### Phase 1: Infrastructure (Stories 1-3)
1. **Story 1**: Migration Prisma + Seed settings
   - Créer les 3 nouvelles tables
   - Ajouter les 6 nouveaux settings
   - Tester la migration en dev

2. **Story 2**: Modifications settingsConfig.js
   - Ajouter les labels et la structure hiérarchique
   - Vérifier l'affichage dans l'admin

3. **Story 3**: Route API `/api/cv/generate-v2`
   - Endpoint de création de tâche
   - Validation des inputs
   - Débit des crédits

### Phase 2: Pipeline Core (Stories 4-7)
4. **Story 4**: Phase Classification
   - Prompt de classification
   - Logique KEEP/REMOVE/MOVE
   - Tests unitaires

5. **Story 5**: Phase Batches - Parallèle
   - Prompts experience/project/extras
   - Parallélisation avec Promise.all
   - Tracking des subtasks

6. **Story 6**: Phase Batches - Séquentiel
   - Prompts skills/summary
   - Dépendances sur résultats précédents
   - Agrégation des résultats

7. **Story 7**: Orchestrateur + Recomposition
   - Coordination des phases
   - Assemblage du CV final
   - Gestion des erreurs/retry
   - SSE offer_completed

### Phase 3: Frontend Integration (Stories 8-10)
8. **Story 8**: SSE Events
   - Émission des événements
   - Hook useSSEPipelineProgress
   - Intégration BackgroundTasksProvider

9. **Story 9**: TaskQueueModal
   - Composant PipelineTaskProgress
   - Affichage des étapes
   - Multi-offres avec CV accessibles individuellement

10. **Story 10**: Traductions + Tests E2E
    - Traductions fr/en
    - Tests Playwright du flux complet

---

## 7. Risques et Mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Coût OpenAI augmenté (multiple appels) | Moyen | gpt-4o-mini pour les batches, cache par offre séquentielle |
| Temps de génération plus long par offre | Moyen | Paralléliser exp/proj/extras, afficher progression temps réel |
| Incohérence entre sections | **Faible** | Flux de dépendances garantit la cohérence (skills dépend de exp/proj, summary dépend de tout) |
| Échec partiel (1 offre sur N) | Faible | Continuer les autres, afficher statut individuel, remboursement partiel possible |

---

## 8. Métriques de Succès

1. **Qualité**: Réduction de 80% des hallucinations (mesuré par feedback utilisateur)
2. **Performance**: Premier CV disponible < 45s, total pour 3 offres < 2min
3. **Fiabilité**: Taux de succès > 95%
4. **Coût**: Augmentation < 50% du coût OpenAI par CV généré

---

## 9. Récapitulatif des Décisions Architecturales

### 9.1 Séquentiel par offre, CV disponible immédiatement
- Les offres sont traitées séquentiellement (optimisation cache OpenAI)
- MAIS dès qu'une offre est terminée, le CV est disponible
- L'utilisateur n'attend pas que toutes les offres soient finies

### 9.2 Parallèle pour Experiences + Projects + Extras
- Ces 3 sections ont le même contexte (classification + offre)
- Pas de dépendance entre elles → parallélisation maximale

### 9.3 Séquentiel pour Skills → Summary
- **Skills** : dépend des exp + proj adaptés pour déduire les compétences pertinentes
- **Summary** : dépend de skills + exp + extras pour synthétiser l'ensemble du CV

### 9.4 Pas d'appel IA pour la recomposition
- Simple assemblage des résultats
- `header.current_title` = copie directe du titre de l'offre
- Pas de "polish final" nécessaire car chaque section est déjà adaptée

---

## 10. Ajouts PRD - Gaps Identifiés

### 10.1 Adaptation du Format des Langues (FR8-FR9)

**Règle** :
- Si une langue est mentionnée dans l'offre d'emploi → adapter le FORMAT au style de l'offre (ex: "B2" vs "professionnel")
- Si une langue N'EST PAS mentionnée dans l'offre → la GARDER telle quelle (valeur ajoutée potentielle)
- Ne JAMAIS inventer un niveau de langue

**Implémentation dans `phases/recompose.js`** :

```javascript
/**
 * Adapter le format des langues en fonction de l'offre
 *
 * @param {Array} sourceLanguages - Langues du CV source
 * @param {Object} jobOffer - Offre d'emploi avec requirements
 * @returns {Array} Langues avec format adapté si mentionnées dans l'offre
 */
function adaptLanguagesFormat(sourceLanguages, jobOffer) {
  const offerText = `${jobOffer.description} ${jobOffer.requirements || ''}`.toLowerCase();

  return sourceLanguages.map(lang => {
    const langName = lang.name.toLowerCase();

    // Vérifier si la langue est mentionnée dans l'offre
    const isMentionedInOffer = offerText.includes(langName) ||
                                offerText.includes(getEnglishName(langName));

    if (isMentionedInOffer) {
      // Adapter le format au style de l'offre
      return {
        ...lang,
        level: adaptLevelFormat(lang.level, offerText)
      };
    }

    // Langue non mentionnée → garder telle quelle
    return lang;
  });
}

/**
 * Adapter le format du niveau au style de l'offre
 * Ex: Si l'offre dit "anglais courant", convertir "C1" en "Courant"
 */
function adaptLevelFormat(level, offerText) {
  // Détecter le style utilisé dans l'offre
  const usesLetterFormat = /[abc][12]/i.test(offerText);
  const usesWordFormat = /(courant|fluent|professionnel|native|maternel)/i.test(offerText);

  if (usesLetterFormat) {
    return convertToLetterFormat(level); // "Courant" → "C1"
  } else if (usesWordFormat) {
    return convertToWordFormat(level);   // "C1" → "Courant"
  }

  // Pas de format détecté → garder l'original
  return level;
}
```

**Modification dans `runRecomposePhase`** :

```diff
const finalCv = {
  ...sourceCv,
  header: { ...sourceCv.header, current_title: jobOffer.title },
  summary: batchResults.summary,
  experience: batchResults.experiences,
  projects: batchResults.projects,
  skills: batchResults.skills,
  extras: batchResults.extras,
+ languages: adaptLanguagesFormat(sourceCv.languages, jobOffer),
};
```

### 10.2 Concurrence par Type de Tâche (FR16-FR17)

**Nouvelle logique** :
- Max 3 **types** de tâches différentes en parallèle par utilisateur
- Une génération multi-offres (10 offres) = 1 slot `cv_generation`
- Permet à l'utilisateur d'importer un CV pendant qu'une génération est en cours

**Modification `lib/backgroundTasks/jobQueue.js`** :

```javascript
/**
 * Job Queue avec concurrence par TYPE de tâche
 *
 * Au lieu de compter les tâches individuelles, on compte les TYPES de tâches.
 * Une génération de 10 CVs = 1 slot "cv_generation"
 */

const MAX_CONCURRENT_TASK_TYPES = 3;

// Tracking des types de tâches en cours par utilisateur
const activeTaskTypes = new Map(); // userId -> Set<taskType>

/**
 * Vérifier si un nouveau type de tâche peut être lancé
 */
export function canStartTaskType(userId, taskType) {
  const userTypes = activeTaskTypes.get(userId) || new Set();

  // Si ce type est déjà en cours, refuser
  if (userTypes.has(taskType)) {
    return { allowed: false, reason: 'task_type_already_running' };
  }

  // Si on a déjà 3 types différents, refuser
  if (userTypes.size >= MAX_CONCURRENT_TASK_TYPES) {
    return { allowed: false, reason: 'max_concurrent_types_reached' };
  }

  return { allowed: true };
}

/**
 * Enregistrer le début d'un type de tâche
 */
export function registerTaskTypeStart(userId, taskType) {
  if (!activeTaskTypes.has(userId)) {
    activeTaskTypes.set(userId, new Set());
  }
  activeTaskTypes.get(userId).add(taskType);
}

/**
 * Enregistrer la fin d'un type de tâche
 */
export function registerTaskTypeEnd(userId, taskType) {
  const userTypes = activeTaskTypes.get(userId);
  if (userTypes) {
    userTypes.delete(taskType);
    if (userTypes.size === 0) {
      activeTaskTypes.delete(userId);
    }
  }
}

/**
 * Enqueue un job avec gestion de concurrence par type
 */
export async function enqueueJobWithType(userId, taskType, jobFn) {
  const check = canStartTaskType(userId, taskType);
  if (!check.allowed) {
    throw new Error(check.reason);
  }

  registerTaskTypeStart(userId, taskType);

  try {
    await jobFn();
  } finally {
    registerTaskTypeEnd(userId, taskType);
  }
}
```

**Modification Route API** :

```diff
// app/api/cv/generate-v2/route.js

+ import { canStartTaskType, enqueueJobWithType } from '@/lib/backgroundTasks/jobQueue';

export async function POST(request) {
  // ... validation ...

+ // Vérifier la concurrence par type
+ const concurrencyCheck = canStartTaskType(userId, 'cv_generation');
+ if (!concurrencyCheck.allowed) {
+   return apiError({
+     error: concurrencyCheck.reason === 'task_type_already_running'
+       ? 'cv_generation_already_running'
+       : 'max_concurrent_tasks_reached',
+     status: 429
+   });
+ }

  // ... créer la tâche ...

- enqueueJob(() => startCvGenerationV2(task.id));
+ enqueueJobWithType(userId, 'cv_generation', () => startCvGenerationV2(task.id));

  // ... response ...
}
```

**Types de tâches reconnus** :

| taskType | Opérations couvertes |
|----------|---------------------|
| `cv_generation` | Génération CV v2 (multi-offres = 1 slot) |
| `pdf_import` | Import de CV PDF |
| `cv_translation` | Traduction de CV |
| `cv_optimization` | Optimisation/amélioration CV |
| `match_score` | Calcul du score de match |

### 10.3 Logique Retry + Remboursement (NFR11-NFR12)

**Règle** :
- En cas d'échec, retry automatiquement jusqu'à 3 fois
- Après 3 échecs, annuler et rembourser les crédits pour cette offre
- Notifier l'utilisateur de l'échec + remboursement

**Modification `lib/cv-pipeline-v2/orchestrator.js`** :

```javascript
const MAX_RETRIES = 3;

/**
 * Traiter une offre avec retry automatique
 */
async function processOfferWithRetry(task, offer) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Mettre à jour le compteur de retry
      await prisma.cvGenerationSubtask.updateMany({
        where: { offerId: offer.id },
        data: { retryCount: attempt - 1 }
      });

      // Phase 0.5: Classification
      await runClassificationPhase(task, offer);

      // Phase 1: Batches
      await runBatchPhase(task, offer);

      // Phase 2: Recomposition
      await runRecomposePhase(task, offer);

      // Succès !
      return { success: true };

    } catch (error) {
      lastError = error;
      console.error(`[Pipeline v2] Offer ${offer.id} attempt ${attempt}/${MAX_RETRIES} failed:`, error);

      if (attempt < MAX_RETRIES) {
        // Attendre avant de réessayer (backoff exponentiel)
        await sleep(1000 * Math.pow(2, attempt - 1));
      }
    }
  }

  // Tous les retries ont échoué → rembourser + notifier
  await handleOfferFailure(task, offer, lastError);
  return { success: false, error: lastError };
}

/**
 * Gérer l'échec définitif d'une offre
 */
async function handleOfferFailure(task, offer, error) {
  // 1. Marquer l'offre comme échouée
  await prisma.cvGenerationOffer.update({
    where: { id: offer.id },
    data: {
      status: 'failed',
      error: error.message
    }
  });

  // 2. Rembourser le crédit pour cette offre (1 crédit par offre)
  await refundCreditForOffer(task, offer);

  // 3. Notifier l'utilisateur
  sseManager.broadcast(task.userId, 'cv_generation_v2:offer_failed', {
    taskId: task.id,
    offerId: offer.id,
    offerIndex: offer.offerIndex,
    error: error.message,
    creditsRefunded: 1
  });
}

/**
 * Rembourser le crédit pour une offre échouée
 */
async function refundCreditForOffer(task, offer) {
  const transaction = await prisma.creditTransaction.findUnique({
    where: { id: task.creditTransactionId }
  });

  if (transaction) {
    // Créer une transaction de remboursement
    await prisma.creditTransaction.create({
      data: {
        userId: task.userId,
        amount: 1, // 1 crédit par offre
        type: 'refund',
        reason: 'cv_generation_failed',
        metadata: JSON.stringify({
          taskId: task.id,
          offerId: offer.id,
          originalTransactionId: transaction.id
        })
      }
    });

    // Mettre à jour le solde
    await prisma.creditBalance.update({
      where: { userId: task.userId },
      data: { balance: { increment: 1 } }
    });
  }
}

/**
 * Orchestrateur principal avec retry
 */
export async function startCvGenerationV2(taskId) {
  const task = await prisma.cvGenerationTask.findUnique({
    where: { id: taskId },
    include: { offers: true }
  });

  await prisma.cvGenerationTask.update({
    where: { id: taskId },
    data: { status: 'running' }
  });

  let successCount = 0;
  let failCount = 0;

  for (const offer of task.offers) {
    const result = await processOfferWithRetry(task, offer);

    if (result.success) {
      successCount++;
      await prisma.cvGenerationTask.update({
        where: { id: taskId },
        data: { completedOffers: { increment: 1 } }
      });
    } else {
      failCount++;
    }
  }

  // Finaliser la tâche
  await prisma.cvGenerationTask.update({
    where: { id: taskId },
    data: {
      status: failCount === task.offers.length ? 'failed' : 'completed',
      completedAt: new Date()
    }
  });

  // Notification finale
  sseManager.broadcast(task.userId, 'cv_generation_v2:completed', {
    taskId: task.id,
    totalGenerated: successCount,
    totalFailed: failCount,
    creditsRefunded: failCount
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

**Nouvel événement SSE** :

```javascript
{
  event: 'cv_generation_v2:offer_failed',
  data: {
    taskId,
    offerId,
    offerIndex,
    error,
    creditsRefunded: 1
  }
}
```

**Traductions à ajouter** :

```json
// locales/fr.json
{
  "taskQueue": {
    "messages": {
      "offerFailed": "Échec pour l'offre {index} - {credits} crédit remboursé",
      "pipelinePartialSuccess": "{success} CV générés, {failed} échecs (crédits remboursés)"
    }
  }
}
```
