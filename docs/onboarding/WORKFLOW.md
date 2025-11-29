# Workflow Onboarding - 8 Steps

> **Guide détaillé du workflow complet des 8 étapes d'onboarding**

Voir [README.md](./README.md) pour l'index complet de la documentation.

---

## Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Step 0 : Welcome Modal](#step-0--welcome-modal)
- [Step 1 : Mode édition](#step-1--mode-édition)
- [Step 2 : Génération IA](#step-2--génération-ia)
- [Step 3 : Task Manager](#step-3--task-manager)
- [Step 4 : CV généré](#step-4--cv-généré)
- [Step 5 : Score match](#step-5--score-match)
- [Step 6 : Optimisation](#step-6--optimisation)
- [Step 7 : Historique](#step-7--historique)
- [Step 8 : Export PDF](#step-8--export-pdf)
- [Completion Modal](#completion-modal)
- [Transitions & Délais](#transitions--délais)
- [Validation Patterns](#validation-patterns)

---

## Vue d'ensemble

L'onboarding guide les utilisateurs à travers **8 étapes interactives** :

| Step | Nom | Type validation | Délai transition |
|------|-----|-----------------|------------------|
| 0 | Welcome Modal | Clic "Compris" | Immédiate → 1 |
| 1 | Mode édition | Sortie mode édition | 1s → 2 |
| 2 | Génération IA | task:added (generation_ia) | Immédiate → 3 |
| 3 | Task Manager | TASK_MANAGER_OPENED | Immédiate → 4 |
| 4 | CV généré | GENERATED_CV_OPENED | 2s → 5 |
| 5 | Score match | task:completed (match_score) | 2s → 6 |
| 6 | Optimisation | task:completed (improvement) | 2s → 7 |
| 7 | Historique | HISTORY_CLOSED | 2s → 8 |
| 8 | Export PDF | EXPORT_CLICKED + confetti | → Completion |

---

## Step 0 : Welcome Modal

**Objectif** : Présenter FitMyCV et préparer l'utilisateur

**Déclenchement** :
- Nouveau compte (cvCount = 0)
- currentStep = 0
- !hasCompleted && !hasSkipped
- 3s après LOADING_SCREEN_CLOSED

**Contenu** : 3 screens
1. Bienvenue sur FitMyCV
2. Fonctionnalités clés
3. Prêt à commencer ?

**Validation** :
- "Compris" → markModalCompleted('welcome') + transitionToStep1()
- X → transitionToStep1() (sans marquer completed)
- "Passer" → skipOnboarding() (abandon complet)

**Transition** : Immédiate → step 1

---

## Step 1 : Mode édition

**Objectif** : Découvrir le mode édition

**Target** : `[data-onboarding="edit-mode-button"]`

**Workflow** :
1. Highlight + tooltip "Cliquez ici pour découvrir..."
2. Clic → Modal 5 screens
3. "Compris" → Mode édition s'active
4. User modifie CV
5. **Validation** : Sortie mode édition (editing: true → false)

**Modal** : 5 screens (Modifier CV, Compétences, Expériences, Formation, Projets)

**Bug fix récent** : Race condition prevEditingRef fixée

**Transition** : 1s → step 2

---

## Step 2 : Génération IA

**Objectif** : Lancer première génération IA

**Target** : `[data-onboarding="ai-generate"]`

**Workflow** :
1. Highlight + tooltip "Adaptez avec l'IA"
2. Clic → Modal 3 screens
3. "Compris" → AIGeneratorPanel s'ouvre (OPEN_GENERATOR event)
4. User lance génération
5. **Validation** : task:added avec type="generation_ia"

**Modal** : 3 screens (Fonctionnement IA, Personnalisation, CV optimisé)

**Transition** : Immédiate → step 3

---

## Step 3 : Task Manager

**Objectif** : Comprendre suivi des tâches

**Target** : `[data-onboarding="task-manager"]`

**Précondition** : Génération en cours

**Workflow** :
1. Tooltip persistent "Suivi génération..."
2. Clic icône Task Manager
3. **Validation** : TASK_MANAGER_OPENED event

**Transition** : Immédiate → step 4 (si CV généré)

---

## Step 4 : CV généré

**Objectif** : Ouvrir le CV généré

**Target (Highlight)** : `[data-onboarding="cv-selector"]` (bouton principal)

**Target (Visual)** : `[data-cv-filename="<filename>"]` (CV dans la liste)

**Précondition** : onboardingState.step4.cvGenerated = true

**Workflow** :
1. CV apparaît dans sélecteur
2. Highlight pulsant sur bouton principal du CV selector (reste fixe même dropdown ouvert)
3. Tooltip "Votre CV est prêt" sur bouton principal
4. Quand dropdown ouvert : CV concerné a fond vert léger (`bg-emerald-500/20`)
5. Clic sur CV → Émet `GENERATED_CV_OPENED` event
6. **Validation** : GENERATED_CV_OPENED event

**Persistance après refresh** :
- `onboardingState.step4.cvFilename` stocke le nom du fichier généré
- Highlight reste visible après refresh (grâce à `data-cv-filename` attribute)
- Cliquer sur le CV émet l'événement même après refresh

**Implémentation** :
- TopBar.jsx détecte `isOnboardingStep4Cv = currentStep === 4 && it.file === onboardingState?.step4?.cvFilename`
- Fond vert appliqué si `isOnboardingStep4Cv` est vrai
- Événement émis pour `isRecentlyGenerated || isOnboardingStep4Cv`

**Transition** : 2s → step 5

---

## Step 5 : Score match

**Objectif** : Calculer compatibilité CV/offre

**Target** : `[data-onboarding="match-score"]`

**Précondition** : Offre emploi associée

**Workflow** :
1. Highlight + tooltip "Calculez compatibilité"
2. Clic → Score IA se lance
3. **Validation** : task:completed avec type="match_score"

**Fallback** : Skip après 30s si précondition non remplie

**Transition** : 2s → step 6

---

## Step 6 : Optimisation

**Objectif** : Optimiser le CV avec l'IA

**Target** : `[data-onboarding="optimize"]`

**Précondition** : Score calculé

**Workflow** :
1. Highlight + tooltip "Optimisez votre CV"
2. Clic → Modal 3 screens
3. "Compris" → OptimizerPanel s'ouvre (OPEN_OPTIMIZER event)
4. User lance optimisation
5. **Validation** : task:completed avec type="improvement"

**Modal** : 3 screens (Fonctionnement, Analyse IA, Historique)

**Transition** : 2s → step 7

---

## Step 7 : Historique

**Objectif** : Consulter modifications IA

**Target** : `[data-onboarding="history"]`

**Précondition** : Optimisation terminée

**Workflow** :
1. Highlight + tooltip "Découvrez modifications"
2. Clic → Modal historique s'ouvre
3. User consulte
4. **Validation** : HISTORY_CLOSED event

**Transition** : 2s → step 8

---

## Step 8 : Export PDF

**Objectif** : Exporter le CV optimisé

**Target** : `[data-onboarding="export"]`

**Workflow** :
1. Highlight + tooltip "Exportez en PDF"
2. Clic → Modal 3 screens
3. "Compris" → ExportModal s'ouvre (OPEN_EXPORT event)
4. User exporte
5. **Validation** : EXPORT_CLICKED event
6. **Confetti** : 3 salves 🎉

**Modal** : 3 screens (Export PDF, Sections, Personnalisation)

**Transition** : 1.5s (après confetti) → CompletionModal

---

## Completion Modal

**Objectif** : Féliciter et présenter fonctionnalités restantes

**Contenu** : 3 screens (Félicitations, Créer CV, Importer PDF)

**Validation** : "Compris" → completeOnboarding()
- hasCompleted = true
- API POST ?action=complete
- Broadcast SSE

---

## Transitions & Délais

**Règles** :
- Steps 2→3→4 : Immédiate (enchaînement logique)
- Steps 1→2, 4→5, 5→6, 6→7, 7→8 : Délai 1-2s (UX)

**Configuration** : Voir [TIMINGS.md](./TIMINGS.md)

---

## Validation Patterns

### Pattern 1 : Modal completion
- User clique "Compris"
- markModalCompleted(key) mais NE valide PAS le step
- Step validé par action utilisateur après

### Pattern 2 : Action trigger
- Événement task:added / task:completed
- Vérifier type de tâche
- markStepComplete(step)

### Pattern 3 : State check
- useEffect surveille changement état
- Détecter transition (ex: editing true → false)
- markStepComplete(step)

### Pattern 4 : Element interaction
- window.addEventListener(CUSTOM_EVENT)
- markStepComplete(step) immédiatement

---

**Voir aussi** :
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture système
- [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) - Structure état
- [TIMINGS.md](./TIMINGS.md) - Délais détaillés
