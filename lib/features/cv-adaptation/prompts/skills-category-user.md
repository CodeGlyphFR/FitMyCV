# Catégorie: {categoryDisplayName}

## Skills du CV à analyser (langue: {cvLanguage})

```json
{cvItemsJson}
```

## Éléments de l'offre (langue: {jobLanguage})

```json
{jobItemsJson}
```

---

## Configuration des langues

| Langue | Valeur |
|--------|--------|
| CV source | {cvLanguage} |
| Offre d'emploi |  |
| **Reasons** | **{interfaceLanguage}** |

---

## Instructions CRITIQUES

1. **Suis le processus en 5 étapes** défini dans le system prompt
2. **Analyse CHAQUE skill du CV** contre CHAQUE skill de l'offre
4. **Le champ 'offer_skill' dans la réponse ne peux pas être 'null' SAUF si l'offre n'a AUCUN élément**
5. **Si l'offre a des éléments alors 'offer_skill' doit avoir ABSOLUMENT l'élément de l'offre, IL NE DOIT PAS ÊTRE NULL**
6. **Les reasons DOIVENT être en {interfaceLanguage}** (pas dans une autre langue)
7. **Retourner UNIQUEMENT les éléments qui ont un score >= 60**

---

Réponds en JSON valide selon le schéma défini.
