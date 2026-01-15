# Exemples et Patterns de Prompts

Exemples concrets de prompts bien structures pour la generation de CV.

---

## 1. Pattern : Definition de role

### Mauvais
```
Tu es une IA qui aide avec les CV.
```

### Bon
```
Tu es un expert en recrutement et optimisation de CV pour le marche francais.

Tu maitrises :
- Les systemes ATS (Applicant Tracking System) et leurs criteres de parsing
- Les conventions de CV francais (structure, ton, longueur)
- L'adaptation de CV aux offres d'emploi specifiques
- La redaction professionnelle qui reste naturelle et humaine
```

---

## 2. Pattern : Instructions d'adaptation CV

### Structure recommandee

```markdown
## MISSION

Adapter le CV source pour maximiser le match avec l'offre d'emploi.

## OBJECTIF

Chaque modification doit :
1. Augmenter la pertinence par rapport a l'offre
2. Rester 100% veridique et defendable en entretien
3. Utiliser le vocabulaire et les mots-cles de l'offre

## ACTIONS ATTENDUES

### Header
- Adapter le titre au poste vise
- Conserver les coordonnees intactes

### Accroche (2-3 lignes)
- Phrase 1 : Presentation (X ans d'experience en Y)
- Phrase 2 : Competences cles alignees avec l'offre
- Phrase 3 : Objectif professionnel (optionnel)

### Experiences
- Reformuler les bullets avec le vocabulaire de l'offre
- Format : [Verbe infinitif] + [Tache] + [Resultat chiffre si disponible]
- Maximum 5 bullets par experience
- Conserver toutes les experiences (ne pas supprimer)

### Competences
- Reorganiser par pertinence (plus pertinent en premier)
- Retirer les competences hors-sujet
- Ajouter UNIQUEMENT si justifiable par le CV source
```

---

## 3. Pattern : Regles anti-hallucination

```markdown
## REGLES CRITIQUES - ANTI-HALLUCINATION

**INTERDIT :**
- Inventer des experiences ou responsabilites non presentes dans le CV
- Ajouter des competences sans justification dans le parcours
- Creer des metriques ou chiffres fictifs
- Attribuer des certifications non mentionnees
- Exagerer les niveaux de competence

**AUTORISE :**
- Reformuler le contenu existant avec le vocabulaire de l'offre
- Deduire une competence si clairement demontree par une experience
  Exemple : "Management de 5 personnes" → peut ajouter "Leadership"
- Reorganiser l'ordre des elements pour prioriser la pertinence

**REGLE D'OR :**
Chaque ligne du CV doit etre defendable en entretien.
Si le candidat ne peut pas l'expliquer, ne pas l'inclure.
```

---

## 4. Pattern : Gestion des profils

```markdown
## ADAPTATION SELON LE PROFIL

### Detection du profil

Analyser le CV source pour determiner :
- **Junior** : < 3 ans d'experience OU jeune diplome
- **Confirme** : 3-10 ans d'experience
- **Senior** : > 10 ans d'experience OU postes de direction

### Regles par profil

**JUNIOR :**
- Accroche : Mettre en avant formation et motivation
- Experiences : Detailler stages, alternances, projets etudiants
- Competences : Insister sur les competences techniques acquises
- Formation : Section detaillee (projets, specialites, mentions)

**CONFIRME :**
- Accroche : Expertise + realisation cle + objectif
- Experiences : Focus sur resultats chiffres et responsabilites
- Competences : Equilibre hard skills / soft skills / outils
- Formation : Liste simple, valoriser certifications recentes

**SENIOR :**
- Accroche : Vision strategique + impact business majeur
- Experiences : Synthetiser avant 15 ans, detailler les recentes
- Competences : Leadership, transformation, gestion du changement
- Formation : Minimaliste, sauf formations executives recentes
```

---

## 5. Pattern : Format de sortie JSON

### Modifications differentielles (recommande)

```markdown
## FORMAT DE SORTIE

Retourner UNIQUEMENT les modifications, pas le CV complet.

### Structure

{
  "modifications": {
    "header": {
      "current_title": "Nouveau titre adapte"
    },
    "summary": {
      "description": "Nouvelle accroche..."
    },
    "skills": {
      "hard_skills": {
        "add": [{"name": "Competence", "proficiency": "Intermediate"}],
        "remove": ["Competence obsolete"],
        "reorder": ["Skill1", "Skill2", "Skill3"]
      }
    },
    "experience": {
      "updates": [{
        "index": 0,
        "changes": {
          "responsibilities": {
            "update": [{"index": 0, "value": "Nouveau bullet reformule"}]
          }
        }
      }]
    }
  },
  "reasoning": "Explication en 1-2 phrases des choix principaux."
}

### Regles d'optimisation

- Section sans modification → NE PAS inclure
- Array vide → NE PAS inclure
- Retourner {} si aucune modification necessaire
```

---

## 6. Pattern : Exemples de sortie

### Toujours fournir un exemple concret

