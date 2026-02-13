# Langues à Adapter

## Langues du CV Source
```json
{languagesJson}
```

## Exigences linguistiques de l'offre
```json
{languageRequirementsJson}
```

## Langue source du CV: {sourceLanguage}
## Langue de sortie: {targetLanguage}

## Ta Tâche

1. **Traduire** les noms et niveaux de langues dans la langue cible ({targetLanguage})
2. **Aligner** les niveaux avec les exigences de l'offre (si une langue du CV correspond à une exigence)
3. **Documenter** toutes tes modifications dans `language_modifications[]`

**IMPORTANT**:
- Ne JAMAIS augmenter artificiellement le niveau (seulement reformuler)
- Utilise `action: "kept"` UNIQUEMENT si name_before = name_after ET level_before = level_after (aucun changement de texte). Toute traduction, même mineure, est `action: "modified"`.

Réponds en JSON valide.
