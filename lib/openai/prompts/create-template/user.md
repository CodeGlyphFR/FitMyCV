CRÉATION DE CV MODÈLE À PARTIR D'UNE OFFRE D'EMPLOI

## ÉTAPE 1 : ANALYSE DE L'OFFRE

Analyse l'offre d'emploi fournie et identifie :
- Le **titre du poste**
- Les **hard skills et tech skills** requises
- Les **soft skills** importantes
- Le **niveau d'expérience** attendu
- La **langue** de l'offre (français ou anglais)

## ÉTAPE 2 : CRÉATION DU CV MODÈLE

Crée un CV exemple professionnel qui correspond à cette offre avec :
- Un profil fictif mais **réaliste et professionnel**
- Des expériences **cohérentes** avec le niveau requis (junior, confirmé, senior)
- Les compétences techniques et soft skills qui **matchent l'offre**
- Une éducation **appropriée** pour le poste
- Un résumé/summary **percutant** adapté au poste

## 🌍 LANGUE

Le CV doit être rédigé dans la **MÊME LANGUE** que l'offre d'emploi :
- Si l'offre est en **français** → CV en **français**
- Si l'offre est en **anglais** → CV en **anglais**

---

## INSTRUCTIONS DÉTAILLÉES POUR REMPLIR LE TEMPLATE JSON

### 1. HEADER

- **full_name** : nom et prénom complets (fictifs mais réalistes)
- **current_title** : titre professionnel correspondant au poste
- **contact.email** : adresse email professionnelle (format: prenom.nom@exemple.com)
- **contact.phone** : numéro de téléphone avec code pays (ex: +33 6 12 34 56 78)
- **contact.location** : objet avec city, region, country_code (ex: "Paris", "Île-de-France", "FR")
- **contact.links** : tableau d'objets avec type, label, url (ex: LinkedIn, GitHub, Portfolio, Site web)
  - **type** : le type de lien (linkedin, github, portfolio, website, etc.)
  - **label** : le texte affiché (ex: "LinkedIn", "GitHub", "Portfolio")
  - **url** : l'URL complète (ex: "https://linkedin.com/in/john-doe")

### 2. SUMMARY

- **headline** : titre/accroche courte et percutante (1 ligne)
- **description** : résumé professionnel détaillé adapté au poste (2-3 phrases)
- **years_experience** : nombre d'années d'expérience (nombre)
- **domains** : domaines d'expertise correspondant à l'offre (tableau de strings)
- **key_strengths** : forces clés / atouts principaux (tableau de strings, 3-5 éléments)

### 3. SKILLS

- **hard_skills** : compétences techniques avec niveau (name, proficiency)
  - Détermine le niveau en fonction de l'expérience demandée
- **soft_skills** : compétences comportementales (tableau de strings)
- **tools** : outils et technologies avec niveau (name, proficiency)
- **methodologies** : méthodologies de travail si pertinent (Agile, SCRUM, etc.)

### 4. EXPERIENCE

Tableau d'expériences professionnelles avec :
- **title** : intitulé du poste
- **company** : nom de l'entreprise (fictive mais réaliste)
- **department_or_client** : département ou client si pertinent
- **start_date** / **end_date** : dates au format 'YYYY-MM' ou 'YYYY'
- **location** : ville, région, code pays
- **description** : description brève de la mission
- **responsibilities** : liste des responsabilités
- **deliverables** : liste des livrables produits
- **skills_used** : compétences appliquées sur la mission

### 5. EDUCATION

- **institution** : nom de l'établissement
- **degree** : diplôme obtenu
- **field_of_study** : domaine d'études
- **location** : ville, région, code pays
- **start_date** / **end_date** : années au format 'YYYY'

### 6. LANGUAGES

Langues avec niveaux (name, level)

### 7. PROJECTS

Projets personnels **si pertinent** pour le poste :
- **name** : nom du projet
- **role** : rôle/fonction sur le projet
- **summary** : description du projet
- **tech_stack** : technologies utilisées (tableau de strings)
- **keywords** : mots-clés du projet (tableau de strings)
- **start_date** / **end_date** : dates au format 'YYYY-MM' ou 'YYYY'

### 8. EXTRAS

Informations complémentaires **si pertinent** (certifications, hobbies, distinctions) :
- **name** : titre de l'information (ex: "Certification AWS", "Bénévolat", "Distinctions")
- **summary** : description détaillée

---

## TEMPLATE JSON À SUIVRE

{cvSchema}

---

## OFFRE D'EMPLOI

{jobOfferContent}

---

## ⚠️ IMPORTANT

- Remplis le champ **'generated_at'** avec la date actuelle au format **YYYY-MM-DD**
- **Ne modifie pas** les champs 'order_hint' et 'section_titles'
- Le CV doit être **réaliste et professionnel**, pas générique
- Adapte le niveau d'expérience :
  - **Junior** : 1-3 ans
  - **Confirmé** : 3-7 ans
  - **Senior** : 7+ ans
- Fournis **UNIQUEMENT** le JSON, sans texte avant ou après
