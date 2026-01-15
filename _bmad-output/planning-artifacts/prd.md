---
stepsCompleted: [1, 2, 3, 4, 5-skipped, 6-skipped, 7, 8, 9, 10, 11]
status: complete
inputDocuments:
  - docs/index.md
  - docs/architecture.md
  - _bmad-output/implementation-artifacts/tech-spec-cv-pipeline-v2.md
workflowType: 'prd'
lastStep: 0
documentCounts:
  briefs: 0
  research: 0
  brainstorming: 0
  projectDocs: 2
  implementationArtifacts: 1
projectType: brownfield
---

# Product Requirements Document - FitMyCV-DEV

**Author:** Erick
**Date:** 2026-01-07

## Executive Summary

**FitMyCV.io** est une application SaaS de génération de CV optimisés par IA. Ce PRD définit le refactoring du pipeline de génération CV, passant d'un appel IA monolithique à une architecture en phases spécialisées.

### Vision

Transformer la génération de CV par IA pour produire des documents qui semblent rédigés par un humain expert, parfaitement adaptés à chaque offre d'emploi - et qui décrochent des entretiens.

### Problème Actuel

Le système actuel souffre de plusieurs limitations :
- **"Bouillie de contexte"** : L'IA reçoit trop d'informations en une seule fois
- **Hallucinations** : Invention de compétences ou expériences non présentes dans le CV source
- **Qualité rédactionnelle** : Phrases mal construites, ton artificiel
- **Confusion structurelle** : Mélange responsibilities/deliverables, mauvaise gestion des skills

### Solution Proposée

Pipeline en 3 phases avec appels IA spécialisées :
- **Phase 0.5** : Classification des expériences (KEEP/REMOVE/MOVE_TO_PROJECTS)
- **Phase 1** : Batches par section avec dépendances intelligentes
- **Phase 2** : Recomposition immédiate dès qu'une offre est prête

### Ce Qui Rend Ce Refactoring Spécial

L'objectif n'est pas simplement d'améliorer la technique - c'est de **changer le résultat perçu**. Un CV généré par FitMyCV doit :
- Ressembler à un CV rédigé par un humain expert
- Être custom et adapté spécifiquement pour l'offre ciblée
- Maximiser les chances de décrocher un entretien

**La métrique de succès ultime : le taux de conversion candidature → entretien.**

## Project Classification

| Attribut | Valeur |
|----------|--------|
| **Type technique** | SaaS Web Application |
| **Domaine** | Génération de CV / HR Tech |
| **Complexité** | Medium |
| **Contexte projet** | Brownfield - refactoring système existant |
| **Stack** | Next.js 14, React 18, Prisma 6, OpenAI GPT-4o |

## Success Criteria

### User Success

**Le moment "Aha!"** : L'utilisateur passe d'un CV brouillon et générique à un CV spécialisé pour l'offre ciblée.

**Indicateurs de succès utilisateur :**
- Le CV est au **format ATS** avec les mots-clés de l'offre intégrés naturellement
- Les **phrases sont correctement rédigées** - ton professionnel, pas artificiel
- Le **"Who I am"** reflète authentiquement le profil du candidat
- L'utilisateur pense : **"J'aurais jamais pu faire ça seul"**
- Confiance suffisante pour **postuler sans retoucher**

**Métrique qualité** : Ratio modifications acceptées/refusées lors de la review (event `CV_CHANGES_REVIEWED`)

**Métrique ultime** : Taux de conversion candidature → entretien

### Business Success

**Indicateurs de succès business :**
- **Augmentation du taux de conversion** free → payant grâce à la qualité visible dès le premier CV généré
- **Meilleurs avis et NPS** - les utilisateurs recommandent le produit
- **Constitution de "decks" de CV** - les utilisateurs génèrent plusieurs CV, signe d'adoption et de confiance

### Technical Success

**Indicateurs de succès technique :**
- **Zéro hallucination** sur les données et hard skills
- **Fiabilité** : Taux de succès > 95% des générations
- **Observabilité** : Dashboard admin dédié pour tracking/debug du pipeline v2
- **Télémétrie** : Étendre `lib/telemetry/` existant avec `featureName: cv_generation_v2`

### Measurable Outcomes

| Métrique | Baseline | Objectif |
|----------|----------|----------|
| Hallucinations | Fréquentes | Quasi-nulles |
| Qualité perçue (accept/reject ratio) | Non mesuré | > 90% acceptées |
| Taux de succès génération | ~90% | > 95% |

## Product Scope

### MVP - Minimum Viable Product

**Focus : Pipeline CV v2 avec qualité maximale**

