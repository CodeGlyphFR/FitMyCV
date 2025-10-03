# Smart CV Editing - Implementation Tasks

## Phase 1: Fusion Génération + Scoring (PRIORITÉ HAUTE) ✅
- [x] Refactorer `lib/openai/generateCv.js` pour retourner CV + score + suggestions
- [x] Créer nouveau prompt optimisé (fusion génération + analyse)
- [x] Adapter `lib/backgroundTasks/generateCvJob.js` pour gérer le nouveau format
- [x] Mettre à jour la DB pour stocker les suggestions d'amélioration
- [x] Modifier l'API `/api/background-tasks/generate-cv` pour le nouveau format

## Phase 2: Mode Amélioration Guidée (PRIORITÉ HAUTE) ✅
- [x] Créer `/api/cv/improve/route.js` pour amélioration ciblée
- [x] Créer `lib/openai/improveCv.js` avec logique d'amélioration
- [x] Créer composant `CVImprovementPanel.jsx` pour l'interface
- [x] Ajouter bouton "🎯 Optimiser" dans Header (pas TopBar)
- [x] Implémenter job type `improve-cv` dans backgroundTasks

## Phase 3: Édition Inline (PRIORITÉ MOYENNE)
- [ ] Créer composant `EditableField.jsx` avec contentEditable
- [ ] Implémenter hook `useAutoSave` avec debounce
- [ ] Ajouter indicateurs de sauvegarde en temps réel
- [ ] Intégrer dans les composants existants (Header, Summary, etc.)

## Phase 4: Régénération Partielle (PRIORITÉ MOYENNE)
- [ ] Ajouter boutons "Régénérer" par section
- [ ] Créer endpoint `/api/cv/regenerate-section`
- [ ] Optimiser les prompts pour régénération ciblée

## Phase 5: Score Dynamique (PRIORITÉ BASSE)
- [ ] Implémenter calcul de score côté client pour changements mineurs
- [ ] Créer composant `ScoreIndicator` avec visualisation
- [ ] Ajouter heatmap des zones de match