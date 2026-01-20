# FORMAT DE SCORING UNIFIÉ

Ce document décrit le format standard utilisé pour tous les scores de correspondance CV/offre.

## CALCUL DU SCORE DE MATCH (0-100)

Évalue selon **4 catégories** (chacune notée sur 100):

| Catégorie | Poids | Description |
|-----------|-------|-------------|
| **technical_skills** | 35% | Technologies, langages, frameworks, outils requis |
| **experience** | 30% | Années d'expérience, secteur d'activité, responsabilités |
| **education** | 20% | Diplômes, domaine d'études, certifications |
| **soft_skills_languages** | 15% | Compétences comportementales + langues |

### FORMULE DE CALCUL

```
score_final = (technical_skills × 0.35) +
              (experience × 0.30) +
              (education × 0.20) +
              (soft_skills_languages × 0.15)
```

**⚠️ IMPORTANT** : Le score final DOIT correspondre exactement à cette formule (tolérance ±2 points max).

**Exemple** :
```
(80 × 0.35) + (73 × 0.30) + (75 × 0.20) + (67 × 0.15)
= 28 + 21.9 + 15 + 10.05
= 74.95
≈ 75
```

## STRUCTURE JSON DU SCORE

```json
{
  "match_score": 75,
  "score_breakdown": {
    "technical_skills": 80,
    "experience": 73,
    "education": 75,
    "soft_skills_languages": 67
  },
  "suggestions": [
    {
      "title": "Titre court de la suggestion (3-8 mots)",
      "suggestion": "Description détaillée et actionnable de l'amélioration",
      "priority": "high|medium|low",
      "impact": "+5 points"
    }
  ],
  "missing_skills": ["compétence1", "compétence2"],
  "matching_skills": ["compétence3", "compétence4", "compétence5"]
}
```

## DÉTAILS DES CHAMPS

### `match_score` (number)
- **Type**: Entier entre 0 et 100
- **Description**: Score global de correspondance
- **Calcul**: Moyenne pondérée des 4 catégories selon la formule ci-dessus

### `score_breakdown` (object)
Détail du score par catégorie. **Chaque score est sur 100** (pas sur le poids).

⚠️ **Nom de clé** : `soft_skills_languages` (pas `soft_skills` seul)

### `suggestions` (array)
Liste de **max 3-4 suggestions** d'amélioration par ordre de priorité décroissante.

Chaque suggestion contient:
- `title` (string) : Titre court et clair (3-8 mots)
- `suggestion` (string) : Description détaillée et actionnable
- `priority` (enum) : "high" | "medium" | "low"
- `impact` (string) : Estimation de l'impact (ex: "+5 points", "+8 points")

### `missing_skills` (array<string>)
Liste des compétences **critiques** (inclus les hard skills, les soft skills, les tools et les methodogies) mentionnées dans l'offre mais absentes du CV

### `matching_skills` (array<string>)
Liste des compétences (inclus les hard skills, les soft skills, les tools et les methodogies) du CV qui correspondent à l'offre

## NOTES IMPORTANTES

⚠️ **Scores sur 100** : Chaque catégorie est notée sur 100, pas sur son poids (35, 30, 20, 15)

✅ **Cohérence** : Ce format est utilisé par toutes les fonctions de scoring et génération de CV
