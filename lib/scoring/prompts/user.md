Analyse ce CV par rapport à l'offre d'emploi et retourne le score de correspondance.

{INCLUDE:_shared/scoring-rules.md}

---

## CV ACTUEL

```json
{cvContent}
```

---

## CONTENU DE L'OFFRE D'EMPLOI

{jobOfferContent}

---

**⚠️ RAPPEL LANGUE OBLIGATOIRE** : Tous les champs textuels dans ta réponse JSON (`suggestions[].title`, `suggestions[].suggestion`, `missing_skills[]`, `matching_skills[]`) DOIVENT être rédigés dans la **même langue que le CV** : **{cvLanguage}**.

Analyse l'offre et compare avec le CV. Sois précis dans tes suggestions.
