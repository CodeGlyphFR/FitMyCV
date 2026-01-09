# Projet a Adapter

## Projet Source (index {projectIndex})

```json
{projectJson}
```

{movedFromExperienceNote}

## Offre d'Emploi Cible

**Titre du poste:** {jobTitle}

**Technologies requises:**
{requiredSkills}

**Technologies appreciees:**
{niceToHaveSkills}

## Langue de sortie

Le CV adapte doit etre redige en **{targetLanguage}**.

## Ta Tache

Adapte ce projet pour qu'il corresponde mieux a l'offre d'emploi.

**Champs a remplir obligatoirement:**
- **name**: Nom du projet
- **role**: Ton role sur ce projet (Createur, Developpeur, Architecte, etc.)
- **start_date**: Date de debut (format YYYY-MM)
- **end_date**: Date de fin (format YYYY-MM ou "present" si en cours)
- **summary**: Description du projet (reformulee pour l'offre)
- **tech_stack**: Technologies utilisees (reordonnees par pertinence)
- **url**: URL ou null

**Regles:**
- Si c'est une experience convertie (`_fromExperience: true`), utilise `_originalExperience` pour extraire toutes les informations
- Deduis le **role** depuis le titre de l'experience originale
- Combine description, responsibilities et deliverables en un **summary** coherent
- Ne jamais inventer de donnees - reformuler, reordonner et filtrer uniquement

Reponds en JSON valide avec tous les champs requis.