1. **Phase 0.5 - Classification** : Déterminer KEEP/REMOVE/MOVE pour chaque expérience et projet
2. **Phase 1 - Batches spécialisés** :
   - **Expériences** adaptées individuellement (title, responsibilities, résultats, skills_used)
   - **Projets** adaptés individuellement (summary, tech_stack)
   - **Extras** (bénévolat, hobbies, disponibilité, remote, permis) adaptés si pertinents
   - **Skills** déduits intelligemment (hard_skills, soft_skills, tools, methodologies) - après exp/proj
   - **Summary** synthétisant le tout (description, domains, key_strengths) - en dernier
3. **Phase 2 - Recomposition** : Assemblage immédiat, CV disponible dès prêt
4. **Intégration SSE** : Progression temps réel par étape
5. **Langues** : Adapter le format si dans l'offre, garder telles quelles si hors offre
6. **Dashboard admin** : Onglet dédié pour tracking/debug du pipeline v2
7. **Métrique accept/reject** : Nouvel event `CV_CHANGES_REVIEWED` dans la télémétrie

**Sections non modifiées par le pipeline** : header (sauf current_title), education, languages (sauf format)

**Note** : Refactoring direct, pas de rétrocompatibilité v1/v2.

### Growth Features (Post-MVP)

- Analyse de performance des CV générés (tracking des candidatures)
- Suggestions d'amélioration basées sur les retours
- Templates de CV sectoriels optimisés
- Comparaison avant/après visuelle

### Vision (Future)

**Système RAG d'apprentissage collectif :**
- Embeddings sur le "Who I am" du CV pour trouver des profils similaires
- Base de données des diffs acceptés/refusés par les utilisateurs
- Matching par profil : compétences similaires, parcours proches
- **Effet réseau** : Plus la communauté grandit, plus les CV sont optimaux
- Chaque interaction enrichit la base de connaissances pour les utilisateurs suivants

## User Journeys

### Journey 1 : Marc Dubois - Du CV Générique au Deck de Candidatures

**Profil** : Consultant DevOps, 6 ans d'expérience. Cible grands groupes (BNP, AXA) et scale-ups tech (Doctolib, Qonto).

**Le problème** : Chaque site carrière a son ATS. Son CV générique "DevOps Engineer" ne passe pas les filtres automatiques. 15 offres à traiter = 15 CV à adapter manuellement. C'est fastidieux.

**La solution FitMyCV** :

1. **Import** : Marc importe son CV PDF via l'onboarding. L'outil le reconstruit proprement avec toutes ses expériences, certifications, projets.

2. **Génération** : Marc colle l'URL de l'offre BNP. Le pipeline v2 se lance. Le TaskQueueModal affiche la progression par phase :
   - Classification ✓
   - Expériences en cours...
   - Projets ✓
   - Skills en cours...
   - Summary ✓
   - Recomposition ✓

   Marc peut lancer une autre génération en parallèle ou fermer et revenir plus tard (persistance serveur).

3. **Review** : Le CV est prêt. Marc voit le diff :
   - Modifications en vert avec raisons IA
   - Suppressions en rouge
   - Il clique sur chaque élément pour voir le "avant" et la raison

4. **Validation** : Marc accepte 90% des modifications, ajuste une formulation, valide.

**Le résultat** : **"J'aurais jamais pu faire ça seul en 5 minutes."**

**Le deck** : En une soirée, Marc génère 8 CV adaptés à 8 offres. Deux semaines plus tard : 4 entretiens décrochés.

---

### Journey 2 : Admin - Monitoring du Pipeline v2

**Profil** : Sophie (Erick au début) - Admin du SaaS FitMyCV.

**Le dashboard** : Sophie ouvre l'onglet "Pipeline v2" dans l'admin :
- 47 générations aujourd'hui, 45 succès, 2 échecs
- Temps moyen par phase : Classification 8s, Batches 35s, Recomposition 2s
- Coût OpenAI du jour : 2.34€

**L'observation** : Un échec visible. Sophie voit la phase concernée et l'erreur. Dashboard passif pour MVP - les actions de debug (retry, investigation) viendront post-MVP.

**La configuration** : Via Settings admin, Sophie accède à la carte "Pipeline CV v2 Models" pour ajuster les modèles IA par phase (Classification, Experiences, Skills, Summary...).

---

### Journey Requirements Summary

| Composant | Requirement MVP |
|-----------|-----------------|
| **TaskQueueModal** | Améliorer : progression par phase + étape en cours (remplace donut temps moyen) |
| **Admin Dashboard** | Nouvel onglet "Pipeline v2" avec métriques et logs |
| **Admin Settings** | Nouvelle carte "Pipeline CV v2 Models" pour config modèles par phase |

