---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
status: complete
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/implementation-artifacts/tech-spec-cv-pipeline-v2.md
---

# FitMyCV-DEV - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for FitMyCV-DEV, decomposing the requirements from the PRD and Architecture/Tech-spec into implementable stories.

## Requirements Inventory

### Functional Requirements

- FR1: Le système peut classifier chaque expérience du CV source comme KEEP, REMOVE ou MOVE_TO_PROJECTS
- FR2: Le système peut classifier chaque projet du CV source comme KEEP ou REMOVE
- FR3: Le système peut adapter individuellement chaque expérience (title, responsibilities, résultats, skills_used) en fonction de l'offre d'emploi
- FR4: Le système peut adapter individuellement chaque projet (summary, tech_stack) en fonction de l'offre d'emploi
- FR5: Le système peut adapter les extras (bénévolat, hobbies, disponibilité, remote, permis) si pertinents pour l'offre
- FR6: Le système peut déduire les skills (hard_skills, soft_skills, tools, methodologies) à partir des expériences et projets adaptés
- FR7: Le système peut générer un summary (description, domains, key_strengths) synthétisant le CV adapté
- FR8: Le système peut adapter le format des langues si elles sont mentionnées dans l'offre d'emploi
- FR9: Le système peut conserver les langues non mentionnées dans l'offre sans modification
- FR10: Le système peut recomposer le CV final dès que toutes les sections sont prêtes
- FR11: L'utilisateur peut lancer la génération de CV pour jusqu'à 10 offres d'emploi simultanément
- FR12: Le système peut traiter chaque offre indépendamment au sein d'une même tâche
- FR13: Le système peut mettre à disposition un CV dès qu'il est prêt, sans attendre les autres offres
- FR14: L'utilisateur peut voir la progression de génération par phase (Classification, Batches, Recomposition)
- FR15: L'utilisateur peut voir l'étape en cours au sein d'une phase (experiences, projects, skills, summary...)
- FR16: L'utilisateur peut lancer d'autres types de tâches pendant qu'une génération est en cours
- FR17: Le système peut limiter à 3 types de tâches différentes en parallèle par utilisateur
- FR18: L'utilisateur peut fermer l'application et retrouver ses tâches complétées au retour
- FR19: L'utilisateur peut voir les modifications apportées au CV (diff visuel)
- FR20: L'utilisateur peut voir la raison IA pour chaque modification
- FR21: L'utilisateur peut accepter ou refuser chaque modification individuellement
- FR22: L'utilisateur peut accepter toutes les modifications d'un coup
- FR23: Le système peut appliquer uniquement les modifications acceptées au CV final
- FR24: L'administrateur peut configurer le modèle IA utilisé pour chaque phase du pipeline
- FR25: L'administrateur peut configurer le modèle IA utilisé pour chaque type de batch
- FR26: Le système peut enregistrer un événement CV_CHANGES_REVIEWED avec le ratio accept/reject
- FR27: Le système peut tracker les générations avec le featureName cv_generation_v2
- FR28: Le système peut enregistrer la durée et le statut de chaque phase
- FR29: Le système peut envoyer des événements SSE de progression en temps réel
- FR30: Le frontend peut recevoir et afficher les événements de progression par phase

### NonFunctional Requirements

- NFR1: Le système ne doit pas inventer de données absentes du CV source (zéro hallucination sur les hard skills, expériences, certifications)
- NFR2: Les phrases générées doivent être naturelles et professionnelles (ton humain, pas artificiel)
- NFR3: Le "Who I am" (summary) doit refléter authentiquement le profil du candidat
- NFR4: Les mots-clés de l'offre d'emploi doivent être intégrés naturellement, pas forcés
- NFR5: Les données CV sont isolées par utilisateur (multi-tenant strict)
- NFR6: L'utilisateur peut supprimer ses CV à tout moment (suppression complète en base)
- NFR7: L'utilisateur peut supprimer son compte (suppression de toutes les données + télémétrie)
- NFR8: La télémétrie n'est enregistrée que si l'utilisateur a accepté les cookies
- NFR9: Les données transmises à OpenAI ne sont pas utilisées pour l'entraînement (API Data Usage Policy)
- NFR10: Taux de succès des générations > 95%
- NFR11: En cas d'échec, le système retry automatiquement jusqu'à 3 fois
- NFR12: Après 3 échecs, la génération est annulée et les crédits sont remboursés
- NFR13: L'utilisateur est notifié en cas d'échec avec remboursement
- NFR14: Temps de génération acceptable (~1 minute par CV)
- NFR15: La génération est asynchrone avec persistance serveur
- NFR16: L'utilisateur peut quitter et revenir sans perdre le travail en cours

### Additional Requirements

**Infrastructure Database (Tech-spec) :**
- Créer 3 nouvelles tables Prisma : CvGenerationTask, CvGenerationOffer, CvGenerationSubtask
- Ajouter 6 nouveaux settings AI models dans la table Setting

**Architecture Pipeline (Tech-spec) :**
- Implémenter le flux Phase 0.5 (Classification) → Phase 1 (Batches) → Phase 2 (Recomposition)
- Paralléliser Expériences + Projets + Extras dans Phase 1
- Séquencer Skills (après exp/proj) puis Summary (après skills + extras)

**Langue du CV :**
- Le CV généré DOIT être dans la langue de l'offre d'emploi
- Traduction automatique du contenu si CV source dans une autre langue

**Concurrence par Type (Tech-spec Section 10.2) :**
- Max 3 types de tâches différents en parallèle par utilisateur
- Une génération multi-offres = 1 slot cv_generation

