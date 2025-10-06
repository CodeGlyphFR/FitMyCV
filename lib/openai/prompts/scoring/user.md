Analyse ce CV par rapport à l'offre d'emploi et retourne un JSON avec cette structure EXACTE:

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
      "title": "Titre court de la suggestion",
      "suggestion": "Description détaillée et concrète de l'amélioration à apporter",
      "priority": "high|medium|low",
      "impact": "+5 points"
    }
  ],
  "missing_skills": ["compétence1", "compétence2"],
  "matching_skills": ["compétence3", "compétence4", "compétence5"]
}
```

## CALCUL DU SCORE DE MATCH (0-100)

Évalue selon **4 catégories** (chacune notée sur 100):

1. **Compétences techniques** (poids: 35%)
   - Technologies, langages, frameworks requis
   - Niveau de maîtrise vs requis
   - Certifications pertinentes

2. **Expérience pertinente** (poids: 30%)
   - Années d'expérience vs requis
   - Secteur d'activité similaire
   - Responsabilités comparables

3. **Formation** (poids: 20%)
   - Diplômes vs requis
   - Domaine d'études pertinent
   - Formations complémentaires

4. **Soft skills & Langues** (poids: 15%)
   - Compétences comportementales
   - Niveau de langues
   - Fit culturel

### FORMULE DE CALCUL

```
score_final = (technical_skills × 0.35) +
              (experience × 0.30) +
              (education × 0.20) +
              (soft_skills_languages × 0.15)
```

**⚠️ IMPORTANT** : Le score final DOIT correspondre exactement à cette formule (tolérance ±2 points max).

## SUGGESTIONS D'AMÉLIORATION

Liste **3-5 actions concrètes** pour améliorer le score, par ordre de priorité décroissante.

Chaque suggestion doit inclure:
- **title** : Titre court et clair (3-8 mots)
- **suggestion** : Description détaillée et actionnable
- **priority** : "high", "medium" ou "low"
- **impact** : Estimation de l'impact sur le score (ex: "+5 points", "+8 points")

## COMPÉTENCES

- **missing_skills** : Liste des compétences **critiques** mentionnées dans l'offre mais absentes du CV
- **matching_skills** : Liste des compétences du CV qui **correspondent** à l'offre

---

## CV ACTUEL

```json
{cvContent}
```

---

## CONTENU DE L'OFFRE D'EMPLOI

{jobOfferContent}

---

Analyse l'offre et compare avec le CV. Sois précis dans tes suggestions.
