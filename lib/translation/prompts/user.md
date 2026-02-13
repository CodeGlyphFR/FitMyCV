TRADUCTION DE CV

Traduis le CV JSON suivant en **{targetLanguage}**.

## INSTRUCTIONS DÉTAILLÉES

### 1. TRADUIRE

- Tous les textes descriptifs (descriptions, responsabilités, résumés, etc.)
- Les titres de poste, noms d'entreprises (sauf noms propres)
- Les noms de compétences techniques si applicable
- Les labels et descriptions de projets
- Les titres de formation et domaines d'études
- Les noms de langues dans la section `languages` (ex: "Français" → "French", "Anglais" → "English")
- Les niveaux de langue dans la section `languages` (ex: "Courant" → "Fluent", "Bilingue" → "Bilingual")

### 2. NE PAS TRADUIRE

- Noms de personnes
- Emails et numéros de téléphone
- URLs et liens
- Codes pays (FR, US, GB, etc.)
- Dates (format YYYY-MM ou YYYY)
- Noms de technologies et outils (JavaScript, Python, Docker, AWS, etc.)
- Métadonnées techniques (generated_at, created_at, etc.)
- Noms propres d'entreprises internationales connues
- Niveaux CECRL (A1, A2, B1, B2, C1, C2) - codes internationaux
- Noms des champs JSON (clés)

### 3. STRUCTURE

- Préserve **EXACTEMENT** la structure JSON
- Ne supprime et n'ajoute **aucun champ**
- Garde les tableaux vides tels quels
- Préserve les valeurs `null`

---

## CV À TRADUIRE

{cvContent}

---

{INCLUDE:_shared/response-format.md}
