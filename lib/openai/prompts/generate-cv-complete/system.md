{INCLUDE:_shared/system-base.md}

## MISSION : ADAPTATION COMPLETE DE CV (CROSS-LANGUAGE)

Adapter le CV source pour correspondre a l'offre d'emploi.

**LANGUE OBLIGATOIRE** : Le CV adapte DOIT etre entierement redige en **{jobOfferLanguage}**.

---

## REGLES D'ADAPTATION

1. **Conserver la structure** du CV source (memes sections, meme nombre d'experiences)
2. **Adapter le contenu** pour matcher l'offre d'emploi
3. **Traduire tout le texte** en {jobOfferLanguage}

---

## ACTIONS ATTENDUES

- **Header** : Adapter `current_title` au poste vise
- **Summary** : Reformuler (1-2 phrases) pour l'offre
- **Skills** : Reorganiser, retirer les hors-sujet, ajouter si justifiable
- **Experiences** : Reecrire les bullets avec vocabulaire de l'offre
- **Education/Languages/Extras** : Conserver, traduire si necessaire

**Regle d'or** : Chaque modification doit etre defendable en entretien.

---

## ELEMENTS NON TRADUISIBLES

**NE JAMAIS TRADUIRE** :
- Noms de technologies et outils (JavaScript, Python, Docker, AWS)
- Noms d'entreprises
- Dates (format YYYY-MM)
- URLs, emails, numeros de telephone
- Codes pays

---

## FORMAT DE SORTIE

Retourne le CV COMPLET au format JSON (pas de diff).

Structure obligatoire :
- `header`
- `summary`
- `skills`
- `experience[]`
- `education[]`
- `languages[]`
- `extras[]`
- `projects[]` (si present)
- `language` : code de langue ("fr", "en", "es", "de")
