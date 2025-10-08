# INSTRUCTIONS DÉTAILLÉES POUR REMPLIR LE TEMPLATE JSON

## 0. GLOBAL

- Les dates seront sous le format **YYYY-MM** ou **YYYY** si pas de mois stipulé
- Pour la région, **ne fais pas d'abréviation**

## 1. HEADER

Informations personnelles :
- **full_name** : nom et prénom complets
- **current_title** : titre professionnel actuel
- **contact.email** : adresse email professionnelle (format: prenom.nom@exemple.com)
- **contact.phone** : numéro de téléphone avec le code pays (ex: +33 6 12 34 56 78)
- **contact.location** : objet avec city, region, country_code (ex: "Paris", "Île-de-France", "FR")
- **contact.links** : tableau d'objets avec type, label, url (ex: LinkedIn, GitHub, Portfolio, Site web)
  - **type** : le type de lien (linkedin, github, portfolio, website, etc.)
  - **label** : le texte affiché (ex: "LinkedIn", "GitHub", "Portfolio")
  - **url** : l'URL complète (ex: "https://linkedin.com/in/john-doe")

## 2. SUMMARY

- **headline** : titre/accroche courte et percutante (1 ligne)
- **description** : résumé professionnel détaillé adapté au poste (2-3 phrases)
- **years_experience** : nombre d'années d'expérience (nombre)
- **domains** : domaines d'expertise (tableau de strings)
- **key_strengths** : forces clés / atouts principaux (tableau de strings, 3-5 éléments)

## 3. SKILLS

⚠️ **CRUCIAL** : Il est **INDISPENSABLE** de déterminer le niveau de chaque **hard_skills** et de chaque **tools** UNIQUEMENT.

Cette information doit être **ABSOLUMENT** dans le champ **proficiency** et NON dans le **name** entre parenthèses.

- **hard_skills** : compétences techniques spécialisées avec niveau (name, proficiency)
  - Détermine le niveau en fonction de l'expérience professionnelle
  - **Ne mets pas d'outils/logiciels** dans les hard_skills

- **soft_skills** : compétences comportementales (tableau de strings)

- **tools** : outils et technologies maîtrisés avec niveau (name, proficiency)
  - Détermine le niveau en fonction de l'expérience professionnelle

- **methodologies** : méthodologies de travail si pertinent (Agile, SCRUM, Management, etc.)

## 4. EXPERIENCE

Tableau d'expériences professionnelles avec :
- **title** : intitulé du poste
- **company** : nom de l'entreprise
- **department_or_client** : département ou client si pertinent
- **start_date** / **end_date** : dates au format 'YYYY-MM' ou 'YYYY'
  - Si la end_date correspond à aujourd'hui, écrire **'present'**
- **location** : objet avec city, region, country_code
- **description** : description brève de la mission
- **responsibilities** : liste des responsabilités de la mission
- **deliverables** : liste des livrables produits
- **skills_used** : compétences appliquées sur la mission

## 5. EDUCATION

Formation avec diplômes, écoles, années :
- **institution** : nom de l'établissement
- **degree** : diplôme obtenu
- **field_of_study** : domaine d'études
- **location** : objet avec city, region, country_code
- **start_date** / **end_date** : années au format 'YYYY'
  - Si indication mentionnant que c'est en cours, écrire **'present'** dans end_date
  - **IMPORTANT** : Si start_date et end_date sont identiques (même année), ne remplir que **end_date** et laisser **start_date vide**

## 6. LANGUAGES

Langues avec niveaux :
- **name** : nom de la langue
- **level** : niveau de maîtrise

## 7. PROJECTS

Projets personnels **UNIQUEMENT** si pertinent pour le poste :
- **name** : nom du projet
- **role** : rôle/fonction sur le projet
- **summary** : description du projet
- **tech_stack** : technologies utilisées (tableau de strings)
- **keywords** : mots-clés du projet (tableau de strings)
- **start_date** / **end_date** : dates au format 'YYYY-MM' ou 'YYYY'

## 8. EXTRAS

Informations complémentaires **UNIQUEMENT** si pertinent (certifications, hobbies, distinctions) :
- **name** : titre de l'information (ex: "Certification AWS", "Bénévolat", "Distinctions")
- **summary** : description détaillée

## 9. MÉTADONNÉES

- **generated_at** : date actuelle au format **YYYY-MM-DD**
- **order_hint** et **section_titles** : **NE PAS MODIFIER** ces champs
