IMPORT ET STRUCTURATION DE CV PDF

Analyse le CV PDF fourni et remplis le template JSON vierge avec les informations extraites.

## INSTRUCTIONS DÉTAILLÉES

### 0. GLOBAL

- Les dates seront sous le format **YYYY-MM** ou **YYYY** si pas de mois stipulé
- Pour la région, **ne fais pas d'abréviation**

### 1. HEADER

Informations personnelles :
- **full_name** : nom et prénom complets
- **current_title** : titre professionnel actuel
- **contact.email** : adresse email
- **contact.phone** : numéro de téléphone avec le code pays (exemple +33...)
- **contact.links** : liens professionnels (LinkedIn, portfolio, etc.)
- **contact.location** : ville, région, code pays

### 2. SUMMARY

- **description** : résumé professionnel ou objectif de carrière
- **domains** : domaines d'expertise (tableau de strings)

### 3. SKILLS

⚠️ **CRUCIAL** : Il est **INDISPENSABLE** de déterminer le niveau de chaque **hard_skills** et de chaque **tools** UNIQUEMENT.

Cette information doit être **ABSOLUMENT** dans le champ **proficiency** et NON dans le **name** entre parenthèses.

Pour déterminer le niveau, tu DOIS **analyser l'expérience professionnelle**.

- **hard_skills** : compétences techniques spécialisées sans commentaires
  - Détermine à partir de l'expérience le niveau de chaque compétence pour remplir le champ **proficiency**
  - **Ne mets pas d'outils/logiciels** dans les hard_skills

- **soft_skills** : compétences comportementales sans commentaires

- **tools** : outils et technologies maîtrisés sans commentaires
  - Détermine à partir de l'expérience le niveau de chaque compétence pour remplir le champ **proficiency**

- **methodologies** : méthodologies de travail si il y en a eu (exemple: Agile, SCRUM, Management, etc.)

### 4. EXPERIENCE

Tableau d'objets avec :
- **title** : intitulé du poste
- **company** : nom de l'entreprise
- **start_date** / **end_date** : dates au format 'YYYY-MM' ou 'YYYY'
  - Si la end_date correspond à aujourd'hui, écrire **'present'**
- **description** : description brève de la mission
- **responsibilities** : liste des responsabilités de la mission
- **deliverables** : liste des livrables produits
- **skills_used** : compétences appliquées sur la mission
- **location** : localise dans l'expérience le lieu de la mission
  - **city** : ville
  - **region** : région
  - **country_code** : code pays

### 5. EDUCATION

Formation avec diplômes, écoles, années.

- **institution**, **degree**, **field_of_study**, **location**
- Si indication mentionnant que c'est en cours, écrire **'present'** dans end_date
- **IMPORTANT** : Si start_date et end_date sont identiques (même année), ne remplir que **end_date** et laisser **start_date vide**

### 6. LANGUAGES

Langues avec niveaux.

- Remplir les champs **name** et **level**

### 7. PROJECTS

Projets personnels **UNIQUEMENT** si précisé dans le CV.

- Laisser vide si ce n'est pas le cas

### 8. EXTRAS

Informations complémentaires (certifications, hobbies, etc.) **UNIQUEMENT** si précisé.

- Laisser vide si ce n'est pas le cas

---

## TEMPLATE JSON À REMPLIR

Respecte exactement cette structure :

```json
{cvSchema}
```

---

## CONTENU DU CV EXTRAIT DU PDF

```
{pdfText}
```

---

## ⚠️ IMPORTANT

- Remplis le champ **'generated_at'** avec la date actuelle au format ISO
- **Ne modifie pas** les champs 'order_hint' et 'section_titles'
- Réponds **UNIQUEMENT** avec le JSON final complet, sans texte avant ou après