```markdown
## EXEMPLE DE SORTIE ATTENDUE

**CV source :** Developpeur web avec 3 ans d'experience
**Offre :** Developpeur Full-Stack React/Node.js

**Sortie :**
{
  "modifications": {
    "header": {
      "current_title": "Developpeur Full-Stack React/Node.js"
    },
    "summary": {
      "description": "3 ans d'experience en developpement web moderne. Expertise React et Node.js avec forte appétence pour les architectures API REST."
    },
    "skills": {
      "hard_skills": {
        "reorder": ["React", "Node.js", "TypeScript", "JavaScript"],
        "remove": ["WordPress", "PHP"]
      }
    },
    "experience": {
      "updates": [{
        "index": 0,
        "changes": {
          "responsibilities": {
            "update": [
              {"index": 0, "value": "Developper des composants React reutilisables pour l'interface utilisateur"},
              {"index": 1, "value": "Concevoir des API REST avec Node.js et Express"}
            ]
          }
        }
      }]
    }
  },
  "reasoning": "Titre aligne sur le poste, competences React/Node.js mises en avant, WordPress retire car hors-sujet."
}
```

---

## 7. Pattern : Accroche par type de profil

### Templates d'accroche

```markdown
## GENERATION D'ACCROCHE

### Junior
"[Diplome/Formation] avec [X] experience(s) en [domaine].
Competences en [skill 1], [skill 2] et [skill 3] acquises lors de [contexte].
Motive par [element de l'offre qui vous attire]."

**Exemple :**
"Diplome d'une ecole d'ingenieurs avec 2 stages en developpement web.
Competences en React, Node.js et methodologies Agile.
Recherche un premier poste pour contribuer a des projets innovants."

### Confirme
"[X] ans d'experience en [domaine principal], specialise en [expertise].
[Realisation majeure avec chiffre si disponible].
Objectif : [ambition alignee avec le poste]."

**Exemple :**
"6 ans d'experience en developpement Full-Stack, specialise React/Node.js.
Conception d'une plateforme e-commerce generant 2M€ de CA annuel.
Objectif : rejoindre une equipe technique ambitieuse en tant que Lead Developer."

### Senior
"[Titre/Expertise] avec [X]+ ans d'experience en [secteur].
Expert en [domaine 1], [domaine 2] et [domaine 3].
[Impact strategique majeur : transformation, croissance, etc.]."

**Exemple :**
"Directeur Technique avec 18 ans d'experience dans l'edition logicielle.
Expert en architecture cloud, transformation digitale et management d'equipes tech.
Pilotage de la migration cloud de 3 produits SaaS, reduisant les couts de 40%."
```

---

## 8. Pattern : Bullet points d'experience

### Transformation avant/apres

```markdown
## REFORMULATION DES EXPERIENCES

### Regle
[Verbe infinitif] + [Tache precise] + [Resultat/Impact si disponible]

### Exemples de transformation

**Avant :** "Responsable du developpement frontend"
**Apres :** "Developper l'interface utilisateur React (15 ecrans)"

**Avant :** "J'ai gere une equipe de developpeurs"
**Apres :** "Encadrer une equipe de 5 developpeurs, +30% de productivite"

**Avant :** "Participation a la mise en place du CI/CD"
**Apres :** "Deployer le pipeline CI/CD, reduisant le temps de release de 2h a 15min"

**Avant :** "Travail sur l'amelioration des performances"
**Apres :** "Optimiser les requetes SQL, temps de reponse API divise par 3"

### Verbes par domaine

**Tech :** Developper, Concevoir, Deployer, Optimiser, Migrer, Automatiser
**Management :** Piloter, Coordonner, Encadrer, Recruter, Former
**Business :** Negocier, Conclure, Generer, Augmenter, Reduire
**Analyse :** Analyser, Auditer, Diagnostiquer, Evaluer, Mesurer
```

---

## 9. Pattern : Gestion des langues

```markdown
## POLITIQUE DE LANGUE

### Regle principale
Le CV DOIT etre entierement redige dans la langue de l'offre d'emploi : {targetLanguage}

### Exceptions - NE PAS traduire
- Noms de technologies : JavaScript, Python, Docker, AWS
- Noms d'entreprises et ecoles
- Acronymes techniques : API, SQL, HTML, CSS
- Certifications : AWS Certified, PMP, TOEIC
- Dates (format YYYY-MM)
- URLs, emails, numeros de telephone

### Niveaux de langue a utiliser
- A1/A2 : Notions, Debutant
- B1/B2 : Intermediaire, Professionnel
- C1 : Avance, Courant
- C2 : Bilingue, Langue maternelle

Ou utiliser : Notions / Lu-ecrit / Courant / Bilingue
```

---

## 10. Checklist de validation prompt

Utiliser cette checklist pour valider un prompt avant mise en production :

```markdown
## VALIDATION DU PROMPT

### Structure
- [ ] Role clairement defini
- [ ] Mission explicite et unique
- [ ] Regles positives ET negatives
- [ ] Format de sortie specifie
- [ ] Au moins un exemple concret

### Contenu metier
- [ ] Regles CV francais respectees
- [ ] Adaptation par profil (junior/confirme/senior)
- [ ] Contraintes ATS mentionnees
- [ ] Verbes d'action recommandes
- [ ] Style d'ecriture defini

### Anti-hallucination
- [ ] Interdiction explicite d'inventer
- [ ] Ancrage dans les donnees source
- [ ] Critere "defendable en entretien"

### Optimisation
- [ ] Instructions de concision
- [ ] Gestion des cas vides
- [ ] Variables bien definies
```
