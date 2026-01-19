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
- **contact.links** : tableau d'objets avec label et url (ex: LinkedIn, GitHub, Portfolio, Site web)
  - **label** : le texte affiché (ex: "LinkedIn", "GitHub", "Portfolio")
  - **url** : l'URL complète (ex: "https://linkedin.com/in/john-doe")

## 2. SUMMARY

- **description** : C'est le "Who am I" du CV (2-3 phrases). Résumé professionnel décrivant le profil, les compétences clés et le domaine d'expertise.

## 3. SKILLS

### ⛔ ERREURS COURANTES À ÉVITER (CRITIQUE - LIRE EN PREMIER)

**❌ NE JAMAIS mettre de LOGICIELS dans hard_skills → Ils vont dans tools :**

| Catégorie | Logiciels (→ tools, PAS hard_skills) |
|-----------|--------------------------------------|
| **Bureautique** | Excel, Word, PowerPoint, Google Sheets, Google Docs, Outlook, LibreOffice |
| **CAO/PLM** | CATIA, SolidWorks, AutoCAD, Inventor, Creo, NX, Fusion 360, 3DEXPERIENCE, TeamCenter, Windchill |
| **Simulation** | Matlab, Simulink, Ansys, SPICE, Abaqus, COMSOL, LabVIEW |
| **Design** | Photoshop, Illustrator, InDesign, Figma, Sketch, XD, Canva, After Effects, Premiere Pro |
| **Gestion** | SAP, Salesforce, Jira, Trello, Monday, Asana, MS Project, Notion |
| **Data/BI** | Tableau, Power BI, Jupyter, Google Analytics, Looker, Databricks |
| **Dev** | VS Code, Git, Docker, Postman, Jenkins, IntelliJ, Eclipse |
| **Cloud** | AWS, Azure, GCP, Heroku, Kubernetes, Terraform |

**🔑 Règle simple** : Si c'est un logiciel qu'on peut acheter/télécharger/installer → **tools**

---

### ⚠️ RÈGLE N°1 - CAPITALISATION (À APPLIQUER SYSTÉMATIQUEMENT)

| ❌ Incorrect | ✅ Correct |
|-------------|-----------|
| python | Python |
| javascript | JavaScript |
| cryptographie | Cryptographie |
| systèmes embarqués | Systèmes embarqués |
| machine learning | Machine Learning |
| linux | Linux |
| communication | Communication |
| gestion de projet | Gestion de projet |

**Règles strictes :**
- **Noms propres/marques** : respecter la casse officielle (JavaScript, PostgreSQL, iOS, macOS, 3DEXPERIENCE)
- **Concepts/domaines** : majuscule au premier mot (Cryptographie, Systèmes embarqués, Gestion de projet)
- **Acronymes** : tout en majuscules (CI/CD, API, SQL, UI, UX, MBSE, FEA)
- **Soft skills** : majuscule (Communication, Leadership, Autonomie)

---

⚠️ **CRUCIAL** : Il est **INDISPENSABLE** de déterminer le niveau de chaque **hard_skills** et de chaque **tools** UNIQUEMENT.

Cette information doit être **ABSOLUMENT** dans le champ **proficiency** et NON dans le **name** entre parenthèses.

### Classification des 4 catégories (TOUS DOMAINES)

Pour chaque compétence, pose-toi la question appropriée :

| Catégorie | Question test |
|-----------|---------------|
| **hard_skills** | "Je SAIS faire X" / "Je MAÎTRISE X" |
| **tools** | "J'UTILISE X pour travailler" |
| **soft_skills** | "Je SUIS X" / "J'AI la capacité de X" |
| **methodologies** | "Je TRAVAILLE selon X" / "J'applique le framework X" |

### ⚠️ Décomposition des compétences combinées

Quand une compétence est mentionnée AVEC un outil (ex: "Modélisation Matlab/Simulink"), tu dois **DÉCOMPOSER** et extraire :
1. Le **hard_skill technique sous-jacent** (le savoir-faire abstrait) → dans hard_skills
2. Le **tool** (le logiciel/équipement) → dans tools

| Mention dans le CV | → hard_skill à extraire | → tool à extraire |
|-------------------|-------------------------|-------------------|
| "Modélisation Matlab/Simulink" | MBSE, Modélisation de systèmes | Matlab, Simulink |
| "Simulation SPICE" | Simulation de circuits | SPICE |
| "CAO SolidWorks" | Conception mécanique, CAO | SolidWorks |
| "Analyse de données Excel" | Analyse de données | Excel |
| "Design d'interface Figma" | UI Design | Figma |
| "Gestion de projet MS Project" | Gestion de projet | MS Project |
| "Calcul éléments finis Ansys" | Calcul par éléments finis, FEA | Ansys |
| "Routage PCB Altium" | Conception de PCB, Routage | Altium |

---

