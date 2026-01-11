# Compétences Source à Adapter

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

# Instructions

**Langue de sortie:** {targetLanguage}

## Rappel du processus

1. **SCORER** chaque compétence de 0 à 10 selon sa pertinence pour l'offre
2. **SUPPRIMER** celles avec score ≤ 5
3. **AJUSTER** les niveaux des compétences conservées selon l'expérience du candidat

## Règles strictes

- **JAMAIS D'AJOUT** : Tu ne peux que supprimer ou ajuster les niveaux
- Documente chaque suppression avec le score dans la raison (ex: "Score 3/10 - non pertinent")
- Documente chaque ajustement de niveau (ex: "Ajusté de Débutant à Intermédiaire")
- Limite les soft_skills à 6 maximum

Réponds en JSON valide avec le champ `modifications[]` documentant tous les changements.
