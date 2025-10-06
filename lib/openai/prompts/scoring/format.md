# Format de Scoring Unifié

Ce document décrit le format standard utilisé pour tous les scores de correspondance CV/offre dans le projet.

## Structure JSON

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
      "title": "Ajouter certification AWS",
      "suggestion": "Obtenir la certification AWS Solution Architect mentionnée comme un atout dans l'offre",
      "priority": "high",
      "impact": "+8 points"
    }
  ],
  "missing_skills": ["Kubernetes", "TypeScript"],
  "matching_skills": ["React", "Node.js", "Docker", "MongoDB"]
}
```

## Champs

### `match_score` (number)
- **Type**: Entier entre 0 et 100
- **Description**: Score global de correspondance
- **Calcul**: Moyenne pondérée des 4 catégories

### `score_breakdown` (object)

Détail du score par catégorie. Chaque score est sur **100** (pas sur le poids).

| Catégorie | Poids | Description |
|-----------|-------|-------------|
| `technical_skills` | 35% | Compétences techniques, technologies, outils |
| `experience` | 30% | Expérience professionnelle pertinente |
| `education` | 20% | Formation, diplômes, certifications |
| `soft_skills_languages` | 15% | Soft skills + langues |

### `suggestions` (array)

Liste de 3-5 suggestions d'amélioration par ordre de priorité.

Chaque suggestion contient:
- `title` (string) : Titre court (3-8 mots)
- `suggestion` (string) : Description détaillée et actionnable
- `priority` (enum) : "high" | "medium" | "low"
- `impact` (string) : Estimation de l'impact (ex: "+5 points")

### `missing_skills` (array<string>)

Liste des compétences **critiques** mentionnées dans l'offre mais absentes du CV.

### `matching_skills` (array<string>)

Liste des compétences du CV qui correspondent à l'offre.

## Formule de calcul

```javascript
score_final =
  (score_breakdown.technical_skills × 0.35) +
  (score_breakdown.experience × 0.30) +
  (score_breakdown.education × 0.20) +
  (score_breakdown.soft_skills_languages × 0.15)
```

**Exemple** :
```
(80 × 0.35) + (73 × 0.30) + (75 × 0.20) + (67 × 0.15)
= 28 + 21.9 + 15 + 10.05
= 74.95
≈ 75
```

## Validation

Le code valide automatiquement que:
1. Tous les scores sont entre 0 et 100
2. Le score final correspond à la formule (±2 points)
3. Si écart > 2 points → correction automatique avec le score calculé

```javascript
const calculatedScore = Math.round(
  (breakdown.technical_skills * 0.35) +
  (breakdown.experience * 0.30) +
  (breakdown.education * 0.20) +
  (breakdown.soft_skills_languages * 0.15)
);

if (Math.abs(calculatedScore - match_score) > 2) {
  // Correction automatique
  match_score = calculatedScore;
}
```

## Notes importantes

⚠️ **Nom de clé** : `soft_skills_languages` (pas `soft_skills` seul)

⚠️ **Scores sur 100** : Chaque catégorie est notée sur 100, pas sur son poids (35, 30, 20, 15)

✅ **Cohérence** : Ce format est utilisé par :
- `generateCvWithScore.js`
- `improveCv.js`
- `calculateMatchScoreWithAnalysis.js`
- `calculateMatchScore.js`
