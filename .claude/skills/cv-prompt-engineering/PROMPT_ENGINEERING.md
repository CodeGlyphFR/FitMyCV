# Prompt Engineering pour GPT

Guide des techniques d'ecriture de prompts efficaces pour la generation de CV.

---

## 1. Structure d'un prompt systeme

Un prompt systeme efficace suit cette structure :

```
1. ROLE           → Qui est l'IA (expert en quoi)
2. CONTEXTE       → Situation, objectif global
3. MISSION        → Tache precise a accomplir
4. REGLES         → Contraintes et interdictions
5. FORMAT         → Structure de sortie attendue
6. EXEMPLES       → Illustrations du resultat (optionnel)
```

### Exemple de structure

```markdown
# ROLE
Tu es un expert en recrutement et redaction de CV pour le marche francais.

## CONTEXTE
Tu aides des candidats a optimiser leur CV pour des offres d'emploi specifiques.

## MISSION
Adapter le CV fourni pour maximiser le match avec l'offre d'emploi.

## REGLES
- Ne jamais inventer d'experience ou competence
- Utiliser le vocabulaire de l'offre
- ...

## FORMAT DE SORTIE
Retourner un JSON avec la structure suivante :
...
```

---

## 2. Techniques de redaction

### 2.1 Etre explicite, pas implicite

**Mauvais :**
```
Ameliore le CV.
```

**Bon :**
```
Reformule chaque bullet point d'experience avec :
- Un verbe d'action a l'infinitif en debut de phrase
- La tache realisee en 5-10 mots
- Un resultat chiffre si disponible dans le CV source
```

### 2.2 Utiliser des contraintes negatives

Les interdictions sont souvent plus claires que les permissions.

**Efficace :**
```
NE PAS :
- Inventer des competences non presentes dans le CV source
- Ajouter des metriques fictives
- Utiliser des superlatifs (exceptionnel, irreprochable)
- Depasser 5 bullet points par experience
```

### 2.3 Definir des criteres mesurables

**Vague :**
```
Ecris une accroche percutante.
```

**Mesurable :**
```
Ecris une accroche de 2-3 phrases (max 50 mots) qui :
1. Presente le profil en une phrase (X ans d'experience en Y)
2. Mentionne 2-3 competences cles alignees avec l'offre
3. Indique l'objectif professionnel lie au poste
```

### 2.4 Hierarchiser les instructions

Utiliser des marqueurs de priorite :

```
**REGLE CRITIQUE** : Le CV doit etre en {langue}.

**IMPORTANT** : Ne jamais modifier les dates ou noms d'entreprises.

**RECOMMANDE** : Privilegier les verbes d'action.
```

### 2.5 Gerer les cas limites

Anticiper les situations ambigues :

```
## CAS PARTICULIERS

**Profil junior (< 3 ans experience)** :
- Mettre en avant formation et projets
- Detailler stages et alternances
- Insister sur competences transversales

**Profil senior (> 15 ans experience)** :
- Synthetiser les experiences anciennes (> 15 ans)
- Focus sur les 10 dernieres annees
- Mettre en avant leadership et resultats strategiques

**Reconversion professionnelle** :
- Identifier les competences transferables
- Valoriser formations recentes
- Adapter le titre au nouveau domaine
```

---

## 3. Format de sortie

### 3.1 Toujours specifier le format

```
## FORMAT DE SORTIE

Retourne un objet JSON valide avec cette structure :

{
  "section": {
    "champ": "valeur"
  },
  "reasoning": "Explication courte des choix"
}
```

### 3.2 Utiliser des exemples concrets

```
**Exemple de sortie attendue :**

{
  "header": {
    "current_title": "Developpeur Full-Stack React/Node.js"
  },
  "summary": {
    "description": "5 ans d'experience en developpement web..."
  }
}
```

### 3.3 Definir le comportement par defaut

```
**Si aucune modification necessaire :**
{
  "modifications": {},
  "reasoning": "CV deja optimise pour cette offre."
}

**Si donnees manquantes :**
{
  "error": "CV source incomplet",
  "missing": ["experiences", "skills"]
}
```

---

## 4. Optimisation des tokens

### 4.1 Instructions de concision

```
## OPTIMISATION TOKENS

- Retourner UNIQUEMENT les sections modifiees
- Omettre les arrays vides
- Pas de commentaires dans le JSON
- Reasoning en 1-2 phrases max
```

### 4.2 Eviter la repetition

Utiliser des references plutot que repeter :

```
Appliquer les regles de la section COMPETENCES pour :
- hard_skills
- soft_skills
- tools
```

---

## 5. Gestion des erreurs et hallucinations

### 5.1 Ancrer dans les donnees source

```
**REGLE ANTI-HALLUCINATION**

Toute information generee DOIT etre :
1. Presente dans le CV source, OU
2. Directement deductible des experiences listees

Exemples de deductions valides :
- "Gestion d'equipe" → si le CV mentionne "management de 5 personnes"
- "Anglais professionnel" → si experiences dans entreprises internationales

Exemples de deductions INVALIDES :
- Ajouter "Python" car le candidat est developpeur
- Inventer un pourcentage d'amelioration
```

### 5.2 Demander une justification

```
Pour chaque competence ajoutee, indiquer la source :
{
  "skill": "Leadership",
  "source": "Experience X : management equipe 10 personnes"
}
```

---

## 6. Variables et placeholders

### 6.1 Convention de nommage

```
{variableCamelCase}     → Donnees injectees
{INCLUDE:path/file.md}  → Inclusion de fichier
```

### 6.2 Variables courantes

| Variable | Description |
|----------|-------------|
| `{cvContent}` | CV source au format JSON |
| `{jobOffer}` | Offre d'emploi (texte ou JSON) |
| `{targetLanguage}` | Langue de sortie (fr, en, de...) |
| `{cvSchema}` | Schema JSON de reference |

---

## 7. Checklist qualite prompt

Avant de finaliser un prompt, verifier :

- [ ] **Role defini** : L'IA sait qui elle est
- [ ] **Mission claire** : Une tache principale, pas plusieurs
- [ ] **Regles explicites** : Ce qu'il faut faire ET ne pas faire
- [ ] **Format specifie** : Structure de sortie documentee
- [ ] **Exemples fournis** : Au moins un exemple de sortie
- [ ] **Cas limites geres** : Junior, senior, reconversion
- [ ] **Anti-hallucination** : Interdiction d'inventer
- [ ] **Tokens optimises** : Pas de repetition inutile
