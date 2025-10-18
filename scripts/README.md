# Scripts de maintenance

## Backfill de télémétrie

Le script `backfill-telemetry.mjs` permet d'importer les données historiques existantes dans le système de télémétrie.

### Quand l'utiliser ?

- **Première utilisation** : Après avoir intégré le système de télémétrie dans le code
- **Après une migration** : Si vous avez restauré une ancienne base de données
- **Pour réinitialiser** : Si vous souhaitez recalculer toutes les statistiques

### Comment l'exécuter ?

```bash
npm run backfill:telemetry
```

Ou directement avec Node :

```bash
node scripts/backfill-telemetry.mjs
```

### Ce que fait le script

Le script va scanner votre base de données et créer des événements de télémétrie rétroactifs pour :

1. **Utilisateurs** : Créer des événements `USER_REGISTERED` pour tous les utilisateurs existants
2. **CVs** : Créer des événements selon le type de création :
   - `CV_GENERATED` pour les CVs générés par IA
   - `CV_IMPORTED` pour les CVs importés depuis PDF
   - `CV_CREATED_MANUAL` pour les CVs créés manuellement
   - `CV_TRANSLATED` pour les CVs traduits
   - `CV_OPTIMIZED` pour les CVs optimisés
3. **Scores de match** : Créer des événements `MATCH_SCORE_CALCULATED` pour tous les scores existants
4. **Tâches** : Créer des événements `JOB_COMPLETED` pour toutes les tâches terminées
5. **FeatureUsage** : Mettre à jour les compteurs d'utilisation par feature et par utilisateur

### Sortie attendue

```
🚀 Début du backfill de télémétrie...

📦 Chargement des modules...

👥 Backfill des utilisateurs...
  ✅ 15 utilisateurs importés

📄 Backfill des fichiers CV...
  ✅ CVs importés:
    - Générés: 42
    - Importés PDF: 8
    - Créés manuellement: 3
    - Traduits: 5
    - Optimisés: 12

🎯 Backfill des scores de match...
  ✅ 38 scores de match importés

⚙️  Backfill des tâches en arrière-plan...
  ✅ 67 tâches complétées importées

📊 Statistiques finales:
  - 187 événements de télémétrie
  - 45 enregistrements de FeatureUsage
  - 15 utilisateurs

  Événements par type:
    - USER_REGISTERED: 15
    - CV_GENERATED: 42
    - CV_IMPORTED: 8
    - CV_CREATED_MANUAL: 3
    - CV_TRANSLATED: 5
    - CV_OPTIMIZED: 12
    - MATCH_SCORE_CALCULATED: 38
    - JOB_COMPLETED: 67

✅ Backfill terminé avec succès !
```

### Options avancées

#### Nettoyer les données existantes avant le backfill

Si vous souhaitez réinitialiser complètement la télémétrie, décommentez la ligne dans le script :

```javascript
// 1. Nettoyer les données existantes (optionnel - décommenter si besoin)
await cleanupExistingTelemetry();
```

⚠️ **Attention** : Cette action supprimera TOUTES les données de télémétrie existantes avant de les recréer.

### Résultat

Après l'exécution du script, votre dashboard analytics (`/admin/analytics`) affichera immédiatement les statistiques correctes basées sur vos données historiques.

### Prérequis

- Base de données accessible (fichier `.env.local` configuré)
- Prisma client généré (`npx prisma generate`)
- Node.js 18+ (pour le support des imports ES modules)

### Dépannage

#### Erreur "Cannot find module"

```bash
# Régénérer le client Prisma
npx prisma generate
```

#### Erreur "DATABASE_URL not found"

Vérifiez que votre fichier `.env.local` contient bien :

```
DATABASE_URL="file:./prisma/dev.db"
```

#### Le script ne trouve aucune donnée

Vérifiez que votre base de données contient bien des données :

```bash
npx prisma studio
```

### Sécurité

Ce script ne supprime **jamais** les données métier (CVs, utilisateurs, etc.). Il ne fait que **créer** des événements de télémétrie basés sur ces données.

Vous pouvez l'exécuter plusieurs fois sans risque - les événements en double seront simplement ajoutés (vous pourrez ensuite nettoyer avec l'option de cleanup).
