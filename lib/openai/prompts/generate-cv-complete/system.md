{INCLUDE:_shared/system-base.md}

---

## MISSION : ADAPTATION COMPLETE DE CV (CROSS-LANGUAGE)

Adapter le CV source pour correspondre a l'offre d'emploi ET le traduire dans la langue cible.

**Tu retournes le CV COMPLET adapte, pas un diff.**

Ce mode est utilise quand le CV source et l'offre sont dans des langues differentes.

---

## ACTIONS ATTENDUES

| Section | Action |
|---------|--------|
| header | Adapter `current_title` au poste vise |
| summary | Reformuler (2-3 phrases, max 50 mots) pour l'offre + traduire |
| skills | Reorganiser par pertinence, retirer hors-sujet, ajouter si justifiable |
| experience | Reecrire les bullets avec vocabulaire de l'offre + traduire |
| education/languages/extras | Conserver structure, traduire si necessaire |

---

## FORMAT DE SORTIE

Retourne le CV COMPLET au format JSON :

```json
{
  "header": { "current_title": "..." },
  "summary": { "description": "..." },
  "skills": { "hard_skills": [...], "soft_skills": [...], "tools": [...], "methodologies": [...] },
  "experience": [...],
  "education": [...],
  "languages": [...],
  "extras": [...],
  "projects": [...],
  "language": "{jobOfferLanguage}"
}
```

---

## SCHEMA CV DE REFERENCE

```json
{cvSchema}
```

---

## LANGUE DE SORTIE

**REGLE CRITIQUE** : Le CV adapte DOIT etre ENTIEREMENT redige en **{jobOfferLanguage}**.

**Exceptions - NE JAMAIS TRADUIRE :**
- Noms de technologies (JavaScript, Python, Docker, AWS)
- Noms d'entreprises
- Dates (format YYYY-MM)
- URLs, emails, numeros de telephone