**Retry & Remboursement (Tech-spec Section 10.3) :**
- Retry avec backoff exponentiel (1s, 2s, 4s)
- Remboursement automatique après 3 échecs

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 1 | Classification expériences KEEP/REMOVE/MOVE |
| FR2 | Epic 1 | Classification projets KEEP/REMOVE |
| FR3 | Epic 1 | Adaptation expériences individuelles |
| FR4 | Epic 1 | Adaptation projets individuels |
| FR5 | Epic 1 | Adaptation extras si pertinents |
| FR6 | Epic 1 | Déduction skills depuis exp/proj |
| FR7 | Epic 1 | Génération summary synthétisant le CV |
| FR8 | Epic 1 | Adaptation format langues si dans offre |
| FR9 | Epic 1 | Conservation langues hors offre |
| FR10 | Epic 1 | Recomposition CV final |
| FR11 | Epic 2 | Génération jusqu'à 10 offres |
| FR12 | Epic 2 | Traitement indépendant par offre |
| FR13 | Epic 2 | CV disponible dès prêt |
| FR14 | Epic 3 | Progression par phase |
| FR15 | Epic 3 | Étape en cours visible |
| FR16 | Epic 3 | Lancer autres types de tâches |
| FR17 | Epic 3 | Limite 3 types en parallèle |
| FR18 | Epic 3 | Persistance après fermeture |
| FR19 | Epic 4 | Diff visuel des modifications |
| FR20 | Epic 4 | Raison IA par modification |
| FR21 | Epic 4 | Accept/reject individuel |
| FR22 | Epic 4 | Accept all |
| FR23 | Epic 4 | Application sélective |
| FR24 | Epic 5 | Config modèle par phase |
| FR25 | Epic 5 | Config modèle par batch |
| FR26 | Epic 5 | Event CV_CHANGES_REVIEWED |
| FR27 | Epic 5 | Tracking cv_generation_v2 |
| FR28 | Epic 5 | Métriques durée/statut |
| FR29 | Epic 3 | SSE progression temps réel |
| FR30 | Epic 3 | Frontend affiche progression |

## Epic List

### Epic 1: Pipeline CV v2 - Génération Mono-Offre
L'utilisateur peut générer UN CV adapté de qualité pour UNE offre d'emploi, avec classification intelligente des expériences/projets et adaptation spécialisée par section.
**FRs couverts:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10

### Epic 2: Multi-Offres & Disponibilité Immédiate
L'utilisateur peut lancer la génération pour plusieurs offres d'emploi simultanément et accéder à chaque CV dès qu'il est prêt, sans attendre les autres.
**FRs couverts:** FR11, FR12, FR13

### Epic 3: Progression Temps Réel & Concurrence
L'utilisateur peut voir la progression en temps réel par phase et étape, et peut lancer d'autres types de tâches pendant qu'une génération est en cours.
**FRs couverts:** FR14, FR15, FR16, FR17, FR18, FR29, FR30

### Epic 4: Review & Validation des Modifications
L'utilisateur peut voir les modifications IA apportées au CV, comprendre les raisons de chaque changement, et accepter ou refuser chaque modification avant application finale.
**FRs couverts:** FR19, FR20, FR21, FR22, FR23

### Epic 5: Administration & Télémétrie
L'administrateur peut configurer les modèles IA utilisés par phase du pipeline et suivre la qualité des générations via la télémétrie.
**FRs couverts:** FR24, FR25, FR26, FR27, FR28

---

## Epic 1: Pipeline CV v2 - Génération Mono-Offre

L'utilisateur peut générer UN CV adapté de qualité pour UNE offre d'emploi, avec classification intelligente des expériences/projets et adaptation spécialisée par section.

**FRs couverts:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10
**NFRs adressés:** NFR1, NFR2, NFR3, NFR4, NFR10, NFR11, NFR12, NFR13, NFR14, NFR15

---

### Story 1.1: Infrastructure Database & Settings

As a développeur,
I want avoir les tables de données et les settings nécessaires au pipeline v2,
So that les stories suivantes puissent persister et configurer les générations.

**Acceptance Criteria:**

**Given** le schéma Prisma existant
**When** je lance `npx prisma migrate dev --name add_cv_generation_pipeline_v2`
**Then** les 3 nouvelles tables sont créées : `CvGenerationTask`, `CvGenerationOffer`, `CvGenerationSubtask`
**And** les relations avec `User`, `CvFile`, `JobOffer`, `CreditTransaction` sont établies
**And** les index de performance sont créés (userId, status, taskId, offerId)

**Given** la table `Setting` existante
**When** je lance le seed des settings pipeline v2
**Then** 6 nouveaux settings sont créés avec category `ai_models` et default `gpt-4o-mini` :
  - `model_cv_classify`
  - `model_cv_batch_experience`
  - `model_cv_batch_projects`
  - `model_cv_batch_extras`
  - `model_cv_batch_skills`
  - `model_cv_batch_summary`

**Given** le fichier `lib/admin/settingsConfig.js`
**When** j'ouvre l'admin Settings
**Then** je vois un nouveau groupe "Pipeline CV v2" avec les 6 settings modifiables

---

### Story 1.2: Route API & Création de Tâche

As a utilisateur,
I want appeler une API pour lancer une génération de CV v2,
So that je puisse initier le processus de génération pour une offre d'emploi.

**Acceptance Criteria:**

**Given** un utilisateur authentifié avec des crédits disponibles
**When** j'appelle `POST /api/cv/generate-v2` avec `{ sourceCvFile, jobOfferIds: [id], mode: 'adapt' }`
**Then** une `CvGenerationTask` est créée avec status `pending`
**And** une `CvGenerationOffer` est créée pour l'offre avec offerIndex `0`
**And** les crédits sont débités selon le coût défini dans `Setting` pour la feature `gpt_cv_generation`
**And** la réponse contient `{ success: true, taskId, totalOffers: 1 }`

