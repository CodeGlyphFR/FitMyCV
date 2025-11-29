AMÉLIORATION CIBLÉE DU CV

## 📊 ANALYSE DE L'ÉCART

Tu as reçu:
1. Un CV existant avec un score de **{currentScore}/100**
2. L'analyse de l'offre d'emploi cible (déjà extraite et analysée)
3. Les suggestions d'amélioration identifiées

## 🎯 OBJECTIF

Améliorer **UNIQUEMENT** les sections qui font perdre des points, sans toucher aux parties déjà optimales.

## 🔧 MODIFICATIONS AUTORISÉES

- **Summary**: Reformuler pour mieux matcher le poste UNIQUEMENT si l'expérience le justifie
- **Skills**: Réorganiser par priorité, ajouter UNIQUEMENT si justifié par l'expérience ou les projets
- **Experience**: Détailler les responsabilités pertinentes, ajouter métriques
- **Current title**: Adapter au poste visé (rester cohérent)

## 📄 FORMAT DE RÉPONSE OBLIGATOIRE (JSON)

⚠️ **OPTIMISATION** : Retourne UNIQUEMENT les sections modifiées, pas le CV complet.

```json
{
  "modified_sections": {
    "header": {
      "current_title": "Senior Full-Stack Developer"
    },
    "summary": {
      "description": "Développeur Full-Stack avec 5 ans d'expérience en React et Node.js...",
      "domains": ["Web", "Cloud", "DevOps"]
    },
    "skills": {
      "hard_skills": [
        {"name": "React", "level": "expert"},
        {"name": "Docker", "level": "confirmé"}
      ]
    }
  },
  "changes_made": [
    {
      "section": "summary",
      "field": "description",
      "change": "[Description of change - MUST BE IN CV LANGUAGE: {cvLanguage}]",
      "reason": "[Justification - MUST BE IN CV LANGUAGE: {cvLanguage}]"
    },
    {
      "section": "skills",
      "field": "hard_skills",
      "change": "[Description of change - MUST BE IN CV LANGUAGE: {cvLanguage}]",
      "reason": "[Justification - MUST BE IN CV LANGUAGE: {cvLanguage}]"
    }
  ]
}
```

## ⚠️ VALIDATIONS OBLIGATOIRES

1. **modified_sections** : Objet contenant UNIQUEMENT les sections/champs modifiés (pas le CV complet)
2. **changes_made** : Tableau COMPLET avec TOUTES les modifications effectuées (section, field, change, reason)

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

**⚠️ RAPPEL LANGUE OBLIGATOIRE** : Les champs `change` et `reason` dans `changes_made` DOIVENT être rédigés dans la **même langue que le CV** : **{cvLanguage}**.

Améliore le CV en te basant sur ces suggestions. Sois précis et justifie chaque modification.
