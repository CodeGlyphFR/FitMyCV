# Requetes SQL pour l'analyse

Requetes utiles pour recuperer les donnees de generation de CV.

## Connexion

```bash
psql "postgresql://erickdesmet:nrrpjxR77GdzcR0_g@localhost:5432/fitmycv_dev"
```

---

## Requetes principales

### Lister les dernieres generations

```sql
SELECT
  cf.id,
  cf.filename,
  cf."updatedAt",
  cf."matchScore",
  jo.content->>'title' as job_title,
  CASE WHEN cf."pendingChanges" IS NOT NULL THEN 'OUI' ELSE 'NON' END as has_pending
FROM "CvFile" cf
LEFT JOIN "JobOffer" jo ON cf."jobOfferId" = jo.id
WHERE cf."jobOfferId" IS NOT NULL
ORDER BY cf."updatedAt" DESC
LIMIT 10;
```

### Recuperer la derniere generation avec pendingChanges

```sql
SELECT
  cf.id,
  cf.filename,
  cf."updatedAt" as generation_date
FROM "CvFile" cf
WHERE cf."pendingChanges" IS NOT NULL
ORDER BY cf."updatedAt" DESC
LIMIT 1;
```

### Recuperer les pendingChanges (modifications proposees)

```sql
SELECT "pendingChanges"
FROM "CvFile"
WHERE id = '<CV_FILE_ID>';
```

### Recuperer le CV source (content actuel)

```sql
SELECT content
FROM "CvFile"
WHERE id = '<CV_FILE_ID>';
```

### Recuperer l'offre d'emploi

```sql
SELECT jo.content
FROM "CvFile" cf
JOIN "JobOffer" jo ON cf."jobOfferId" = jo.id
WHERE cf.id = '<CV_FILE_ID>';
```

---

## Requetes d'analyse

### Compter les modifications par type

```sql
SELECT
  jsonb_array_elements("pendingChanges")->>'changeType' as type,
  COUNT(*) as count
FROM "CvFile"
WHERE id = '<CV_FILE_ID>'
GROUP BY type;
```

### Voir toutes les suppressions proposees

```sql
SELECT
  elem->>'section' as section,
  elem->>'itemName' as item,
  elem->>'reason' as reason
FROM "CvFile",
  jsonb_array_elements("pendingChanges") as elem
WHERE id = '<CV_FILE_ID>'
  AND elem->>'changeType' = 'removed';
```

### Voir tous les ajouts proposes

```sql
SELECT
  elem->>'section' as section,
  elem->>'itemName' as item,
  elem->>'reason' as reason
FROM "CvFile",
  jsonb_array_elements("pendingChanges") as elem
WHERE id = '<CV_FILE_ID>'
  AND elem->>'changeType' = 'added';
```

---

## Vue ai_cv_generations (generations validees uniquement)

Cette vue ne montre que les generations avec au moins une version validee (version > 0).

```sql
SELECT
  generation_date,
  filename,
  user_email,
  "matchScore",
  cv_version_number
FROM ai_cv_generations
ORDER BY generation_date DESC
LIMIT 10;
```

### Recuperer une generation validee complete

```sql
SELECT
  source_cv,
  job_offer_content,
  ai_reasoning,
  final_cv
FROM ai_cv_generations
WHERE filename = '<FILENAME>';
```

---

## One-liner pratiques

### Derniere generation - pendingChanges complet

```bash
psql "postgresql://erickdesmet:nrrpjxR77GdzcR0_g@localhost:5432/fitmycv_dev" -A -t -c "SELECT \"pendingChanges\" FROM \"CvFile\" WHERE \"pendingChanges\" IS NOT NULL ORDER BY \"updatedAt\" DESC LIMIT 1;"
```

### Derniere generation - CV source

```bash
psql "postgresql://erickdesmet:nrrpjxR77GdzcR0_g@localhost:5432/fitmycv_dev" -A -t -c "SELECT content FROM \"CvFile\" WHERE \"pendingChanges\" IS NOT NULL ORDER BY \"updatedAt\" DESC LIMIT 1;"
```

### Derniere generation - Offre

```bash
psql "postgresql://erickdesmet:nrrpjxR77GdzcR0_g@localhost:5432/fitmycv_dev" -A -t -c "SELECT jo.content FROM \"CvFile\" cf JOIN \"JobOffer\" jo ON cf.\"jobOfferId\" = jo.id WHERE cf.\"pendingChanges\" IS NOT NULL ORDER BY cf.\"updatedAt\" DESC LIMIT 1;"
```
