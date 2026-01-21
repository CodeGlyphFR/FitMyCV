# Donnees a Classifier

## Parametres de classification

- **Annee actuelle** : {currentYear}
- **Fenetre temporelle** : {timeWindowYears} ans
- **Annee limite** : {cutoffYear} (experiences terminées avant cette annee = hors fenetre)

## Offre d'emploi cible

- **Titre** : {jobTitle}
- **Skills requis** : {jobSkillsRequired}
- **Soft skills** : {jobSoftSkills}

## Experiences du candidat

```json
{experiencesJson}
```

## Projets du candidat

```json
{projectsJson}
```

## Ta Tache

Pour chaque experience et projet, determine l'action (KEEP, REMOVE, MOVE_TO_PROJECTS) en suivant les regles dans l'ordre :

1. Experience en cours ? → KEEP (ou MOVE_TO_PROJECTS si projet perso)
2. Dans la fenetre (fin >= {cutoffYear}) ? → KEEP (continuite)
3. Hors fenetre mais pertinent ? → KEEP
4. Hors fenetre et non pertinent ? → REMOVE
5. Projet personnel termine ? → MOVE_TO_PROJECTS

Reponds en JSON valide.
