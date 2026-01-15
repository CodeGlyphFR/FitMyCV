# Requêtes SQL courantes

## Connexion rapide

```bash
# Récupérer DATABASE_URL et exécuter une requête
psql "$(grep DATABASE_URL .env | cut -d'"' -f2)" -c "SELECT ..."
```

## Utilisateurs

```sql
-- Trouver un utilisateur par email
SELECT id, name, email, role, "createdAt" FROM "User" WHERE email = 'xxx@xxx.com';

-- Utilisateurs récents
SELECT id, name, email, "createdAt" FROM "User" ORDER BY "createdAt" DESC LIMIT 10;

-- Compter les utilisateurs par rôle
SELECT role, COUNT(*) FROM "User" GROUP BY role;

-- Utilisateur avec son abonnement
SELECT u.id, u.email, s.status, sp.name as plan_name
FROM "User" u
LEFT JOIN "Subscription" s ON u.id = s."userId"
LEFT JOIN "SubscriptionPlan" sp ON s."planId" = sp.id
WHERE u.email = 'xxx@xxx.com';
```

## CVs

```sql
-- CVs d'un utilisateur
SELECT id, filename, "matchScore", "optimiseStatus", "createdAt"
FROM "CvFile" WHERE "userId" = 'xxx' ORDER BY "createdAt" DESC;

-- CVs avec score > 80
SELECT cf.filename, cf."matchScore", u.email
FROM "CvFile" cf
JOIN "User" u ON cf."userId" = u.id
WHERE cf."matchScore" > 80;

-- CVs bloqués
SELECT cf.id, cf.filename, cf."blockedReason", u.email
FROM "CvFile" cf
JOIN "User" u ON cf."userId" = u.id
WHERE cf.blocked = true;
```

## Abonnements & Crédits

```sql
-- Abonnements actifs
SELECT s.status, sp.name, COUNT(*)
FROM "Subscription" s
JOIN "SubscriptionPlan" sp ON s."planId" = sp.id
GROUP BY s.status, sp.name;

-- Solde crédits d'un utilisateur
SELECT cb.balance, cb."totalPurchased", cb."totalUsed", u.email
FROM "CreditBalance" cb
JOIN "User" u ON cb."userId" = u.id
WHERE u.email = 'xxx@xxx.com';

-- Dernières transactions de crédits
SELECT ct.amount, ct.type, ct."featureName", ct."createdAt", u.email
FROM "CreditTransaction" ct
JOIN "User" u ON ct."userId" = u.id
ORDER BY ct."createdAt" DESC LIMIT 20;
```

## Tâches en arrière-plan

```sql
-- Tâches en cours
SELECT id, title, type, status, "createdAt" FROM "BackgroundTask"
WHERE status IN ('queued', 'running') ORDER BY "createdAt";

-- Tâches échouées récentes
SELECT id, title, type, error, "createdAt" FROM "BackgroundTask"
WHERE status = 'failed' ORDER BY "createdAt" DESC LIMIT 10;

-- Tâches par status
SELECT status, COUNT(*) FROM "BackgroundTask" GROUP BY status;
```

## OpenAI

```sql
-- Consommation par feature (aujourd'hui)
SELECT "featureName", SUM("totalTokens") as tokens, SUM("estimatedCost") as cost
FROM "OpenAICall"
WHERE DATE("createdAt") = CURRENT_DATE
GROUP BY "featureName" ORDER BY cost DESC;

-- Top 10 consommateurs
SELECT u.email, SUM(o."totalTokens") as tokens, SUM(o."estimatedCost") as cost
FROM "OpenAICall" o
JOIN "User" u ON o."userId" = u.id
WHERE o."createdAt" > NOW() - INTERVAL '7 days'
GROUP BY u.email ORDER BY cost DESC LIMIT 10;
```

## Settings

```sql
-- Tous les settings
SELECT "settingName", value, category FROM "Setting" ORDER BY category, "settingName";

-- Settings d'une catégorie
SELECT "settingName", value FROM "Setting" WHERE category = 'features';

-- Modifier un setting (DEV UNIQUEMENT)
UPDATE "Setting" SET value = 'new_value' WHERE "settingName" = 'xxx';
```

## Feedbacks

```sql
-- Bug reports non traités
SELECT f.id, f.rating, f.comment, f."createdAt", u.email
FROM "Feedback" f
JOIN "User" u ON f."userId" = u.id
WHERE f."isBugReport" = true AND f.status = 'new'
ORDER BY f."createdAt" DESC;
```

## Diagnostic

```sql
-- Vérifier les index
SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' ORDER BY tablename;

-- Taille des tables
SELECT relname as table, pg_size_pretty(pg_total_relation_size(relid)) as size
FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC;

-- État des migrations Prisma
SELECT * FROM "_prisma_migrations" ORDER BY "finished_at" DESC;
```
