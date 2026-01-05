# Criteres d'Analyse des Generations CV

Grille d'evaluation pour analyser la qualite des modifications proposees par l'IA.

---

## 1. Analyse des SUPPRESSIONS

### Regle fondamentale
Une suppression est VALIDE si et seulement si la competence est **hors-sujet complet** par rapport au poste.

### Matrice de decision

| Type de poste | Competences a TOUJOURS garder |
|---------------|-------------------------------|
| **IA / GenAI / ML** | OpenAI, Claude, LLM, Agents IA, Python, TensorFlow, PyTorch, Prompt Engineering, APIs |
| **DevOps / Cloud** | Docker, Kubernetes, Linux, AWS, GCP, Azure, CI/CD, Terraform |
| **Developpeur** | Git, langages utilises, frameworks, Linux, Docker |
| **Data** | Python, SQL, Excel, outils BI, statistiques |
| **Management** | Gestion de projet, coordination, leadership |

### Erreurs frequentes de l'IA

| Suppression | Pourquoi c'est faux |
|-------------|---------------------|
| "OpenAI API" pour poste GenAI | OpenAI = LLM = GenAI, c'est LE coeur du metier |
| "Claude API" pour poste GenAI | Meme chose, c'est un LLM |
| "Git" pour poste dev | Git est universel pour tout dev |
| "Linux" pour poste cloud | Linux est la base du cloud |
| "Python" pour poste IA | Python est LE langage de l'IA |

### Comment detecter une mauvaise suppression

1. Identifier le DOMAINE de l'offre (IA, DevOps, Dev, Data, etc.)
2. Verifier si la competence supprimee appartient au meme domaine
3. Si OUI → suppression INVALIDE

---

## 2. Analyse des AJOUTS (Hallucinations)

### Regle fondamentale
Un ajout est VALIDE si et seulement s'il est **prouvable** par le CV source.

### Types d'hallucinations

| Type | Description | Exemple |
|------|-------------|---------|
| **Technologie inventee** | Ajout d'une techno non presente | Ajouter "AWS" quand le CV dit "serveur personnel" |
| **Niveau exagere** | Surcoter une competence | Passer de "Intermediate" a "Expert" sans preuve |
| **Methodologie inventee** | Ajouter MLOps, DevOps sans preuve | Ajouter "MLOps" quand le CV dit juste "deploiement" |
| **Responsabilite inventee** | Ajouter des bullets fictifs | "Deployer sur AWS" quand jamais fait |

### Deductions VALIDES vs INVALIDES

| CV source mentionne | Deduction VALIDE | Deduction INVALIDE |
|---------------------|------------------|---------------------|
| "Serveur personnel" | Administration systeme | AWS, GCP, Cloud |
| "Claude Code" | Experience LLM | MLOps industriel |
| "Deploiement modeles" | CI/CD basique | MLOps/LLMOps formel |
| "Gestion equipe 5 pers" | Leadership | "Management 50 pers" |

---

## 3. Analyse du SUMMARY

### Structure attendue (2-3 phrases, max 50 mots)

1. **Phrase 1** : [TOTAL] ans d'experience + specialisation recente
2. **Phrase 2** : Expertise en [competences de l'offre QUE LE CANDIDAT A]
3. **Phrase 3** : (optionnel) Realisation chiffree

### Erreurs frequentes

| Probleme | Description | Solution |
|----------|-------------|----------|
| **Trop generique** | "7 ans d'experience en tech" | Ajouter la specialite specifique |
| **Perte de personnalite** | Supprime les elements differenciants | Garder ce qui rend le candidat unique |
| **Buzzwords vides** | "Expert en solutions innovantes" | Termes concrets et verifiables |
| **Non-aligne offre** | Ne reprend pas le vocabulaire | Utiliser les termes de l'offre |

### Test du summary

Le summary passe le test si :
- [ ] Il mentionne le nombre d'annees d'experience
- [ ] Il utilise au moins 2 termes de l'offre
- [ ] Il garde un element differenciateur du candidat
- [ ] Il est defendable en entretien (pas d'exageration)

---

## 4. Analyse des EXPERIENCES

### Reformulations valides

| Avant | Apres | Verdict |
|-------|-------|---------|
| "Responsable du developpement" | "Developper l'interface React" | OK - plus precis |
| "Gerer une equipe" | "Encadrer 5 developpeurs" | OK - chiffre du CV |
| "Travailler sur le cloud" | "Deployer sur AWS/GCP" | INVALIDE si pas dans CV |

### Regles de reformulation

1. **Verbe infinitif** : Toujours commencer par un verbe d'action
2. **Vocabulaire offre** : Utiliser les termes de l'offre si applicable
3. **Chiffres conserves** : Ne jamais inventer de metriques
4. **Essence preservee** : Le sens original doit rester intact

---

## 5. Analyse du TITRE

### Regle
Le titre doit etre adapte mais rester honnete.

| CV source | Offre | Titre adapte | Verdict |
|-----------|-------|--------------|---------|
| Dev fullstack | Dev React Senior | Dev React | OK |
| Chef de projet | Ingenieur GenAI | ??? | Attention - changement de metier |
| Junior Python | Lead Python | Junior Python | NE PAS sur-titrer |

---

## 6. Score global

Calculer un score de qualite :

| Critere | Points | Max |
|---------|--------|-----|
| Pas de suppressions invalides | +3 par critere OK | 15 |
| Pas d'hallucinations | +3 par section OK | 15 |
| Summary de qualite | Sur 10 | 10 |
| Reformulations pertinentes | Sur 10 | 10 |
| Titre adapte correctement | Sur 5 | 5 |

**Score total : /55**

| Score | Qualite |
|-------|---------|
| 45-55 | Excellent |
| 35-44 | Bon |
| 25-34 | A ameliorer |
| < 25 | Problemes majeurs |
