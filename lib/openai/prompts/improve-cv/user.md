AMÉLIORATION CIBLÉE DU CV

## 📊 ANALYSE DE L'ÉCART

Tu as reçu:
1. Un CV existant avec un score de **{currentScore}/100**
2. L'analyse de l'offre d'emploi cible (déjà extraite et analysée)
3. Les suggestions d'amélioration identifiées

## 🎯 OBJECTIF

Améliorer **UNIQUEMENT** les sections qui font perdre des points, sans toucher aux parties déjà optimales.

## 📝 RÈGLES D'AMÉLIORATION

{INCLUDE:_shared/cv-improvement-rules.md}

## 🔧 MODIFICATIONS AUTORISÉES

- **Summary**: Reformuler pour mieux matcher le poste UNIQUEMENT si l'expérience le justifie
- **Skills**: Réorganiser par priorité, ajouter UNIQUEMENT si justifié par l'expérience ou les projets
- **Experience**: Détailler les responsabilités pertinentes, ajouter métriques
- **Current title**: Adapter au poste visé (rester cohérent)

## 📐 CALCUL DU NOUVEAU SCORE ESTIMÉ

{INCLUDE:_shared/scoring-rules.md}

## 📄 FORMAT DE RÉPONSE OBLIGATOIRE (JSON)

```json
{
  "improved_cv": {
    // CV amélioré complet avec TOUTES les sections
    // Structure identique au CV d'origine
  },
  "changes_made": [
    {
      "section": "summary",
      "field": "description",
      "change": "Ajouté mention de gestion d'équipe et reformulé pour matcher le poste",
      "reason": "Gestion d'équipe requise dans l'offre et présente dans l'expérience"
    },
    {
      "section": "skills",
      "field": "hard_skills",
      "change": "Ajouté Docker et Kubernetes avec niveau confirmé",
      "reason": "Technologies mentionnées dans l'offre et utilisées dans les projets"
    }
  ],
  "new_score_estimate": 85,
  "improvement_delta": "+10 points",
  "score_breakdown": {
    "technical_skills": 85,
    "experience": 90,
    "education": 80,
    "soft_skills_languages": 75
  },
  "suggestions": [
    {
      "title": "Ajouter métriques de performance",
      "suggestion": "Ajouter des métriques de performance quantifiables dans les expériences professionnelles",
      "priority": "medium",
      "impact": "+2 points"
    }
  ],
  "missing_skills": ["Kubernetes", "TypeScript"],
  "matching_skills": ["React", "Node.js", "Docker", "MongoDB"]
}
```

## ⚠️ VALIDATIONS OBLIGATOIRES

1. **changes_made** : Tableau COMPLET avec TOUTES les modifications effectuées (section, field, change, reason)
2. **score_breakdown** : 4 catégories avec scores sur 100 (pas sur poids)
3. **suggestions** : Nouvelles suggestions d'amélioration restantes (3-5 max)
4. **missing_skills** : Compétences critiques encore manquantes
5. **matching_skills** : Compétences du CV qui correspondent à l'offre
6. **Formule** : VÉRIFIE que le score final correspond à la formule. Si écart > 2 points → ajuste le score_breakdown

---

## OFFRE D'EMPLOI ANALYSÉE

{jobOfferContent}

---

## CV ACTUEL

{cvContent}

---

## SUGGESTIONS D'AMÉLIORATION PRIORITAIRES

{suggestionsText}

---

Améliore le CV en te basant sur ces suggestions. Sois précis et justifie chaque modification.
