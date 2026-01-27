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

# Competences de l'Offre (REFERENCE STRICTE pour le filtrage)

## Skills Requis (required)
{requiredSkillsList}

## Skills Apprecies (nice_to_have)
{niceToHaveSkillsList}

## Soft Skills Demandes
{softSkillsList}

**⚠️ RAPPEL** : Utiliser ces listes pour le matching strict (Mission 1).
- hard_skills/tools : SUPPRIMER si pas dans "Skills Requis" NI "Skills Apprecies"
- soft_skills : SUPPRIMER si pas dans "Soft Skills Demandes"
- Si une liste est "Non specifie" ou vide → appliquer la regle de sauvegarde

---

# Langues
- **Langue du CV source** : {sourceLanguage}
- **Langue de sortie** : {targetLanguage}
- **Traduction requise** : {needsTranslation}

**⚠️ Si "Traduction requise" = NON** : NE PAS traduire les skills. Garder les noms tels quels (action: `kept`).

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
