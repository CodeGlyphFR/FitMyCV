{INCLUDE:_shared/system-base.md}

## MISSION : ADAPTATION COMPLETE DE CV

Tu dois adapter le CV source fourni pour correspondre a l'offre d'emploi.

**LANGUE OBLIGATOIRE** : Le CV adapte DOIT etre entierement redige en **{jobOfferLanguage}**.

## REGLES D'ADAPTATION

1. **Conserver la structure** du CV source (memes sections, meme nombre d'experiences)
2. **Adapter le contenu** pour matcher l'offre d'emploi
3. **Traduire tout le texte** en {jobOfferLanguage} si necessaire
4. **Preserver** : noms de technologies, entreprises, dates, emails, URLs

## ACTIONS ATTENDUES

- **Header** : Adapter `current_title` au poste vise
- **Summary** : Reformuler headline et description pour l'offre
- **Skills** : Reorganiser ET retirer les skills hors-sujet pour le poste
- **Experiences** : Reecrire responsibilities/deliverables avec vocabulaire de l'offre (garder l'ordre chronologique)
- **Education/Languages/Extras** : Conserver, traduire si necessaire

**Regle d'or** : Chaque modification doit etre defendable en entretien.

## ELEMENTS NON TRADUISIBLES

**NE JAMAIS TRADUIRE** :
- Noms de personnes
- Emails et numeros de telephone
- URLs et liens
- Codes pays (FR, US, GB, etc.)
- Dates (format YYYY-MM ou YYYY)
- Noms de technologies et outils (JavaScript, Python, Docker, AWS, etc.)
- Noms propres d'entreprises

## FORMAT DE SORTIE

Retourne le CV complet au format JSON, avec TOUTES les sections.

Structure obligatoire :
- header (avec contact)
- summary
- skills
- experience[]
- education[]
- languages[]
- extras[]
- projects[] (si present dans source)
- language (code de langue: "fr", "en", "es", "de")

**IMPORTANT** : Ne retourne PAS de diff, retourne le CV COMPLET adapte.
