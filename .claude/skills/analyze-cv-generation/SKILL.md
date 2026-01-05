---
name: analyze-cv-generation
description: Analyser la derniere generation de CV par l'IA pour identifier les problemes de prompting. Utiliser apres un test de generation pour evaluer la qualite des modifications proposees.
---

# Analyse des Generations CV par IA

Ce skill analyse les resultats de la feature "Generation de CV par IA" pour identifier les problemes de prompting et proposer des ameliorations.

## Quand utiliser ce skill

- Apres un test de generation de CV pour evaluer la qualite
- Pour debugger des comportements inattendus de l'IA
- Avant de modifier les prompts pour avoir une baseline
- Pour iterer sur l'amelioration du prompting

## Workflow d'analyse

### Etape 1 : Recuperer les donnees

Executer ces requetes SQL pour obtenir les donnees de la derniere generation :

```bash
# Connexion DB
psql "postgresql://erickdesmet:nrrpjxR77GdzcR0_g@localhost:5432/fitmycv_dev"
```

```sql
-- Lister les dernieres generations avec pendingChanges
SELECT
  cf.id,
  cf.filename,
  cf."updatedAt",
  cf."matchScore",
  jo.content->>'title' as job_title,
  CASE WHEN cf."pendingChanges" IS NOT NULL THEN 'OUI' ELSE 'NON' END as has_pending
FROM "CvFile" cf
LEFT JOIN "JobOffer" jo ON cf."jobOfferId" = jo.id
WHERE cf."jobOfferId" IS NOT NULL
ORDER BY cf."updatedAt" DESC
LIMIT 10;
```

```sql
-- Recuperer les details d'une generation specifique (remplacer ID)
SELECT
  cf.content as cv_source,
  cf."pendingChanges" as modifications_ia,
  jo.content as job_offer
FROM "CvFile" cf
LEFT JOIN "JobOffer" jo ON cf."jobOfferId" = jo.id
WHERE cf.id = '<CV_FILE_ID>';
```

### Etape 2 : Analyser selon les criteres

Voir [ANALYSIS_CRITERIA.md](ANALYSIS_CRITERIA.md) pour la grille d'evaluation.

### Etape 3 : Produire le rapport

Format du rapport d'analyse :

```markdown
## Analyse Generation CV - [DATE]

### Metadata
| Element | Valeur |
|---------|--------|
| Filename | ... |
| Offre | ... |
| Date | ... |

### Problemes identifies

#### 1. [Categorie du probleme]
- Description
- Impact
- Cause probable dans le prompting

### Recommandations
1. ...
2. ...
```

## Criteres d'analyse rapide

### Suppressions a verifier

L'IA ne devrait JAMAIS supprimer :
- Des competences du MEME DOMAINE que l'offre
- Pour un poste IA/ML : OpenAI, Claude, LLM, Agents, Python, etc.
- Pour un poste Dev : Git, Docker, langages de prog utilises
- Des competences transversales : Linux, Administration systeme (pour devops/cloud)

### Ajouts a verifier (hallucinations)

L'IA ne devrait JAMAIS ajouter :
- Des technologies cloud specifiques (AWS, GCP, Azure) non mentionnees dans le CV
- Des methodologies (MLOps, DevOps) sans preuve dans le CV
- Des niveaux de competence exageres

### Summary

Le summary devrait :
- Garder les elements differenciants du candidat
- Utiliser le vocabulaire de l'offre
- Rester authentique et defendable en entretien
- Ne PAS etre generique/fade

## Fichiers de prompts a modifier

Apres analyse, les fichiers a modifier sont dans :
- `lib/openai/prompts/generate-cv/system.md` - Prompt principal mode diff
- `lib/openai/prompts/generate-cv/user.md` - Instructions utilisateur
- `lib/openai/prompts/_shared/system-base.md` - Base commune
- `lib/openai/prompts/_shared/cv-adaptation-rules.md` - Regles d'adaptation
