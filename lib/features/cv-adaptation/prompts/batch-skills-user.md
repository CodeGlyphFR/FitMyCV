# Skills du CV Source

## Hard Skills (langue: {cvLanguage})
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

# Skills de l'Offre d'Emploi (langue: {jobLanguage})

## Hard Skills
- **Required**: {hardSkillsRequired}
- **Nice to have**: {hardSkillsNiceToHave}

## Tools
- **Required**: {toolsRequired}
- **Nice to have**: {toolsNiceToHave}

## Methodologies
- **Required**: {methodologiesRequired}
- **Nice to have**: {methodologiesNiceToHave}

## Soft Skills
{softSkillsJob}

---

# Langue pour les reasons: {interfaceLanguage}

**CRITICAL INSTRUCTION**: ALL `reason` field values MUST be written in **{interfaceLanguage}** only.
- Do NOT mix languages within reasons
- Do NOT switch to French or any other language
- Every single reason must be in {interfaceLanguage}

---

# Instructions

Suis le processus CoT en 10 étapes défini dans le system prompt.

## Rappels Importants

- **JAMAIS ajouter** de skills qui n'existent pas dans le CV source
- **Maximum 6** soft_skills dans le résultat final
- Les skills supprimés (`action: deleted`) DOIVENT être inclus dans le résultat
- `reason` doit être clair et concis (1 phrase), ou `null` si action=kept et même langue
- **TOUS les skills source doivent être retournés** - ne jamais en omettre, même si deleted
- `skill_final` = skill de l'offre UNIQUEMENT si `action: renamed` (probabilité >= 80%)

---

Réponds en JSON valide selon le schéma défini.
