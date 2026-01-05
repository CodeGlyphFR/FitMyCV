# Notes de migration - Branche refactor/historisation

## Actions requises lors du merge vers main

### 1. Migration renommée (IMPORTANT)

La migration `20251206160750_add_content_hash_to_job_offer` a été renommée en `20251206180001_add_content_hash_to_job_offer` pour corriger un bug d'ordre (elle modifiait la table JobOffer avant sa création).

**Sur la DB PROD**, après le merge, exécuter :

```sql
UPDATE _prisma_migrations
SET migration_name = '20251206180001_add_content_hash_to_job_offer'
WHERE migration_name = '20251206160750_add_content_hash_to_job_offer';
```

### 2. Nouvelles migrations à appliquer

Après le merge, les migrations suivantes seront appliquées automatiquement par `prisma migrate deploy` :

| Migration | Description |
|-----------|-------------|
| `20251205180457_add_cv_content_and_versioning` | CV stocké en DB + versioning |
| `20251206101238_add_cv_language_and_pdf_settings` | Langue CV + settings PDF |
| `20251206180000_add_job_offer_table` | Table JobOffer |
| `20251206180001_add_content_hash_to_job_offer` | Hash pour dédup PDF |
| `20251207180000_remove_analysis_levels` | Suppression analysis levels |
| `20251216100000_add_cv_change_review` | Système review changes |
| `20251217120000_add_score_before_to_cvfile` | Score before optimisation |
| `20251217130527_add_score_to_cvversion` | Scores par version CV |

### 3. Ordre des opérations

```bash
# 1. Merge la branche
git checkout main
git merge refactor/historisation

# 2. Mettre à jour le nom de migration en DB PROD
psql -d fitmycv_prod -c "UPDATE _prisma_migrations SET migration_name = '20251206180001_add_content_hash_to_job_offer' WHERE migration_name = '20251206160750_add_content_hash_to_job_offer';"

# 3. Appliquer les migrations
npx prisma migrate deploy

# 4. Générer le client
npx prisma generate
```

### 4. Vérification post-migration

```sql
-- Vérifier que toutes les migrations sont appliquées
SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at;

-- Vérifier la nouvelle colonne matchScore sur CvVersion
SELECT column_name FROM information_schema.columns
WHERE table_name = 'CvVersion' AND column_name = 'matchScore';
```

---

## Fonctionnalité ajoutée : Scores par version

### Comportement

- Chaque version de CV conserve son score de matching
- Navigation entre versions affiche le score correspondant (en gris, lecture seule)
- Restauration d'une version restaure aussi son score
- VersionSelector affiche le score de chaque version

### Fichiers modifiés

- `prisma/schema.prisma` - Champs score sur CvVersion
- `lib/cv/versioning.js` - Copie/restauration des scores
- `app/api/cv/match-score/route.js` - Support `?version=X`
- `app/api/cvs/versions/route.js` - Retourne matchScore
- `components/Header.jsx` - Passe la version au fetch
- `components/MatchScore.jsx` - Mode lecture seule
- `components/VersionSelector.jsx` - Affiche scores

---

*Document créé le 17/12/2025*
