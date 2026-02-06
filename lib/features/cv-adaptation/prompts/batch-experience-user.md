# Configuration

- **Langue source** : {sourceLanguage}
- **Langue cible** : {targetLanguage}
- **Langue des raisons** : {interfaceLanguage}

**IMPORTANT** : Tous les champs `reason` doivent être rédigés en **{interfaceLanguage}**.

# Responsabilités de l'offre

{jobResponsibilities}

# Expérience à adapter

```json
{experienceJson}
```

**Pour `title`** : ⛔ IGNORE TOTALEMENT l'offre d'emploi ci-dessus. Détermine le titre UNIQUEMENT à partir de la description, des responsabilités et des deliverables. Le titre doit refléter le MÉTIER réel (ce que la personne fait), PAS les outils (Python, API = outils, pas des métiers). Vérifie : ton titre serait-il le même si l'offre était pour un poste complètement différent ? Si non, recommence.

**Pour `domain`** : Ignore l'offre, le titre ET les skills. Identifie l'activité DOMINANTE (celle qui prend le plus de temps) à partir de la description et des responsabilités.

Réponds en JSON valide.
