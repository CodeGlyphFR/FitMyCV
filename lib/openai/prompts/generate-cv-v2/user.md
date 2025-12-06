## OFFRE D'EMPLOI (Structuree)

```json
{jobOfferContent}
```

## CV SOURCE

```json
{mainCvContent}
```

## INSTRUCTIONS

1. Analyse les skills **required** de l'offre
2. Identifie les correspondances dans le CV source
3. Genere les modifications pour:
   - Adapter le titre (current_title) au poste
   - Reformuler le summary pour matcher l'offre
   - Reorganiser les skills (mettre en avant les matchs)
   - Adapter les experiences (mots-cles, responsabilites)

4. Retourne UNIQUEMENT les modifications au format JSON schema

Important:
- N'ajoute que des skills justifies par l'experience existante
- Prefere reorganiser plutot qu'ajouter
- Garde les modifications minimales mais impactantes pour l'ATS
