# Smart CV Editing - Implementation Tasks

## Phase 1: Fusion Génération + Scoring (PRIORITÉ HAUTE)
- [ ] Refactorer `lib/openai/generateCv.js` pour retourner CV + score + suggestions
- [ ] Créer nouveau prompt optimisé (fusion génération + analyse)
- [ ] Adapter `lib/backgroundTasks/generateCvJob.js` pour gérer le nouveau format
- [ ] Mettre à jour la DB pour stocker les suggestions d'amélioration
- [ ] Modifier l'API `/api/background-tasks/generate-cv` pour le nouveau format

## Phase 2: Mode Amélioration Guidée (PRIORITÉ HAUTE)
- [ ] Créer `/api/cv/improve/route.js` pour amélioration ciblée
- [ ] Créer `lib/openai/improveCv.js` avec logique d'amélioration
- [ ] Créer composant `CVImproveAssistant.jsx` pour l'interface
- [ ] Ajouter bouton "🎯 Optimiser" dans TopBar
- [ ] Implémenter job type `improve-cv` dans backgroundTasks

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