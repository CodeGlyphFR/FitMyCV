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
- Si le contenu est déjà dans la langue cible et correctement aligné, utilise `action: "kept"`

Réponds en JSON valide.
