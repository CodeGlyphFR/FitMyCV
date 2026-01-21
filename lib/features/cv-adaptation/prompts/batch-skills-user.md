# Competences Source a Adapter

## Hard Skills
```json
{hardSkillsJson}
```

## Soft Skills
```json
{softSkillsJson}
```

## Tools
```json
{toolsJson}
```

## Methodologies
```json
{methodologiesJson}
```

---

# Langue de sortie: {targetLanguage}

## Tes 7 missions

1. **SUPPRIMER** les competences non mentionnees dans l'offre (match semantique)
2. **AJUSTER** les proficiency en NOMBRES (0-5) selon l'experience du candidat
3. **NETTOYER** les noms (parentheses, phrases → mots-cles, max 3 mots)
4. **SPLITTER** les competences multiples (slash, virgule, "et")
5. **REARRANGER** entre hard_skills / tools / methodologies
6. **FUSIONNER** les doublons entre categories
7. **DEDUIRE** les methodologies depuis les experiences (sprints → Scrum, CI/CD → DevOps...)

## Niveaux (NOMBRES uniquement)

| Valeur | Niveau |
|--------|--------|
| 0 | Awareness |
| 1 | Beginner |
| 2 | Intermediate |
| 3 | Proficient |
| 4 | Advanced |
| 5 | Expert |

## Regles

- **ZERO DOUBLON** : chaque competence dans UNE SEULE categorie (hard_skills OU tools OU methodologies)
- Soft skills : **max 6**, juste filtrer par pertinence
- Technos/outils : garder les noms en **anglais**
- Documenter CHAQUE modification dans `modifications[]`

**Question cle pour les doublons** : "C'est quelque chose que je SAIS FAIRE ou que j'UTILISE ?"

Reponds en JSON valide.
