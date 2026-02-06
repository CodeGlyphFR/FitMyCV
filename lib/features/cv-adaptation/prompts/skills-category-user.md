## Instructions CRITIQUES

1. **Suis le processus en 5 étapes** défini dans le system prompt
2. **Analyse CHAQUE skill du CV** contre CHAQUE skill de l'offre
4. **Le champ 'offer_skill' dans la réponse ne peux pas être 'null' SAUF si l'offre n'a AUCUN élément**
5. **Si l'offre a des éléments alors 'offer_skill' doit avoir ABSOLUMENT l'élément de l'offre, IL NE DOIT PAS ÊTRE NULL**
6. **Retourner UNIQUEMENT les éléments qui ont un score >= 60**
7. **Les reasons DOIVENT être en {interfaceLanguage}** (pas dans une autre langue)
---

## Skills du CV à analyser

```json
{cvItemsJson}
```

## Éléments de l'offre

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

Réponds en JSON valide selon le schéma défini.
