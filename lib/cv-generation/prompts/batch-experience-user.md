# Experience a Adapter

**Langue de sortie** : {targetLanguage}

```json
{experienceJson}
```

---

# Rappels Critiques

## VERITE (P1)
Chaque mot de ta sortie doit etre TRACABLE vers la source.

**Test** : "Pour chaque mot, puis-je pointer vers l'original?"
- OUI → Reformulation (OK)
- NON → Hallucination (INTERDIT)

## FLUX CHIFFRES
```
responsibilities = ZERO chiffre (taches pures)
deliverables = TOUS ont un chiffre (resultats)
```

**Transformation** :
| Source | responsibilities | deliverables |
|--------|-----------------|--------------|
| "Recruter equipe de 5 dev" | "Recruter une equipe technique" | "5 developpeurs formes" |
| "Piloter projet de 1,2M€" | "Piloter un projet strategique" | "Projet 1,2M€ livre" |

## SKILLS
- **SUPPRIMER** : non pertinentes pour l'offre
- **REFORMULER** : terminologie offre (SI equivalence directe)
- **JAMAIS AJOUTER** : meme si dans l'offre

---

# Champs Obligatoires

- **domain** : Domaine metier (analyse titre, entreprise, responsibilities)
- **years_in_domain** : Utilise la valeur `_calculated_years` fournie

---

# Modifications

Documente tes modifications dans `modifications[]` avec :
- `field` : nom du champ modifie
- `action` : "modified"
- `before` : resume de l'original
- `after` : resume du resultat
- `reason` : justification

---

Reponds en JSON valide.
