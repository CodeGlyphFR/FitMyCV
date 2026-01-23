CRÉATION DE CV MODÈLE À PARTIR D'UN TITRE DE POSTE

Analyse le titre de poste fourni : **"{jobTitle}"**

## LANGUE DU CV

**IMPORTANT** : Tu DOIS rédiger TOUT le contenu du CV en **{language}**.

Cela inclut :
- Le titre de poste (current_title)
- Le résumé professionnel (summary)
- Les descriptions d'expériences et responsabilités
- Les soft skills

**EXCEPTIONS** (ne jamais traduire) :
- Noms de technologies (JavaScript, Docker, AWS...)
- Noms d'entreprises et institutions
- URLs et emails
- Niveaux CECRL (A1, B2, C1...)

## OBJECTIF

Crée un CV exemple professionnel qui correspond à ce poste avec :
- Un profil fictif mais **réaliste et professionnel**
- Des expériences **cohérentes** avec le niveau requis (junior, confirmé, senior)
- Les compétences techniques et soft skills **appropriées** pour ce poste
- Une éducation **appropriée** pour le poste
- Un résumé/summary **percutant** adapté au poste

{INCLUDE:_shared/json-instructions.md}

---

## TEMPLATE JSON À SUIVRE STRICTEMENT

{cvSchema}

---

## ⚠️ IMPORTANT

- Remplis le champ **'generated_at'** avec la date actuelle au format **YYYY-MM-DD**
- **Ne modifie pas** les champs 'order_hint' et 'section_titles'
- Le CV doit être **réaliste et professionnel**, pas générique
- Adapte le niveau d'expérience :
  - **Junior** : 1-3 ans
  - **Confirmé** : 3-7 ans
  - **Senior** : 7+ ans

{INCLUDE:_shared/response-format.md}
