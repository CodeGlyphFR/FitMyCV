---
stepsCompleted: [1, 2]
status: in_progress
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - lib/openai/improveCv.js
  - lib/openai/prompts/improve-cv/system.md
  - lib/openai/prompts/improve-cv/user.md
  - lib/backgroundTasks/improveCvJob.js
  - lib/openai/classifySkills.js
  - app/api/cv/improve/route.js
  - data/schema.json
workflowType: 'prd'
lastStep: 2
documentCounts:
  briefs: 0
  research: 0
  brainstorming: 0
  projectDocs: 1
  codebaseAnalysis: 7
projectType: brownfield
---

# Product Requirements Document - Pipeline Amélioration CV

**Author:** Erick
**Date:** 2026-01-13

## Executive Summary

### Vision

Transformer le pipeline d'amélioration CV pour qu'il comprenne véritablement le contexte utilisateur et applique les suggestions de manière intelligente - en réutilisant les règles de rédaction éprouvées du pipeline de génération V2.

### Problème Actuel

Le pipeline d'amélioration CV actuel souffre de plusieurs limitations critiques :
- **Contexte mal interprété** : L'IA ne détecte pas correctement le lien entre suggestion, contexte utilisateur et offre d'emploi
- **Règles de rédaction ignorées** : Deliverables trop longs, responsabilités > 5, pas de présélection intelligente
- **Fonctionnalités manquantes** : Pas de création/MAJ de projets, résumé jamais mis à jour
- **Bug critique** : Refuser une modification l'applique quand même
- **Performance** : Pas de parallélisation, pas de contrôle des coûts IA

### Solution Proposée

Pipeline d'amélioration CV v2 en 4 stages avec parallélisation :
- **Stage 1 // Stage 2** : Classification skills + Pré-traitement suggestions (en parallèle)
- **Stage 3** : Amélioration parallèle par expérience/projet individuel
- **Stage 4** : Fusion, validation des contraintes, application au CV

**Considérations techniques :**
- Gestion des erreurs partielles (succès partiel si une expérience échoue)
- Rate limiting OpenAI avec retry intelligent
- Feedback SSE par batch pour progression temps réel

**Review des modifications :**
- Même UX que le pipeline de génération (change tracking existant)
- Correction du bug : refuser une modification restaure correctement le contenu original

### Ce Qui Rend Ce Refactoring Spécial

L'objectif n'est pas de réinventer les règles de rédaction - elles existent et fonctionnent dans le pipeline génération V2. L'enjeu est de :
1. **Réutiliser ces règles** dans le contexte d'amélioration guidée
2. **Ajouter l'intelligence de présélection** (supprimer pour ajouter si limite atteinte)
3. **Paralléliser** pour optimiser temps et coûts
4. **Permettre le choix du modèle IA** par batch/phase via Settings

## Project Classification

| Attribut | Valeur |
|----------|--------|
| **Type technique** | SaaS B2B Web Application |
| **Domaine** | HR Tech / Génération CV |
| **Complexité** | Medium |
| **Contexte projet** | Brownfield - refactoring pipeline existant |
| **Stack** | Next.js 14, React 18, Prisma 6, OpenAI GPT-4o |

---

*Note: PRD interrompu au Step 3 - passage direct à Tech Spec pour planification d'implémentation.*
