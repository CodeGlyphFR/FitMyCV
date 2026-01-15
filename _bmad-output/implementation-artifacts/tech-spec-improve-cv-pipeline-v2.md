---
title: 'Pipeline Amélioration CV v2'
slug: 'improve-cv-pipeline-v2'
created: '2026-01-13'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - Next.js 14
  - React 18
  - Prisma 6
  - OpenAI GPT-4o
  - SSE (Server-Sent Events)
files_to_modify:
  - lib/openai/improveCv.js
  - lib/backgroundTasks/improveCvJob.js
  - lib/openai/classifySkills.js
  - lib/openai/prompts/improve-cv/system.md
  - lib/openai/prompts/improve-cv/user.md
  - app/api/cv/improve/route.js
  - lib/admin/settingsConfig.js
  - lib/cv/changeTracking.js
  - components/admin/OpenAICostsTab.jsx
  - hooks/useTaskProgress.js
  - lib/backgroundTasks/taskFeatureMapping.js
  - lib/settings/aiModels.js
files_to_create:
  - lib/openai/improveExperience.js
  - lib/openai/improveProject.js
  - lib/openai/improveSummary.js
  - lib/openai/preprocessSuggestions.js
  - lib/openai/prompts/improve-cv-v2/experience-system.md
  - lib/openai/prompts/improve-cv-v2/experience-user.md
  - lib/openai/prompts/improve-cv-v2/project-system.md
  - lib/openai/prompts/improve-cv-v2/project-user.md
  - lib/openai/prompts/improve-cv-v2/summary-system.md
  - lib/openai/prompts/improve-cv-v2/summary-user.md
  - app/api/analytics/cv-improvement-costs/route.js
  - __tests__/lib/cv/changeTracking.test.js
code_patterns:
  - AI_MODELS_STRUCTURE hierarchical settings
  - 4-phase progress easing
  - cv-generation-costs API pattern
  - Promise.all for parallelization
  - applyPartialRollback for review
test_patterns: []
---

# Tech-Spec: Pipeline Amélioration CV v2

**Created:** 2026-01-13

## Overview

### Problem Statement

Le pipeline actuel d'amélioration CV souffre de plusieurs limitations critiques :

1. **Contexte mal interprété** : L'IA ne détecte pas correctement le lien entre suggestion, contexte utilisateur et offre d'emploi
2. **Règles de rédaction ignorées** : Deliverables trop longs (>25 chars), responsabilités > 5, pas de présélection intelligente
3. **Fonctionnalités manquantes** : Pas de création/MAJ de projets, résumé jamais mis à jour
4. **Bug critique** : Refuser une modification l'applique quand même (pas de restauration)
5. **Performance** : Pas de parallélisation, pas de contrôle des coûts IA
6. **Monitoring absent** : Pas de suivi dans le Task Manager, pas de tracking des coûts OpenAI

### Solution

Refactoriser le pipeline d'amélioration CV en 4 stages parallélisés :

- **Stage 1 // Stage 2** : Classification skills + Pré-traitement suggestions (en parallèle)
- **Stage 3** : Amélioration parallèle par expérience/projet individuel
- **Stage 4** : Fusion, validation des contraintes, application au CV

Réutiliser les règles de rédaction éprouvées du pipeline de génération V2, ajouter des settings par batch pour le choix du modèle IA, et implémenter le même niveau de monitoring que la génération V2.

### Scope

**In Scope:**

| Catégorie | Éléments |
|-----------|----------|
| **Pipeline Backend** | 4 stages parallélisés, règles génération V2, création/MAJ projets, résumé CV |
| **Settings Admin** | Nouvelle carte "Pipeline Amélioration CV v2 Models" pour config modèles par phase |
| **Task Manager UI** | Affichage progression par phase dans le gestionnaire de tâches (mobile + desktop) |
| **OpenAI Cost Admin** | Affichage des coûts d'optimisation dans l'onglet OpenAI Cost |
| **Bug Fix** | Correction review : refus = restauration du contenu original |