- **hard_skills** : Savoir-faire, expertise, compétence technique (name, proficiency)
  - Ce qu'on SAIT faire, ce qu'on MAÎTRISE intellectuellement ou techniquement
  - ✅ IT : Langages (Python, JavaScript, SQL...), Frameworks (React, Django...), Bases de données (PostgreSQL, MongoDB...), Concepts (Machine Learning, API Design, CI/CD...)
  - ✅ Ingénierie : Conception mécanique, Calcul de structures, Thermodynamique, Électronique de puissance...
  - ✅ Finance : Comptabilité, Fiscalité, Audit, Analyse financière, Contrôle de gestion...
  - ✅ Design : UI Design, UX Design, Branding, Typographie, Direction artistique...
  - ✅ Marketing : Marketing digital, SEO, Content Marketing, Growth Hacking...
  - ✅ Management : Gestion de projet, Management d'équipe, Planification, Budgétisation...
  - Détermine le niveau en fonction de l'expérience professionnelle

- **tools** : Logiciels, applications, plateformes, équipements utilisés pour travailler (name, proficiency)
  - Ce qu'on UTILISE comme outil externe pour réaliser son travail
  - ✅ Systèmes d'exploitation : Linux, Windows, macOS, Ubuntu, Debian, Red Hat...
  - ✅ PLM/Plateformes industrielles : 3DEXPERIENCE, CATIA, Enovia, TeamCenter, Windchill, Aras...
  - ✅ Développement : VS Code, Git, Docker, Postman, Jenkins...
  - ✅ Simulation/CAO : Matlab, SPICE, SolidWorks, AutoCAD, Ansys, Simulink...
  - ✅ Cloud/Plateformes : AWS, Azure, GCP, Heroku, Kubernetes...
  - ✅ Gestion : Jira, Trello, MS Project, Notion, Monday, SAP...
  - ✅ Design : Figma, Photoshop, Illustrator, Sketch, InDesign...
  - ✅ Data/BI : Tableau, Power BI, Jupyter, Databricks, Google Analytics...
  - ✅ Bureautique : Excel, Word, PowerPoint, Google Sheets...
  - Détermine le niveau en fonction de l'expérience professionnelle

- **soft_skills** : Qualités personnelles et compétences relationnelles (tableau de strings, PAS de proficiency)
  - Ce qu'on EST, nos traits de caractère et capacités interpersonnelles
  - ✅ Relationnel : Communication, Écoute active, Empathie, Diplomatie, Négociation...
  - ✅ Personnel : Autonomie, Rigueur, Créativité, Curiosité, Résilience, Adaptabilité...
  - ✅ Leadership : Leadership, Esprit d'équipe, Prise de décision, Gestion du stress...
  - ❌ NE PAS METTRE : "Gestion de projet", "Management d'équipe" (ce sont des hard_skills)

- **methodologies** : Frameworks, processus et approches organisationnelles (tableau de strings, PAS de proficiency)
  - La FAÇON dont on travaille, les frameworks qu'on applique
  - ✅ Agile : Agile, SCRUM, Kanban, SAFe, Extreme Programming (XP), Lean Startup...
  - ✅ Qualité : Lean, Six Sigma, Kaizen, TQM, ISO 9001...
  - ✅ IT : DevOps (culture), ITIL, Prince2, Cycle en V, Waterfall...
  - ✅ Design : Design Thinking, Double Diamond, User-Centered Design...
  - ❌ NE PAS METTRE : "Gestion de projet" (c'est un hard_skill), "Leadership" (c'est un soft_skill)

### ⚠️ VÉRIFICATION FINALE OBLIGATOIRE

Avant de finaliser le JSON, RELIS chaque élément de skills et VÉRIFIE que :
- Chaque hard_skill.name commence par une MAJUSCULE
- Chaque tool.name commence par une MAJUSCULE
- Chaque soft_skill commence par une MAJUSCULE
- Chaque methodology commence par une MAJUSCULE

Si tu trouves une minuscule en début de mot, CORRIGE-LA immédiatement.

## 4. EXPERIENCE

### ⚠️ RÈGLE CRITIQUE - NE JAMAIS COMBINER LES EXPÉRIENCES

**Chaque poste/mission = UNE entrée séparée dans le tableau**, même si :
- Plusieurs postes dans la MÊME entreprise → entrées séparées
- Évolution de titre (Junior → Senior → Lead) → entrées séparées
- Missions successives chez le MÊME client → entrées séparées
- Dates qui se chevauchent → entrées séparées

| ❌ INCORRECT (combiné) | ✅ CORRECT (séparé) |
|------------------------|---------------------|
| "Développeur puis Tech Lead chez Entreprise X (2018-2023)" | Entrée 1: "Développeur" (2018-2020) + Entrée 2: "Tech Lead" (2020-2023) |
| "Consultant pour Client A et B" | Entrée 1: Mission Client A + Entrée 2: Mission Client B |

**Règle** : Si le CV source montre N expériences distinctes → le JSON doit avoir N entrées dans `experience[]`

---

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
- **start_date** / **end_date** : dates au format 'YYYY-MM' ou 'YYYY'
- **url** : lien du projet (optionnel) - GitHub, portfolio, démo live
- **url_label** : titre/label du lien (optionnel) - ex: "Voir sur GitHub", "Demo live"

## 8. EXTRAS

Informations complémentaires **UNIQUEMENT** si pertinent (certifications, hobbies, distinctions) :
- **name** : titre de l'information (ex: "Certification AWS", "Bénévolat", "Distinctions")
- **summary** : description détaillée

## 9. MÉTADONNÉES

- **generated_at** : date actuelle au format **YYYY-MM-DD**
- **order_hint** et **section_titles** : **NE PAS MODIFIER** ces champs
