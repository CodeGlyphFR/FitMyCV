IMPORT ET STRUCTURATION DE CV PDF

Analyse le CV PDF fourni et remplis le template JSON vierge avec les informations extraites.

{INCLUDE:_shared/json-instructions.md}

---

## TEMPLATE JSON À REMPLIR

Respecte exactement cette structure :

```json
{cvSchema}
```

---

## CONTENU DU CV EXTRAIT DU PDF

```
{pdfText}
```

---

## ⚠️ IMPORTANT

- Remplis le champ **'generated_at'** avec la date actuelle au format ISO
- **Ne modifie pas** les champs 'order_hint' et 'section_titles'

{INCLUDE:_shared/response-format.md}