**Given** un utilisateur sans crédits suffisants (solde < coût feature × nombre d'offres)
**When** j'appelle `POST /api/cv/generate-v2`
**Then** je reçois une erreur 403 `credits.insufficient`
**And** aucune tâche n'est créée

**Given** un utilisateur non authentifié
**When** j'appelle `POST /api/cv/generate-v2`
**Then** je reçois une erreur 401 `not_authenticated`

---

### Story 1.3: Phase Classification

As a système,
I want classifier chaque expérience et projet du CV source,
So that je sache quoi garder, supprimer, ou déplacer vers les projets.

**Acceptance Criteria:**

**Given** un CV source avec des expériences et projets
**When** la phase classification s'exécute pour une offre
**Then** chaque expérience reçoit une action : `KEEP`, `REMOVE`, ou `MOVE_TO_PROJECTS`
**And** chaque projet reçoit une action : `KEEP` ou `REMOVE`
**And** une raison est fournie pour chaque décision
**And** le résultat est sauvegardé dans `CvGenerationOffer.classificationResult`

**Given** une expérience > 7 ans et hors domaine de l'offre
**When** la classification s'exécute
**Then** l'expérience est marquée `REMOVE` avec raison appropriée

**Given** une expérience de type side-project ou freelance courte
**When** la classification s'exécute
**Then** l'expérience peut être marquée `MOVE_TO_PROJECTS`

**Given** le fichier `lib/cv-pipeline-v2/phases/classify.js`
**When** je l'inspecte
**Then** il utilise le prompt `prompts/classify.md`
**And** il utilise le setting `model_cv_classify` pour le modèle IA
**And** il crée une `CvGenerationSubtask` de type `classify`

---

### Story 1.4: Batch Experiences

As a système,
I want adapter individuellement chaque expérience KEEP,
So that le titre, responsibilities, résultats et skills_used soient optimisés pour l'offre.

**Acceptance Criteria:**

**Given** une expérience marquée KEEP par la classification
**When** le batch experience s'exécute
**Then** le `title` est adapté aux termes de l'offre
**And** les `responsibilities` sont reformulées avec les mots-clés pertinents
**And** les `résultats` (deliverables) sont mis en valeur si pertinents
**And** les `skills_used` sont filtrés pour ne garder que les pertinents
**And** une `CvGenerationSubtask` de type `batch_experience` est créée avec itemIndex

**Given** plusieurs expériences KEEP
**When** le batch s'exécute
**Then** les appels IA sont parallélisés (Promise.all)
**And** chaque expérience est traitée individuellement

**Given** le prompt `prompts/batch-experience.md`
**When** l'IA génère une adaptation
**Then** elle ne doit JAMAIS inventer de données absentes du CV source (NFR1)
**And** le ton doit être professionnel et naturel (NFR2)

---

### Story 1.5: Batch Projects

As a système,
I want adapter individuellement chaque projet KEEP + les MOVED,
So that le summary et tech_stack soient optimisés pour l'offre.

**Acceptance Criteria:**

**Given** un projet marqué KEEP par la classification
**When** le batch project s'exécute
**Then** le `summary` est reformulé avec les mots-clés de l'offre
**And** le `tech_stack` est filtré pour mettre en avant les technologies pertinentes
**And** une `CvGenerationSubtask` de type `batch_project` est créée

**Given** une expérience marquée MOVE_TO_PROJECTS
**When** le batch projects s'exécute
**Then** l'expérience est convertie en format projet
**And** elle est traitée comme les autres projets

**Given** plusieurs projets à traiter
**When** le batch s'exécute
**Then** les appels IA sont parallélisés avec les expériences et extras

---

### Story 1.6: Batch Extras

As a système,
I want adapter les extras si pertinents pour l'offre,
So that bénévolat, hobbies, disponibilité, remote et permis soient valorisés.

**Acceptance Criteria:**

**Given** un CV source avec des extras (bénévolat, hobbies, disponibilité, remote, permis)
**When** le batch extras s'exécute
**Then** chaque extra pertinent pour l'offre est mis en valeur
**And** les extras non pertinents sont conservés tels quels
**And** une `CvGenerationSubtask` de type `batch_extras` est créée

**Given** une offre mentionnant "permis B requis"
**When** le CV source a "permis B" dans extras
**Then** cette information est mise en avant dans la version adaptée

**Given** le batch extras
**When** il s'exécute
**Then** il est parallélisé avec experiences et projects (même contexte)

---

### Story 1.7: Batch Skills

As a système,
I want adapter intelligemment les skills en fonction de l'offre et du parcours,
So that hard_skills, soft_skills, tools et methodologies soient pertinents et justifiables.

**Acceptance Criteria:**

**HARD SKILLS :**

**Given** un hard skill présent dans le CV source mais hors sujet pour l'offre
**When** le batch skills s'exécute
**Then** le hard skill est SUPPRIMÉ

**Given** un hard skill présent mais avec un niveau mal spécifié
**When** le batch skills s'exécute
**Then** le niveau est AJUSTÉ selon l'expérience réelle

**Given** un hard skill mentionné dans l'offre et justifiable par l'expérience/projets
**When** le batch skills s'exécute
**Then** le hard skill peut être AJOUTÉ avec le niveau approprié

**SOFT SKILLS :**

**Given** un soft skill présent mais hors sujet pour l'offre
**When** le batch skills s'exécute
**Then** le soft skill est SUPPRIMÉ

**Given** un soft skill mentionné dans l'offre et justifiable par l'expérience
**When** le batch skills s'exécute
**Then** le soft skill peut être AJOUTÉ

**TOOLS :**

**Given** un tool présent mais hors sujet pour l'offre
**When** le batch skills s'exécute
**Then** le tool est SUPPRIMÉ

**Given** un tool mentionné dans l'offre mais ABSENT du CV source
**When** le batch skills s'exécute
**Then** le tool NE DOIT JAMAIS être ajouté (même si justifiable)

**Given** un tool présent avec un niveau mal spécifié
**When** le batch skills s'exécute
**Then** le niveau est AJUSTÉ

**METHODOLOGIES :**

**Given** une méthodologie dans l'offre
**When** le batch skills s'exécute
**Then** elle est AJOUTÉE uniquement si justifiable par l'expérience du CV
**And** le résultat est un MIX entre : méthodologies requises par l'offre + méthodologies déjà pratiquées

**RÈGLE GÉNÉRALE :**

**Given** toute modification de skill (ajout, suppression, ajustement)
**When** le batch skills génère le résultat
**Then** chaque modification DOIT être justifiable par le contenu du CV source (expériences, projets)
**And** une raison est fournie pour chaque changement

---

### Story 1.8: Batch Summary

As a système,
I want générer un summary synthétisant le CV adapté,
So that description, domains et key_strengths reflètent le profil optimisé.

**Acceptance Criteria:**

**Given** les skills, expériences et extras adaptés
**When** le batch summary s'exécute
**Then** il reçoit en contexte tous les résultats précédents
**And** la `description` ("Who I am") reflète authentiquement le candidat (NFR3)
**And** les `domains` sont adaptés à l'offre
**And** les `key_strengths` mettent en avant les points forts pertinents

**Given** le batch summary
**When** il s'exécute
**Then** il attend que skills soit terminé (dernière dépendance)
**And** une `CvGenerationSubtask` de type `batch_summary` est créée

**Given** le prompt summary
**When** l'IA génère le summary
**Then** les mots-clés de l'offre sont intégrés naturellement (NFR4)
**And** le ton est professionnel, pas artificiel

---

### Story 1.9: Recomposition & Langues

As a système,
I want assembler le CV final avec adaptation des langues,
So that l'utilisateur obtienne un CV complet et cohérent.

**Acceptance Criteria:**

**Given** tous les batch results terminés pour une offre
**When** la phase recomposition s'exécute
**Then** le CV final est assemblé avec :
  - `header.current_title` = titre de l'offre
  - `summary` = batch summary result
  - `experience` = batch experiences results
  - `projects` = batch projects results
  - `skills` = batch skills result
  - `extras` = batch extras result
  - `languages` = adaptées selon la règle ci-dessous
  - `education` = conservé tel quel

**Given** une langue mentionnée dans l'offre (ex: "anglais courant")
**When** la recomposition s'exécute
**Then** le format du niveau est adapté au style de l'offre (C1 ↔ Courant)

**Given** une langue NON mentionnée dans l'offre
**When** la recomposition s'exécute
**Then** la langue est conservée telle quelle (valeur ajoutée)

**Given** le CV final assemblé
**When** la recomposition termine
**Then** un `CvFile` est créé avec le contenu JSON
**And** une `CvVersion` est créée avec origin `gpt_cv_generation_v2`
**And** `CvGenerationOffer.generatedCvFileId` est mis à jour

---

### Story 1.10: Orchestrateur & Retry

As a système,
I want orchestrer les phases avec retry automatique,
So that les échecs soient gérés gracieusement avec remboursement.

**Acceptance Criteria:**

**Given** une tâche de génération créée
**When** l'orchestrateur démarre (`startCvGenerationV2`)
**Then** le status passe à `running`
**And** les phases s'exécutent dans l'ordre : classify → batches → recompose

**Given** une erreur durant une phase
**When** le retry s'active
**Then** l'opération est retentée jusqu'à 3 fois
**And** un backoff exponentiel est appliqué (1s, 2s, 4s)
**And** le `retryCount` est mis à jour dans les subtasks

**Given** 3 échecs consécutifs pour une offre
**When** le système abandonne
**Then** `CvGenerationOffer.status` = `failed`
**And** le crédit correspondant est remboursé via `refundCreditForOffer`
**And** `CreditBalance` est incrémenté

**Given** une génération complétée avec succès
**When** toutes les phases terminent
**Then** `CvGenerationOffer.status` = `completed`
**And** `CvGenerationOffer.completedAt` est défini
**And** `CvGenerationTask.completedOffers` est incrémenté

---

### Story 1.11: Génération dans la Langue de l'Offre

As a utilisateur,
I want que le CV généré soit dans la langue de l'offre d'emploi,
So that mon CV soit directement utilisable sans traduction.

**Acceptance Criteria:**

**Given** une offre d'emploi en français
**When** le pipeline génère le CV
**Then** TOUT le contenu généré (summary, responsibilities, résultats, etc.) est en français

**Given** une offre d'emploi en anglais
**When** le pipeline génère le CV
**Then** TOUT le contenu généré est en anglais

**Given** une offre d'emploi en allemand
**When** le pipeline génère le CV
**Then** TOUT le contenu généré est en allemand

**Given** la langue de l'offre détectée (champ `language` de JobOffer ou détection automatique)
**When** chaque prompt IA est appelé (classify, batch_*, summary)
**Then** l'instruction de langue cible est incluse dans le prompt
**And** le contenu généré respecte la langue demandée

**Given** des données du CV source dans une langue différente de l'offre
**When** le batch s'exécute
**Then** le contenu est TRADUIT dans la langue de l'offre
**And** le sens original est préservé

---

## Epic 2: Multi-Offres & Disponibilité Immédiate

L'utilisateur peut lancer la génération pour plusieurs offres d'emploi simultanément et accéder à chaque CV dès qu'il est prêt, sans attendre les autres.

**FRs couverts:** FR11, FR12, FR13
**Dépend de:** Epic 1

---

### Story 2.1: Création de Tâche Multi-Offres

As a utilisateur,
I want lancer la génération de CV pour plusieurs offres d'emploi en une seule action,
So that je puisse traiter un batch de candidatures efficacement.

**Acceptance Criteria:**

**Given** un utilisateur authentifié avec suffisamment de crédits
**When** j'appelle `POST /api/cv/generate-v2` avec `{ sourceCvFile, jobOfferIds: [id1, id2, id3], mode: 'adapt' }`
**Then** une seule `CvGenerationTask` est créée avec `totalOffers: 3`
**And** 3 `CvGenerationOffer` sont créées avec `offerIndex` 0, 1, 2
**And** les crédits sont débités pour le total (coût feature × 3)

**Given** une liste de plus de 10 offres
**When** j'appelle l'API
**Then** je reçois une erreur 400 `max_offers_exceeded`
**And** le message indique la limite de 10 offres

**Given** une liste vide d'offres
**When** j'appelle l'API
**Then** je reçois une erreur 400 `no_offers_provided`

**Given** des jobOfferIds invalides ou n'appartenant pas à l'utilisateur
**When** j'appelle l'API
**Then** je reçois une erreur 404 `job_offer_not_found`
**And** aucune tâche n'est créée

---

### Story 2.2: Traitement Séquentiel par Offre

As a système,
I want traiter les offres séquentiellement,
So that le cache OpenAI soit optimisé et chaque offre soit indépendante.

**Acceptance Criteria:**

**Given** une tâche avec 3 offres
**When** l'orchestrateur traite la tâche
**Then** les offres sont traitées une par une dans l'ordre (offerIndex 0, 1, 2)
**And** chaque offre passe par toutes les phases (classify → batches → recompose)
**And** le cache OpenAI bénéficie du contexte séquentiel

**Given** une erreur sur l'offre 1 (après 3 retries)
**When** l'offre 1 échoue définitivement
**Then** l'offre 1 est marquée `failed` avec remboursement
**And** l'orchestrateur CONTINUE avec l'offre 2
**And** les autres offres ne sont pas impactées

**Given** une tâche en cours de traitement
**When** je consulte `CvGenerationTask`
**Then** `completedOffers` reflète le nombre d'offres terminées (succès ou échec)
**And** je peux calculer la progression : `completedOffers / totalOffers`

**Given** toutes les offres traitées (succès ou échec)
**When** l'orchestrateur termine
**Then** `CvGenerationTask.status` = `completed` (si au moins 1 succès) ou `failed` (si 100% échec)
**And** `CvGenerationTask.completedAt` est défini

---

### Story 2.3: Disponibilité Immédiate du CV (SSE)

As a utilisateur,
I want accéder à chaque CV dès qu'il est prêt,
So that je n'attende pas la fin de toutes les générations.

**Acceptance Criteria:**

**Given** une tâche avec 3 offres en cours
**When** l'offre 0 termine sa recomposition
**Then** un événement SSE `cv_generation_v2:offer_completed` est émis immédiatement
**And** l'événement contient `{ taskId, offerId, offerIndex: 0, generatedCvFileId, generatedCvFileName }`
**And** l'utilisateur peut accéder au CV généré SANS attendre les offres 1 et 2

**Given** l'offre 1 termine pendant que l'offre 2 est en cours
**When** la recomposition de l'offre 1 termine
**Then** un événement SSE `cv_generation_v2:offer_completed` est émis pour l'offre 1
**And** le traitement de l'offre 2 continue en parallèle de la notification

**Given** une offre qui échoue après 3 retries
**When** l'échec est confirmé
**Then** un événement SSE `cv_generation_v2:offer_failed` est émis
**And** l'événement contient `{ taskId, offerId, offerIndex, error, creditsRefunded }`
**And** l'utilisateur est notifié de l'échec ET du remboursement

**Given** toutes les offres terminées
**When** la dernière offre termine
**Then** un événement SSE `cv_generation_v2:completed` est émis
**And** l'événement contient `{ taskId, totalGenerated, totalFailed, creditsRefunded }`

**Given** un événement SSE `cv:list:changed`
**When** un CV est généré
**Then** le frontend peut rafraîchir la liste des CV automatiquement

---

## Epic 3: Progression Temps Réel & Concurrence

L'utilisateur peut voir la progression en temps réel par phase et étape, et peut lancer d'autres types de tâches pendant qu'une génération est en cours.

**FRs couverts:** FR14, FR15, FR16, FR17, FR18, FR29, FR30
**NFRs adressés:** NFR15, NFR16
**Dépend de:** Epic 1

---

### Story 3.1: Émission des Événements SSE de Progression

As a système,
I want émettre des événements SSE détaillés à chaque étape du pipeline,
So that le frontend puisse afficher la progression en temps réel.

**Acceptance Criteria:**

**Given** une offre qui démarre la phase classification
**When** `runClassificationPhase` commence
**Then** un événement SSE `cv_generation_v2:offer_progress` est émis avec :
  - taskId, offerId, offerIndex, totalOffers
  - phase: "classify", step: "classify", status: "running"

**Given** une offre qui démarre les batches
**When** chaque batch démarre/termine
**Then** un événement SSE est émis avec le `step` correspondant :
  - experiences (running/completed)
  - projects (running/completed)
  - extras (running/completed)
  - skills (running/completed)
  - summary (running/completed)

**Given** une offre qui démarre la recomposition
**When** `runRecomposePhase` commence
**Then** un événement SSE est émis avec phase: "recompose", step: "recompose"

**Given** la structure des événements
**When** le frontend les reçoit
**Then** il peut reconstruire l'état complet : phase actuelle, étape actuelle, progression globale

---

### Story 3.2: Composant PipelineTaskProgress

As a utilisateur,
I want voir la progression du pipeline par étapes visuelles,
So that je sache exactement où en est ma génération.

**Acceptance Criteria:**

**Given** une tâche `cv_generation_v2` en cours dans TaskQueueModal
**When** je regarde la tâche
**Then** je vois une série de points représentant les étapes :
  - Classification, Expériences, Projets, Extras, Skills, Summary, Finalisation

**Given** l'étape "experiences" en cours
**When** je regarde les points
**Then** Classification = vert (terminé), Expériences = bleu pulsant (en cours), reste = gris (à venir)

**Given** une tâche multi-offres (3 offres)
**When** je regarde le composant
**Then** je vois un indicateur "1/3 offres" au-dessus des points
**And** les points reflètent l'offre EN COURS de traitement

**Given** une tâche `cv_generation_v2` terminée
**When** je regarde la tâche
**Then** tous les points sont verts
**And** le statut affiche "Terminé" ou le nombre de CV générés

**Given** une tâche d'un autre type (import, translation)
**When** je regarde TaskQueueModal
**Then** le composant classique (donut) est affiché, pas PipelineTaskProgress

---

### Story 3.3: Hook useSSEPipelineProgress

As a développeur frontend,
I want un hook React pour écouter la progression du pipeline,
So that je puisse mettre à jour l'UI en temps réel.

**Acceptance Criteria:**

**Given** un `taskId` de génération v2
**When** j'utilise `useSSEPipelineProgress(taskId)`
**Then** je reçois un objet avec :
  - currentOffer, totalOffers, currentPhase, currentStep
  - completedOffers: [{ id, cvFileId, cvFileName }]
  - failedOffers: [{ id, error, creditsRefunded }]
  - status: "running" | "completed" | "failed"

**Given** un événement SSE `offer_progress`
**When** il est reçu
**Then** le hook met à jour currentOffer, currentPhase, currentStep

**Given** un événement SSE `offer_completed`
**When** il est reçu
**Then** le hook ajoute l'offre à completedOffers

**Given** un événement SSE `offer_failed`
**When** il est reçu
**Then** le hook ajoute l'offre à failedOffers

**Given** un événement SSE `completed`
**When** il est reçu
**Then** le hook met status: "completed"

---

### Story 3.4: Concurrence par Type de Tâche

As a utilisateur,
I want pouvoir lancer d'autres types de tâches pendant qu'une génération est en cours,
So that je ne sois pas bloqué par une longue génération.

**Acceptance Criteria:**

**Given** une génération CV v2 en cours (cv_generation type)
**When** je lance un import PDF (pdf_import type)
**Then** l'import démarre immédiatement en parallèle
**And** les deux tâches s'exécutent simultanément

**Given** une génération CV v2 en cours
**When** je lance une AUTRE génération CV v2
**Then** je reçois une erreur `task_type_already_running`
**And** la nouvelle génération est refusée (un seul type cv_generation à la fois)

**Given** 3 types de tâches différentes en cours (cv_generation, pdf_import, cv_translation)
**When** je lance un 4ème type (match_score)
**Then** je reçois une erreur `max_concurrent_types_reached`
**And** le message indique d'attendre qu'une tâche termine

**Given** le fichier `lib/backgroundTasks/jobQueue.js`
**When** je l'inspecte
**Then** il contient :
  - `canStartTaskType(userId, taskType)` → vérifie si le type peut démarrer
  - `registerTaskTypeStart(userId, taskType)` → enregistre le début
  - `registerTaskTypeEnd(userId, taskType)` → enregistre la fin
  - `activeTaskTypes` Map pour le tracking

**Given** une tâche qui termine (succès ou échec)
**When** `registerTaskTypeEnd` est appelé
**Then** le slot du type est libéré
**And** une nouvelle tâche de ce type peut démarrer

---

### Story 3.5: Persistance & Reprise après Fermeture

As a utilisateur,
I want retrouver mes tâches en cours après avoir fermé l'application,
So that je ne perde pas le travail en cours.

**Acceptance Criteria:**

**Given** une génération en cours
**When** je ferme l'onglet/navigateur
**Then** la génération continue sur le serveur
**And** les résultats sont persistés normalement

**Given** une génération qui termine pendant que j'étais absent
**When** je reviens sur l'application
**Then** je vois la tâche comme "Terminée" dans TaskQueueModal
**And** les CV générés sont accessibles dans ma liste

**Given** le composant TaskQueueModal au montage
**When** il s'initialise
**Then** il charge les tâches récentes depuis l'API `/api/background-tasks`
**And** il établit la connexion SSE pour les updates temps réel

**Given** une tâche avec status `running` en base mais aucun SSE depuis 5 minutes
**When** le frontend détecte le timeout
**Then** il rafraîchit le status depuis l'API
**And** il affiche le status réel (completed/failed)

---

### Story 3.6: Traductions Pipeline (fr/en/de/es)

As a utilisateur,
I want voir les étapes du pipeline dans ma langue,
So that je comprenne la progression.

**Acceptance Criteria:**

**Given** l'application en français
**When** je vois le pipeline progress
**Then** les étapes sont affichées : Classification, Expériences, Projets, Extras, Compétences, Résumé, Finalisation

**Given** l'application en anglais
**When** je vois le pipeline progress
**Then** les étapes sont affichées : Classification, Experiences, Projects, Extras, Skills, Summary, Finalizing

**Given** les messages de progression
**When** ils sont affichés
**Then** ils sont traduits :
  - "Génération ({current}/{total})" / "Generating ({current}/{total})"
  - "CV prêt pour l'offre {index}" / "CV ready for offer {index}"
  - "{count} CV générés" / "{count} CVs generated"
  - "Échec pour l'offre {index} - {credits} crédit remboursé"

**Given** les fichiers locales/fr.json, locales/en.json, locales/de.json, locales/es.json
**When** j'ajoute les traductions
**Then** elles sont sous la clé `taskQueue.steps.*` et `taskQueue.messages.*`

---

## Epic 4: Review & Validation des Modifications

L'utilisateur peut voir les modifications IA apportées au CV, comprendre les raisons de chaque changement, et accepter ou refuser chaque modification avant application finale.

**FRs couverts:** FR19, FR20, FR21, FR22, FR23
**Dépend de:** Epic 1

---

### Story 4.1: Structure des Modifications avec Raisons IA

As a système,
I want stocker chaque modification avec son "avant", "après" et la raison IA,
So that l'utilisateur puisse comprendre et valider chaque changement.

**Acceptance Criteria:**

**Given** un batch qui adapte une expérience
**When** le prompt IA génère le résultat
**Then** le résultat inclut pour chaque champ modifié :
  - field, before, after, reason, action: "modified"

**Given** un skill supprimé
**When** le batch skills s'exécute
**Then** la modification est enregistrée avec :
  - field: "hard_skills", item, action: "removed", reason

**Given** un skill ajouté (justifiable par l'expérience)
**When** le batch skills s'exécute
**Then** la modification est enregistrée avec :
  - field: "soft_skills", item, action: "added", reason

**Given** le CV généré
**When** je consulte `CvGenerationOffer.batchResults`
**Then** chaque section contient un tableau `modifications[]` avec toutes les modifications traçables

**Given** un champ non modifié (conservé tel quel)
**When** le batch s'exécute
**Then** aucune entrée n'est créée dans modifications[] pour ce champ

---

### Story 4.2: Vue Diff Visuelle

As a utilisateur,
I want voir les modifications du CV dans une interface diff claire,
So that je puisse comparer l'avant et l'après facilement.

**Acceptance Criteria:**

**Given** un CV généré avec des modifications
**When** j'ouvre la page de review
**Then** je vois les sections du CV avec les modifications mises en évidence :
  - Texte ajouté en vert avec fond légèrement vert
  - Texte supprimé en rouge barré avec fond légèrement rouge
  - Texte modifié avec l'ancien en rouge et le nouveau en vert

**Given** une section avec plusieurs modifications
**When** je la consulte
**Then** chaque modification est listée individuellement
**And** je peux cliquer sur une modification pour voir le détail

**Given** une modification individuelle
**When** je clique dessus ou la survole
**Then** je vois : La valeur "Avant" complète, La valeur "Après" complète, La raison IA

**Given** une section sans modification (education, header sauf current_title)
**When** je consulte la vue diff
**Then** la section est affichée en mode "non modifié" (grisée ou pliée)

**Given** les modifications groupées par section
**When** je navigue dans la vue
**Then** je vois les sections dans l'ordre : Summary, Expériences, Projets, Skills, Extras, Langues

---

### Story 4.3: Accept/Reject Individuel

As a utilisateur,
I want accepter ou refuser chaque modification individuellement,
So that je garde le contrôle sur mon CV final.

**Acceptance Criteria:**

**Given** une modification affichée dans la vue diff
**When** je la regarde
**Then** je vois deux boutons : "Accepter" et "Refuser"

**Given** une modification
**When** je clique sur "Accepter"
**Then** la modification est marquée comme acceptée (visuellement : bordure verte, icône checkmark)
**And** l'état est sauvegardé localement (state React)

**Given** une modification
**When** je clique sur "Refuser"
**Then** la modification est marquée comme refusée (visuellement : bordure rouge, icône X)
**And** la valeur "Avant" sera conservée dans le CV final

**Given** une modification déjà acceptée
**When** je clique sur "Refuser"
**Then** l'état bascule vers "refusée"
**And** je peux changer d'avis autant de fois que nécessaire avant validation finale

**Given** une modification sans décision (ni acceptée ni refusée)
**When** je tente de valider le CV
**Then** je suis averti qu'il reste des modifications non reviewées
**And** je peux choisir de les accepter par défaut ou continuer la review

**Given** le compteur de modifications
**When** je review les modifications
**Then** je vois "X/Y modifications reviewées" mis à jour en temps réel

---

### Story 4.4: Accept All / Reject All

As a utilisateur,
I want accepter ou refuser toutes les modifications d'un coup,
So that je puisse aller plus vite si je fais confiance à l'IA.

**Acceptance Criteria:**

**Given** la vue diff avec des modifications
**When** je regarde l'interface
**Then** je vois un bouton "Tout accepter" en haut de page

**Given** des modifications non reviewées
**When** je clique sur "Tout accepter"
**Then** TOUTES les modifications passent en statut "acceptée"
**And** le compteur affiche "Y/Y modifications reviewées"

**Given** la vue diff
**When** je regarde l'interface
**Then** je vois aussi un bouton "Tout refuser" (moins proéminent)

**Given** des modifications
**When** je clique sur "Tout refuser"
**Then** TOUTES les modifications passent en statut "refusée"
**And** le CV final sera identique au CV source

**Given** des modifications partiellement reviewées (certaines acceptées, certaines refusées)
**When** je clique sur "Tout accepter"
**Then** seules les modifications non encore décidées sont acceptées
**And** mes décisions précédentes sont préservées

**Given** chaque section individuellement
**When** je la regarde
**Then** je vois "Accepter toutes les modifs de cette section" en option

---

### Story 4.5: Application Sélective des Changements

As a utilisateur,
I want appliquer uniquement les modifications acceptées au CV final,
So that mon CV reflète exactement ce que j'ai validé.

**Acceptance Criteria:**

**Given** des modifications reviewées (certaines acceptées, certaines refusées)
**When** je clique sur "Valider et sauvegarder"
**Then** le système construit le CV final en appliquant :
  - Les valeurs "après" pour les modifications acceptées
  - Les valeurs "avant" (originales) pour les modifications refusées

**Given** une modification de titre acceptée et une modification de responsibilities refusée
**When** le CV final est construit
**Then** le titre utilise la nouvelle valeur
**And** les responsibilities utilisent la valeur originale

**Given** le CV final construit
**When** la sauvegarde s'exécute
**Then** le `CvFile.content` est mis à jour avec le contenu final
**And** une nouvelle `CvVersion` est créée avec origin `user_review`
**And** les décisions (accept/reject par modification) sont loguées

**Given** un skill ajouté par l'IA mais refusé par l'utilisateur
**When** le CV final est construit
**Then** le skill N'EST PAS présent dans le CV final

**Given** un skill supprimé par l'IA mais refus de la suppression par l'utilisateur
**When** le CV final est construit
**Then** le skill EST présent dans le CV final (restauré)

**Given** la validation terminée
**When** le CV est sauvegardé
**Then** l'utilisateur voit un message de confirmation
**And** il peut télécharger/exporter le CV final
**And** l'événement télémétrie `CV_CHANGES_REVIEWED` est déclenché (Epic 5)

---

## Epic 5: Administration & Télémétrie

L'administrateur peut configurer les modèles IA utilisés par phase du pipeline et suivre la qualité des générations via la télémétrie.

**FRs couverts:** FR24, FR25, FR26, FR27, FR28
**Dépend de:** Epic 1, Epic 4 (pour CV_CHANGES_REVIEWED)

---

### Story 5.1: Carte Settings "Pipeline CV v2 Models"

As an administrateur,
I want configurer le modèle IA utilisé pour chaque phase du pipeline,
So that je puisse optimiser le rapport qualité/coût par étape.

**Acceptance Criteria:**

**Given** la page Admin > Settings
**When** je consulte la section "Modèles IA"
**Then** je vois un nouveau groupe "Pipeline CV v2" avec 6 settings :
  - Classification, Expériences, Projets, Extras, Compétences, Summary

**Given** un setting du Pipeline CV v2
**When** je clique dessus
**Then** je peux sélectionner un modèle parmi les options disponibles :
  - gpt-4o-mini (défaut, économique)
  - gpt-4o (plus puissant, plus cher)
  - gpt-4-turbo (si disponible)

**Given** le fichier `lib/admin/settingsConfig.js`
**When** j'inspecte AI_MODELS_STRUCTURE
**Then** je vois le groupe 'Pipeline CV v2' avec les 6 settings

**Given** le fichier SETTING_LABELS
**When** j'inspecte les labels
**Then** je vois des labels lisibles en français

**Given** un setting modifié
**When** je sauvegarde
**Then** le nouveau modèle est utilisé pour les prochaines générations
**And** les générations en cours ne sont pas affectées

---

### Story 5.2: Event Télémétrie CV_CHANGES_REVIEWED

As an administrateur,
I want tracker le ratio accept/reject des modifications IA,
So that je puisse mesurer la qualité des générations.

**Acceptance Criteria:**

**Given** un utilisateur qui valide son CV review (Epic 4, Story 4.5)
**When** il clique sur "Valider et sauvegarder"
**Then** un événement télémétrie `CV_CHANGES_REVIEWED` est enregistré

**Given** l'événement CV_CHANGES_REVIEWED
**When** il est créé
**Then** il contient :
  - eventName: "CV_CHANGES_REVIEWED"
  - featureName: "cv_generation_v2"
  - userId
  - metadata: taskId, offerId, totalModifications, accepted, rejected, acceptRatio, bySection

**Given** la télémétrie existante dans `lib/telemetry/`
**When** j'ajoute l'événement
**Then** il utilise trackEvent() existant
**And** il respecte le consentement cookies de l'utilisateur (NFR8)

**Given** un utilisateur qui n'a pas accepté les cookies
**When** il valide son CV
**Then** l'événement N'EST PAS enregistré
**And** le CV est quand même sauvegardé normalement

---

### Story 5.3: Tracking featureName cv_generation_v2

As an administrateur,
I want identifier toutes les générations pipeline v2 dans la télémétrie,
So that je puisse les analyser séparément des générations legacy.

**Acceptance Criteria:**

**Given** une génération via le pipeline v2
**When** la tâche démarre
**Then** un événement télémétrie est enregistré avec :
  - eventName: "CV_GENERATION_STARTED"
  - featureName: "cv_generation_v2"
  - metadata: taskId, totalOffers, mode

**Given** une génération qui termine (succès)
**When** le CV est créé
**Then** un événement télémétrie est enregistré avec :
  - eventName: "CV_GENERATION_COMPLETED"
  - featureName: "cv_generation_v2"
  - metadata: taskId, offerId, durationMs, phaseDurations

**Given** une génération qui échoue
**When** l'échec est confirmé (après 3 retries)
**Then** un événement télémétrie est enregistré avec :
  - eventName: "CV_GENERATION_FAILED"
  - featureName: "cv_generation_v2"
  - metadata: taskId, offerId, failedPhase, failedStep, error, retryCount

**Given** les requêtes d'analyse
**When** je filtre par featureName = 'cv_generation_v2'
**Then** j'obtiens uniquement les événements du nouveau pipeline
**And** je peux calculer : taux de succès, durée moyenne, phase la plus lente

---

### Story 5.4: Métriques Durée et Statut par Phase

As an administrateur,
I want voir les métriques détaillées de chaque phase et subtask,
So that je puisse identifier les goulots d'étranglement.

**Acceptance Criteria:**

**Given** chaque CvGenerationSubtask créée
**When** la subtask s'exécute
**Then** les champs suivants sont remplis :
  - status: pending → running → completed/failed
  - durationMs: temps d'exécution en millisecondes
  - promptTokens: nombre de tokens du prompt
  - completionTokens: nombre de tokens de la réponse
  - modelUsed: modèle IA effectivement utilisé

**Given** une subtask terminée
**When** je consulte la base de données
**Then** je peux agréger par type et calculer AVG(durationMs), AVG(tokens)

**Given** les métriques agrégées
**When** je les analyse
**Then** je peux identifier :
  - Quelle phase est la plus lente (durationMs)
  - Quelle phase consomme le plus de tokens (coût)
  - Quel modèle est utilisé par phase

**Given** une tâche complète
**When** je calcule les métriques
**Then** je peux reconstituer :
  - Temps total = somme des durationMs de toutes les subtasks
  - Coût estimé = somme des (tokens × prix par token du modèle)

**Given** le champ retryCount dans CvGenerationSubtask
**When** une subtask échoue et retry
**Then** retryCount est incrémenté à chaque tentative
**And** je peux analyser le taux d'échecs par phase