## SaaS B2B Specific Requirements

### Architecture Multi-Tenant

Le pipeline CV v2 opère dans un contexte **multi-tenant strict** :
- Données isolées par `userId`
- Aucun accès croisé entre utilisateurs
- Toutes les opérations filtrées par session utilisateur

### Modèle Économique : Système de Crédits

**Pas d'abonnements** - Modèle basé sur les crédits :
- Chaque action (génération, import, export, optimisation) consomme des crédits
- Crédits gratuits à la création de compte
- Boutique pour acheter des crédits supplémentaires
- Adapté à l'usage ponctuel (recherche d'emploi = période limitée)

### Intégrations Externes

| Service | Usage |
|---------|-------|
| OpenAI GPT-4o | Génération, classification, adaptation |
| Stripe | Paiement crédits |

*(Pas d'autres intégrations prévues pour MVP)*

### Background Jobs - Nouvelle Logique de Concurrence

**Changement de paradigme** : Concurrence par **type de tâche**, pas par opération individuelle.

| Type de Tâche | Slot |
|---------------|------|
| `cv_generation` | 1 (même si 10 offres) |
| `pdf_import` | 1 |
| `cv_translation` | 1 |
| `cv_optimization` | 1 |
| `match_score` | 1 |

**Règle** : Max 3 types de tâches différentes en parallèle par utilisateur.

**Bénéfice** : L'utilisateur peut importer un CV pendant qu'une génération multi-offres est en cours.

### Considérations de Scaling

- Serveur actuel suffisant pour MVP
- Upgrade prévu si besoin (i7/i9, plus de RAM)
- Monitoring via dashboard admin pour anticiper

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach :** Problem-Solving MVP
- Résoudre le problème de qualité des CV générés
- Pipeline v2 = meilleure qualité que v1, même si coût API supérieur
- Prix ajustés en conséquence si besoin

**Ressources :** Développeur solo + Claude Code
**Timeline :** Fin janvier 2026
**Post-MVP :** Landing page → SaaS live

### MVP Feature Set (Phase 1)

**Core User Journey Supported :** Marc (candidat) - génération multi-offres

**Must-Have Capabilities :**

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Pipeline v2** | 3 phases : Classification → Batches → Recomposition |
| 2 | **TaskQueueModal amélioré** | Progression par phase + étape en cours |
| 3 | **Carte Settings modèles** | Config modèles IA par phase dans admin |
| 4 | **Télémétrie étendue** | Event `CV_CHANGES_REVIEWED`, featureName `cv_generation_v2` |
| 5 | **SSE progression** | Feedback temps réel des étapes |
| 6 | **Background Jobs refactoré** | Concurrence par type de tâche |

**Explicitement hors MVP :**
- Dashboard admin Pipeline v2 (monitoring) → Post-MVP
- RAG collectif → Vision future
- Tracking candidatures → Growth

### Post-MVP Features

**Phase 2 (Post-Launch) :**
- Dashboard admin Pipeline v2 (métriques, logs, debug)
- Analyse de performance des CV générés
- Comparaison avant/après visuelle

**Phase 3 (Growth) :**
- Tracking des candidatures
- Templates sectoriels optimisés
- Suggestions d'amélioration basées sur les retours

**Phase 4 (Vision) :**
- RAG d'apprentissage collectif
- Embeddings "Who I am" + diffs communautaires

### Risk Mitigation Strategy

| Risque | Mitigation |
|--------|------------|
| **Technique (Prompts IA)** | Itération rapide, tests manuels de qualité, ajustement des prompts |
| **Qualité insuffisante** | V2 toujours > V1 → fallback acceptable, ajustement prix si coût API élevé |
| **Timeline** | Scope focalisé, nice-to-have explicitement exclus |
| **Ressources** | Solo + Claude Code, pas de dépendance externe |

## Functional Requirements

### Pipeline CV Generation (Core)

- **FR1** : Le système peut classifier chaque expérience du CV source comme KEEP, REMOVE ou MOVE_TO_PROJECTS
- **FR2** : Le système peut classifier chaque projet du CV source comme KEEP ou REMOVE
- **FR3** : Le système peut adapter individuellement chaque expérience (title, responsibilities, résultats, skills_used) en fonction de l'offre d'emploi
- **FR4** : Le système peut adapter individuellement chaque projet (summary, tech_stack) en fonction de l'offre d'emploi
- **FR5** : Le système peut adapter les extras (bénévolat, hobbies, disponibilité, remote, permis) si pertinents pour l'offre
- **FR6** : Le système peut déduire les skills (hard_skills, soft_skills, tools, methodologies) à partir des expériences et projets adaptés
- **FR7** : Le système peut générer un summary (description, domains, key_strengths) synthétisant le CV adapté
- **FR8** : Le système peut adapter le format des langues si elles sont mentionnées dans l'offre d'emploi
- **FR9** : Le système peut conserver les langues non mentionnées dans l'offre sans modification
- **FR10** : Le système peut recomposer le CV final dès que toutes les sections sont prêtes

### Multi-Offer Processing

- **FR11** : L'utilisateur peut lancer la génération de CV pour jusqu'à 10 offres d'emploi simultanément
- **FR12** : Le système peut traiter chaque offre indépendamment au sein d'une même tâche
- **FR13** : Le système peut mettre à disposition un CV dès qu'il est prêt, sans attendre les autres offres

### Task Progress & Management

- **FR14** : L'utilisateur peut voir la progression de génération par phase (Classification, Batches, Recomposition)
- **FR15** : L'utilisateur peut voir l'étape en cours au sein d'une phase (experiences, projects, skills, summary...)
- **FR16** : L'utilisateur peut lancer d'autres types de tâches pendant qu'une génération est en cours
- **FR17** : Le système peut limiter à 3 types de tâches différentes en parallèle par utilisateur
- **FR18** : L'utilisateur peut fermer l'application et retrouver ses tâches complétées au retour

### Review & Validation

- **FR19** : L'utilisateur peut voir les modifications apportées au CV (diff visuel)
- **FR20** : L'utilisateur peut voir la raison IA pour chaque modification
- **FR21** : L'utilisateur peut accepter ou refuser chaque modification individuellement
- **FR22** : L'utilisateur peut accepter toutes les modifications d'un coup
- **FR23** : Le système peut appliquer uniquement les modifications acceptées au CV final

### Administration

- **FR24** : L'administrateur peut configurer le modèle IA utilisé pour chaque phase du pipeline
- **FR25** : L'administrateur peut configurer le modèle IA utilisé pour chaque type de batch

### Telemetry & Tracking

- **FR26** : Le système peut enregistrer un événement `CV_CHANGES_REVIEWED` avec le ratio accept/reject
- **FR27** : Le système peut tracker les générations avec le featureName `cv_generation_v2`
- **FR28** : Le système peut enregistrer la durée et le statut de chaque phase

### SSE Real-time Feedback

- **FR29** : Le système peut envoyer des événements SSE de progression en temps réel
- **FR30** : Le frontend peut recevoir et afficher les événements de progression par phase

## Non-Functional Requirements

### Qualité IA (Critique)

- **NFR1** : Le système ne doit pas inventer de données absentes du CV source (zéro hallucination sur les hard skills, expériences, certifications)
- **NFR2** : Les phrases générées doivent être naturelles et professionnelles (ton humain, pas artificiel)
- **NFR3** : Le "Who I am" (summary) doit refléter authentiquement le profil du candidat
- **NFR4** : Les mots-clés de l'offre d'emploi doivent être intégrés naturellement, pas forcés

**Validation** : Test manuel par le développeur sur chaque itération de prompt. Si la qualité n'est pas au rendez-vous, le prompt engineering est revu.

### Sécurité & Conformité RGPD

- **NFR5** : Les données CV sont isolées par utilisateur (multi-tenant strict)
- **NFR6** : L'utilisateur peut supprimer ses CV à tout moment (suppression complète en base)
- **NFR7** : L'utilisateur peut supprimer son compte (suppression de toutes les données + télémétrie)
- **NFR8** : La télémétrie n'est enregistrée que si l'utilisateur a accepté les cookies
- **NFR9** : Les données transmises à OpenAI ne sont pas utilisées pour l'entraînement (API Data Usage Policy)

**Note** : Mentionner dans la privacy policy que les CV sont traités par l'API OpenAI avec référence à leur politique de non-entraînement.

### Fiabilité

- **NFR10** : Taux de succès des générations > 95%
- **NFR11** : En cas d'échec, le système retry automatiquement jusqu'à 3 fois
- **NFR12** : Après 3 échecs, la génération est annulée et les crédits sont remboursés
- **NFR13** : L'utilisateur est notifié en cas d'échec avec remboursement

### Performance (Modérée)

- **NFR14** : Temps de génération acceptable (~1 minute par CV)
- **NFR15** : La génération est asynchrone avec persistance serveur
- **NFR16** : L'utilisateur peut quitter et revenir sans perdre le travail en cours

