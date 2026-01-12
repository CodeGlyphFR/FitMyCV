# Experience a Adapter

```json
{experienceJson}
```

# Langue de sortie: {targetLanguage}

Adapte cette experience pour correspondre a l'offre d'emploi ci-dessus.
- Reformule le titre si necessaire
- Reordonne et reformule les responsabilites (les plus pertinentes en premier)
- Mets en valeur les resultats (deliverables) pertinents
- Filtre les skills_used pour ne garder que les pertinents

**OBLIGATOIRE - Champs à remplir :**
- **domain** : Détermine le domaine métier en analysant le titre, l'entreprise et les responsabilités
- **years_in_domain** : Utilise la valeur `_calculated_years` fournie (déjà calculée)

RAPPEL: Ne jamais inventer de donnees. Tu peux seulement reformuler, reordonner et filtrer.

**IMPORTANT**: Documente TOUTES tes modifications dans le champ `modifications[]` avec avant/apres/raison.
Meme pour les reordonnancements ou reformulations mineures, cree une entree.

Reponds en JSON valide.