**Out of Scope:**

- Modification de l'UX du modal d'amélioration (on garde l'existant)
- Changements au système de scoring/suggestions
- Nouveaux composants UI hors admin

## Context for Development

### Codebase Patterns

**Settings Admin Pattern:**
- Config dans `lib/admin/settingsConfig.js` → `AI_MODELS_STRUCTURE`
- Ajouter settings au groupe → UI auto-générée dans `SettingsTab.jsx`
- Groupe existant "Pipeline CV v2" avec 6 modèles

**Task Progress Pattern:**
- 4 phases avec easing dans `hooks/useTaskProgress.js`
- Progress cap à 99% jusqu'à `status === 'completed'`
- SSE via `hooks/usePipelineProgress.js`
- Composant spécialisé `PipelineTaskProgress.jsx`

**OpenAI Cost Pattern:**
- CV costs séparés via `/api/analytics/cv-generation-costs`
- Source de vérité = `cvGenerationTotals`, pas `OpenAIUsage`
- Feature grouping dans `groupedChartData` memo

**Parallelization Pattern:**
- `Promise.all()` pour batches indépendants
- Gestion erreurs partielles (succès si certains échouent)
- Rate limiting OpenAI avec retry

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `lib/openai/improveCv.js` | Pipeline amélioration actuel à refactoriser |
| `lib/backgroundTasks/improveCvJob.js` | Background job amélioration |
| `lib/openai/classifySkills.js` | Classification des skills (Stage 1) |
| `lib/openai/prompts/improve-cv/` | Prompts actuels à refactoriser |
| `lib/openai/generateCv.js` | Pipeline génération V2 - référence pour patterns |
| `lib/openai/prompts/generate-cv/` | Prompts génération - règles à réutiliser |
| `app/api/cv/improve/route.js` | API route amélioration |
| `lib/admin/settingsConfig.js` | Config settings admin (AI_MODELS_STRUCTURE) |
| `lib/cv/changeTracking.js` | Change tracking pour review |
| `hooks/useTaskProgress.js` | Progress calculation (4 phases) |
| `components/admin/OpenAICostsTab.jsx` | Affichage coûts OpenAI |
| `components/ui/PipelineTaskProgress.jsx` | UI progress pipeline |

### Technical Decisions

1. **Réutiliser les prompts génération V2** pour les règles de rédaction (responsibilities, deliverables)
2. **Créer nouveau groupe settings** "Pipeline Amélioration CV v2" dans `AI_MODELS_STRUCTURE`
3. **Suivre pattern cv-generation-costs** pour tracking coûts amélioration
4. **Paralléliser Stage 1 // Stage 2** avec `Promise.all()`
5. **Paralléliser par expérience/projet** au Stage 3

## Implementation Plan

### Tasks

#### Epic 1 : Pipeline Backend (Core)

- [ ] **Task 1.1** : Créer fonction `improveExperience()`
  - File: `lib/openai/improveExperience.js` (nouveau)
  - Action: Créer fonction qui améliore UNE expérience avec suggestion + userContext + jobOffer
  - Input: `{ experience, suggestion, jobOffer, cvLanguage }`
    - `suggestion` est un objet contenant :
      ```javascript
      {
        priority: "high" | "medium" | "low",
        impact: "High" | "Medium" | "Low",
        suggestion: "texte de la suggestion",
        title: "titre optionnel",
        userContext: "contexte libre fourni par l'utilisateur (string)"  // ← F3 FIX
      }
      ```
    - `userContext` est le champ STRING dans l'objet suggestion (pas un objet séparé)
  - Output: `{ modifications: { responsibilities, deliverables, skills_used, description }, reasoning }`
  - Notes: Réutiliser règles de `prompts/generate-cv/` (5 resp max, 25 chars deliverables, présélection intelligente)

- [ ] **Task 1.2** : Créer fonction `improveProject()`
  - File: `lib/openai/improveProject.js` (nouveau)
  - Action: Créer fonction qui améliore OU crée UN projet avec suggestion + jobOffer
  - Input: `{ project (ou null si création), suggestion, jobOffer, cvLanguage }`
    - `suggestion.userContext` contient le contexte utilisateur (même structure que Task 1.1)
  - Output: `{ modifications: { summary, tech_stack, role }, isNew: boolean, reasoning }`

- [ ] **Task 1.3** : Créer fonction `preprocessSuggestions()`
  - File: `lib/openai/preprocessSuggestions.js` (nouveau)
  - Action: Analyser les suggestions cochées et identifier les cibles (expérience/projet)
  - Input: `{ suggestions, experiences, projects, jobOffer }`
  - Output: `{ experienceImprovements: [{index, improvements}], projectImprovements: [{index, improvements}], newProjects: [{context, suggestion}] }`
  - Notes: Matching textuel intelligent (par company, dates, title) - PAS d'appel IA
  - **Détection création projet (F17 FIX)** :
    ```javascript
    // Détecter si une suggestion concerne un nouveau projet personnel
    const isNewProjectSuggestion = (suggestion) => {
      const text = (suggestion.suggestion + ' ' + (suggestion.userContext || '')).toLowerCase();
      const projectKeywords = ['projet personnel', 'side project', 'temps libre', 'hobby', 'open source', 'contribution'];
      return projectKeywords.some(kw => text.includes(kw)) && !matchesExistingProject(suggestion, projects);
    };
    ```
  - Si `isNewProjectSuggestion` = true → ajouter à `newProjects[]`
  - **Suggestions non-matchées (F21 FIX)** : Si une suggestion ne matche aucune expérience/projet ET n'est pas un nouveau projet → logger warning et ignorer (ne pas bloquer le pipeline)

- [ ] **Task 1.4** : Créer fonction `improveSummary()`
  - File: `lib/openai/improveSummary.js` (nouveau)
  - Action: Mettre à jour le résumé CV après les améliorations
  - Input: `{ summary, improvedExperiences, improvedProjects, jobOffer, cvLanguage }`
  - Output: `{ description, domains, key_strengths }`

- [ ] **Task 1.5** : Refactoriser `improveCvJob.js` pour 4 stages
  - File: `lib/backgroundTasks/improveCvJob.js`
  - Action: Restructurer en 4 stages avec parallélisation
  - Stage 1: `classifySkills()` (existant)
  - Stage 2: `preprocessSuggestions()` (nouveau) - **en parallèle avec Stage 1**
  - Stage 3: `Promise.all([...improveExperience(), ...improveProject()])` - **parallèle par item**
  - Stage 4: `improveSummary()` + fusion + validation + application
  - **Timeout (F8 FIX)**: Configurer timeout 60s par appel OpenAI via AbortController
    ```javascript
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const result = await openai.chat.completions.create({...}, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
    ```
  - **Logging (F9 FIX)**: Ajouter logs structurés pour chaque stage
    ```javascript
    console.log(`[improveCv] Stage ${stage} started`, { taskId, itemCount });
    console.log(`[improveCv] Stage ${stage} completed`, { taskId, duration, successCount, failureCount });
    ```
  - **Métriques (F10 FIX)**: Mesurer et stocker temps d'exécution par stage dans BackgroundTask.metadata
  - Notes (F2 FIX): Utiliser `Promise.all()` avec try/catch par item (pattern existant dans le codebase)
    ```javascript
    // Pattern à suivre (comme dans improveCvJob.js existant)
    const results = await Promise.all(
      improvements.map(async (item) => {
        try {
          return { success: true, data: await improveExperience(item) };
        } catch (error) {
          console.error(`[improveCv] Error improving exp ${item.index}:`, error);
          return { success: false, error, index: item.index };
        }
      })
    );
    // Filtrer les succès et logger les échecs
    const successes = results.filter(r => r.success);
    const failures = results.filter(r => !r.success);
    ```

- [ ] **Task 1.6** : Créer prompts dédiés amélioration
  - Files:
    - `lib/openai/prompts/improve-cv-v2/experience-system.md` (nouveau)
    - `lib/openai/prompts/improve-cv-v2/experience-user.md` (nouveau)
    - `lib/openai/prompts/improve-cv-v2/project-system.md` (nouveau)
    - `lib/openai/prompts/improve-cv-v2/project-user.md` (nouveau)
    - `lib/openai/prompts/improve-cv-v2/summary-system.md` (nouveau)
    - `lib/openai/prompts/improve-cv-v2/summary-user.md` (nouveau)
  - Action: Créer prompts spécialisés qui intègrent les règles de génération V2
  - Notes: Inclure règles: 5 resp max, 25 chars deliverables, présélection, anti-hallucination

- [ ] **Task 1.7** : Ajouter fonctions de récupération des modèles IA
  - File: `lib/settings/aiModels.js`
  - Action: Ajouter fonctions `getImproveExperienceModel()`, `getImproveProjectModel()`, `getImproveSummaryModel()`
  - Pattern: Même pattern que `getCvGenerationModel()`

- [ ] **Task 1.8** : Implémenter le rate limiting pour Stage 3 (F5 FIX)
  - File: `lib/backgroundTasks/improveCvJob.js`
  - Action: Limiter à 5 appels IA concurrents maximum au Stage 3
  - **Dépendance (F18 FIX)** : `npm install p-limit` (package léger, 0 dépendances)
  - Implementation:
    ```javascript
    import pLimit from 'p-limit';
    const limit = pLimit(5); // Max 5 concurrent

    const results = await Promise.all(
      improvements.map(item => limit(async () => {
        try {
          return { success: true, data: await improveExperience(item) };
        } catch (error) {
          return { success: false, error, index: item.index };
        }
      }))
    );
    ```
  - Notes: Évite les rate limits OpenAI sur les CVs avec beaucoup d'expériences (>5)

- [ ] **Task 1.9** : Gérer la rétrocompatibilité (F1 FIX)
  - File: `lib/backgroundTasks/improveCvJob.js`
  - Action: Assurer que le nouveau pipeline gère les tâches créées avec l'ancien format
  - Strategy:
    1. **Tâches en cours (`status: 'running'`)** : Laisser terminer avec l'ancien code (pas de migration mid-execution)
    2. **Tâches en queue (`status: 'queued'`)** : Le nouveau job détecte le format du payload et route vers l'ancien ou nouveau pipeline
    3. **Détection du format** :
       ```javascript
       // Dans improveCvJob.js
       const isV2Payload = payload.pipelineVersion === 2 || payload.stages !== undefined;
       if (!isV2Payload) {
         // Fallback: exécuter avec l'ancien pipeline (fonction legacy)
         return await runLegacyImproveCv(payload);
       }
       // Sinon: nouveau pipeline 4 stages
       ```
    4. **API route** : Ajouter `pipelineVersion: 2` au payload pour les nouvelles requêtes
  - Notes: Après migration complète (toutes les anciennes tâches terminées), supprimer le code legacy

#### Epic 2 : Settings Admin

- [ ] **Task 2.1** : Ajouter groupe settings "Pipeline Amélioration CV v2" (F4 FIX)
  - File: `lib/admin/settingsConfig.js`
  - Action: **Renommer** le groupe existant "Optimisation" en "Pipeline Amélioration CV v2" (ou ajouter à côté si "Optimisation" contient d'autres settings)
  - Vérifier d'abord le contenu actuel de `AI_MODELS_STRUCTURE` :
    - Si "Optimisation" ne contient que `model_optimize_cv` → Renommer en "Pipeline Amélioration CV v2" et ajouter les nouveaux
    - Si "Optimisation" contient d'autres settings → Créer un nouveau groupe séparé
  - Settings à ajouter/modifier :
    ```javascript
    'Pipeline Amélioration CV v2': [
      'model_optimize_cv',           // Existant - garder pour rétrocompat
      'model_improve_experience',    // Nouveau
      'model_improve_project',       // Nouveau
      'model_improve_summary',       // Nouveau
      'model_improve_classify_skills', // Nouveau (remplace ou alias de model_optimize_cv pour skills)
    ]
    ```
  - Action: Ajouter labels dans `SETTING_LABELS` pour les 4 nouveaux settings

- [ ] **Task 2.2** : Créer entrées settings en BDD (seed ou migration)
  - File: `prisma/seed.js` ou script manuel
  - Action: Créer les 4 settings avec valeurs par défaut
  - **Valeurs par défaut (F22 FIX)** :
    - `model_improve_experience`: `gpt-4o-mini` (appels fréquents, besoin de rapidité)
    - `model_improve_project`: `gpt-4o-mini`
    - `model_improve_summary`: `gpt-4o-mini`
    - `model_improve_classify_skills`: `gpt-4o-mini`

#### Epic 3 : Task Manager UI

- [ ] **Task 3.1** : Adapter progression pour `cv_improvement` (F6 FIX)
  - Files:
    - `lib/backgroundTasks/taskFeatureMapping.js` (configuration principale)
    - `hooks/useTaskProgress.js` (si customisation spécifique nécessaire)
  - Action: Ajouter mapping pour `cv_improvement` dans `taskFeatureMapping.js`
  - Progression en **temps réel via SSE** (comme génération V2), pas de durée estimée
  - Configuration à ajouter dans `taskFeatureMapping.js` :
    ```javascript
    cv_improvement: {
      // Pas d'estimatedDuration - progression temps réel via SSE
      phases: [
        { name: 'Classification + Preprocessing', weight: 0.2 },
        { name: 'Amélioration expériences', weight: 0.4 },
        { name: 'Amélioration projets', weight: 0.2 },
        { name: 'Summary + Fusion', weight: 0.2 },
      ]
    }
    ```
  - Notes: Les weights servent uniquement à calculer le % de progression quand une phase est complétée

- [ ] **Task 3.2** : Adapter affichage dans TaskQueueModal
  - File: `components/TaskQueueModal.jsx`
  - Action: Ajouter condition pour `cv_improvement` similaire à `cv_generation_v2`
  - Notes: Réutiliser `PipelineTaskProgress` ou créer variante

- [ ] **Task 3.3** : Ajouter SSE pour progression temps réel
  - File: `app/api/cv/improve/route.js` ou nouveau endpoint SSE
  - Action: Émettre événements SSE par phase/étape
  - Pattern: Même pattern que génération V2
  - Événements à émettre :
    ```javascript
    // Début de stage
    { type: 'stage_start', stage: 1, name: 'Classification + Preprocessing' }
    // Progression dans un stage (optionnel, pour items individuels)
    { type: 'stage_progress', stage: 3, current: 2, total: 5, item: 'experience' }
    // Fin de stage
    { type: 'stage_complete', stage: 1, duration: 1234 }
    // Erreur (non bloquante)
    { type: 'stage_error', stage: 3, item: 'experience_2', error: 'Timeout' }
    // Fin pipeline
    { type: 'complete', success: true, stats: { improved: 4, failed: 1 } }
    ```

#### Epic 4 : OpenAI Cost Admin

- [ ] **Task 4.1** : Créer API `/api/analytics/cv-improvement-costs`
  - File: `app/api/analytics/cv-improvement-costs/route.js` (nouveau)
  - Action: Créer endpoint qui retourne les coûts d'amélioration
  - Pattern: Copier pattern de `cv-generation-costs`
  - Output: `{ improvements: [...], totals: { totalCost, count, ... } }`

- [ ] **Task 4.2** : Intégrer dans OpenAICostsTab
  - File: `components/admin/OpenAICostsTab.jsx`
  - Action: Fetcher les coûts d'amélioration et les afficher
  - Notes: Ajouter nouveau groupe "Amélioration de CV" dans `groupedChartData`

- [ ] **Task 4.3** : Tracker les appels IA amélioration
  - File: `lib/openai/improveExperience.js`, `improveProject.js`, `improveSummary.js`
  - Action: Appeler `trackOpenAIUsage()` après chaque appel OpenAI
  - Feature names à utiliser :
    - `cv_improvement_v2_experience` - pour `improveExperience()`
    - `cv_improvement_v2_project` - pour `improveProject()`
    - `cv_improvement_v2_summary` - pour `improveSummary()`
    - `cv_improvement_v2_classify_skills` - pour `classifySkills()` (si pas déjà tracké)

#### Epic 5 : Bug Fix Review

- [ ] **Task 5.1** : Corriger `applyPartialRollback()` pour champs (F7 FIX - détaillé)
  - File: `lib/cv/changeTracking.js`
  - Fonction: `applyPartialRollback()` (lignes ~1123-1293)
  - Bug Reproduction:
    1. Lancer une amélioration CV qui modifie les responsibilities d'une expérience
    2. Aller dans la review des modifications
    3. Cliquer sur une modification de responsibilities pour voir le before/after
    4. Cliquer "Refuser"
    5. **Bug observé** : Le contenu "after" (modifié) reste au lieu du contenu "before" (original)
  - Analyse du code existant:
    - La fonction gère déjà `changeType: 'modified'` (lignes ~1177-1194)
    - Elle distingue `isItemLevelChange` vs `isArrayFieldChange`
    - **Hypothèse** : Pour les champs array comme `responsibilities`, le code ne restaure pas correctement `beforeValue`
  - Fix potentiel:
    ```javascript
    // Dans applyPartialRollback(), pour changeType === 'modified' sur un champ array
    if (change.changeType === 'modified' && Array.isArray(change.beforeValue)) {
      // Restaurer le tableau complet depuis beforeValue
      setValueAtPath(updatedCv, change.path, [...change.beforeValue]);
    }
    ```
  - Investigation nécessaire: Lire le code actuel et tracer le flow exact pour identifier le bug précis

- [ ] **Task 5.2** : Ajouter tests unitaires pour review
  - File: `__tests__/lib/cv/changeTracking.test.js` (nouveau ou existant)
  - Action: Ajouter tests pour accept/reject sur différents types de changes
  - Cases: added item, removed item, modified field, modified responsibilities array

### Acceptance Criteria

#### Pipeline Backend

- [ ] **AC1.1** : Given des suggestions cochées avec userContext, when le pipeline s'exécute, then chaque expérience ciblée est améliorée individuellement en parallèle
- [ ] **AC1.2** : Given une suggestion mentionnant un projet personnel, when le pipeline détecte "projet personnel" ou "temps libre", then un nouveau projet est créé
- [ ] **AC1.3** : Given une expérience avec 5 responsabilités, when une nouvelle responsabilité doit être ajoutée, then la moins pertinente est supprimée avant ajout
- [ ] **AC1.4** : Given un deliverable à ajouter, when le texte dépasse 25 caractères, then il est reformulé pour respecter la limite
- [ ] **AC1.5** : Given Stage 1 et Stage 2, when le pipeline démarre, then ils s'exécutent en parallèle (non séquentiellement)
- [ ] **AC1.6** : Given 3 expériences à améliorer, when Stage 3 s'exécute, then les 3 appels IA sont parallélisés
- [ ] **AC1.7** : Given une tâche créée avec l'ancien format (sans pipelineVersion), when le job s'exécute, then elle est traitée par le pipeline legacy (rétrocompatibilité)

#### Settings Admin

- [ ] **AC2.1** : Given l'admin connecté, when il accède à Settings > AI Models, then il voit le groupe "Pipeline Amélioration CV v2" avec 4 modèles configurables
- [ ] **AC2.2** : Given un setting modifié, when l'admin sauvegarde, then le nouveau modèle est utilisé pour les prochaines améliorations

#### Task Manager UI

- [ ] **AC3.1** : Given une amélioration en cours, when l'utilisateur ouvre le Task Manager, then il voit la progression par phase (comme génération V2)
- [ ] **AC3.2** : Given une amélioration en cours sur mobile, when l'utilisateur consulte les tâches, then l'affichage est responsive et lisible

#### OpenAI Cost Admin

- [ ] **AC4.1** : Given des améliorations effectuées, when l'admin consulte OpenAI Costs, then il voit les coûts groupés sous "Amélioration de CV"
- [ ] **AC4.2** : Given les coûts affichés, when l'admin compare avec la génération, then les deux sont visibles séparément

#### Bug Fix Review

- [ ] **AC5.1** : Given une modification de responsibilities affichée, when l'utilisateur clique "Refuser", then le contenu original (before) est restauré
- [ ] **AC5.2** : Given une modification de description, when l'utilisateur clique "Refuser", then la description originale est restaurée
- [ ] **AC5.3** : Given une modification de deliverables, when l'utilisateur clique "Refuser", then les deliverables originaux sont restaurés

## Additional Context

### Dependencies

- Pipeline génération V2 fonctionnel (référence pour patterns et prompts)
- Système de settings existant (`lib/admin/settingsConfig.js`)
- Change tracking existant (`lib/cv/changeTracking.js`)
- SSE infrastructure existante
- OpenAI pricing/tracking existant

### Testing Strategy

**Tests Unitaires :**
- `applyPartialRollback()` - tous les types de changes (added, removed, modified field)
- `preprocessSuggestions()` - matching expérience/projet
- Fonctions de récupération settings

**Tests d'Intégration :**
- Pipeline complet avec suggestions mock
- Parallélisation (vérifier que les appels sont simultanés)
- Gestion erreurs partielles

**Tests Manuels :**
- Review UI : accept/reject sur différents types de modifications
- Task Manager : progression affichée correctement
- Admin Settings : modification et persistance des modèles
- Admin OpenAI Costs : affichage correct des coûts amélioration

### Notes

**Architecture 4 Stages :**
```
Stage 1 (classifySkills)     ─┐
                              ├─→ Promise.all() ─→ Stage 3 ─→ Stage 4
Stage 2 (preprocessSuggestions)┘      │
                                       │
                            ┌──────────┴──────────┐
                            │   Promise.all()     │
                            │ improveExp(0)       │
                            │ improveExp(2)       │
                            │ improveProj(1)      │
                            │ createProj(new)     │
                            └─────────────────────┘
```

**Inputs par Stage :**
- Stage 1 : skills manquantes cochées + niveau (PAS besoin du CV)
- Stage 2 : cv.experience, cv.projects, suggestions (userContext est DANS chaque suggestion) (PAS besoin des skills)
- Stage 3 : 1 expérience/projet + suggestion (avec userContext) + jobOffer (PAS tout le CV)
- Stage 4 : outputs des stages précédents + CV complet pour application

**Risques :**
- Rate limiting OpenAI si trop d'appels parallèles → Limiter à 5 concurrent max
- Token overhead si prompts trop longs → Prompts minimalistes par item
- Bug review pourrait avoir d'autres cas edge → Tests exhaustifs nécessaires

**Future Considerations (hors scope) :**
- Cache des prompts pour réduire latence
- Retry intelligent par item en cas d'échec
- Métriques de qualité des améliorations

**Documentation API (F12 FIX) :**
Mettre à jour `docs/api-reference.md` avec :
- `POST /api/cv/improve` - payload v2, réponse SSE
- `GET /api/analytics/cv-improvement-costs` - format réponse
- Description des événements SSE par stage
