# Migration de Base de Données (SQLite → PostgreSQL)

> **Note** : Ce guide reste disponible pour référence lors de futures migrations ou pour documenter le processus utilisé.

Ce guide couvre la migration complète de la base de données SQLite de développement vers PostgreSQL pour la production.

## Table des matières

- [Préparation](#préparation)
- [Option 1 : Production avec SQLite](#option-1--production-avec-sqlite-recommandé-pour-mvp)
- [Option 2 : Migration vers PostgreSQL](#option-2--migration-vers-postgresql-scalabilité)
- [Vérification Post-Migration](#vérification-post-migration)
- [Rollback](#rollback)
- [Maintenance](#maintenance)

---

## Préparation

### 1. Backup complet

```bash
# Backup de la base SQLite
cp prisma/dev.db prisma/dev.db.backup.$(date +%Y%m%d_%H%M%S)

# Backup des CV chiffrés
cp -r prisma/cv_data prisma/cv_data.backup.$(date +%Y%m%d_%H%M%S)

# Backup du .env
cp .env .env.backup
```

### 2. Vérifier l'intégrité des données

```bash
# Ouvrir Prisma Studio pour inspection visuelle
npx prisma studio

# Compter les enregistrements
sqlite3 prisma/dev.db "SELECT COUNT(*) FROM User;"
sqlite3 prisma/dev.db "SELECT COUNT(*) FROM CvFile;"
```

### 3. Variables d'environnement critiques

⚠️ **CRITIQUE** : Ces variables DOIVENT être identiques entre dev et prod :

```bash
# .env (dev)
CV_ENCRYPTION_KEY="<votre_clé_32_bytes>"
NEXTAUTH_SECRET="<votre_secret>"
```

**Si CV_ENCRYPTION_KEY change, tous les CVs seront illisibles !**

---

## Option 1 : Production avec SQLite (Recommandé pour MVP)

### Avantages
- ✅ Aucune migration nécessaire
- ✅ Configuration minimale
- ✅ Performances excellentes jusqu'à ~100k utilisateurs
- ✅ Backups simples (copie de fichier)

### Déploiement

1. **Sur le serveur de production** :

```bash
# Copier la base de données
scp prisma/dev.db user@production-server:/app/prisma/

# Copier les CV chiffrés
scp -r prisma/cv_data user@production-server:/app/prisma/

# Vérifier les permissions
chmod 644 /app/prisma/dev.db
chmod 755 /app/prisma/cv_data
```

2. **Configuration .env production** :

```bash
DATABASE_URL="file:./dev.db"  # ⚠️ TOUJOURS relatif à prisma/
CV_ENCRYPTION_KEY="<MÊME CLÉ QUE DEV>"
NEXTAUTH_SECRET="<secret_production>"
NEXT_PUBLIC_SITE_URL="https://votre-domaine.com"
```

3. **Démarrer l'application** :

```bash
npm run build
npm start
```

### Backups automatiques SQLite

```bash
# Script de backup quotidien (/etc/cron.daily/backup-cvsite)
#!/bin/bash
BACKUP_DIR="/backups/cvsite"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
cp /app/prisma/dev.db $BACKUP_DIR/db_$DATE.db

# Backup CVs
tar -czf $BACKUP_DIR/cv_data_$DATE.tar.gz /app/prisma/cv_data

# Garder seulement les 30 derniers backups
find $BACKUP_DIR -name "db_*.db" -mtime +30 -delete
find $BACKUP_DIR -name "cv_data_*.tar.gz" -mtime +30 -delete
```

---

## Option 2 : Migration vers PostgreSQL (Scalabilité)

### Avantages
- ✅ Performances optimales à grande échelle
- ✅ Réplication et haute disponibilité
- ✅ Backups automatiques (pg_dump)
- ✅ Transactions ACID robustes

### Étape 1 : Installation PostgreSQL

#### Sur Ubuntu/Debian

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib

# Vérifier que PostgreSQL fonctionne
sudo systemctl status postgresql
```

#### Sur Docker

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: cvsite_user
      POSTGRES_PASSWORD: votre_mot_de_passe_fort
      POSTGRES_DB: cvsite_prod
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

```bash
docker-compose up -d postgres
```

### Étape 2 : Créer la base de données

```bash
# Se connecter à PostgreSQL
sudo -u postgres psql

# Créer la base et l'utilisateur
CREATE DATABASE cvsite_prod;
CREATE USER cvsite_user WITH PASSWORD 'votre_mot_de_passe_fort';
GRANT ALL PRIVILEGES ON DATABASE cvsite_prod TO cvsite_user;

-- PostgreSQL 15+ : grant sur le schéma public
\c cvsite_prod
GRANT ALL ON SCHEMA public TO cvsite_user;

\q
```

### Étape 3 : Mettre à jour schema.prisma

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"  // ⚠️ Changer de "sqlite" à "postgresql"
  url      = env("DATABASE_URL")
}
```

### Étape 4 : Configurer DATABASE_URL

```bash
# .env.production
DATABASE_URL="postgresql://cvsite_user:votre_mot_de_passe@localhost:5432/cvsite_prod?schema=public"

# Si PostgreSQL est sur un autre serveur
DATABASE_URL="postgresql://cvsite_user:password@db-server.com:5432/cvsite_prod?schema=public"

# Avec SSL (recommandé en production)
DATABASE_URL="postgresql://user:pass@db.com:5432/cvsite_prod?schema=public&sslmode=require"
```

### Étape 5 : Créer le schéma PostgreSQL

```bash
# Générer le client Prisma pour PostgreSQL
npx prisma generate

# Appliquer toutes les migrations
npx prisma migrate deploy
```

### Étape 6 : Migrer les données

```bash
# Utiliser le script de migration
node scripts/migrate-to-postgres.js
```

Le script `scripts/migrate-to-postgres.js` migre automatiquement :
- ✅ Utilisateurs + comptes OAuth + sessions
- ✅ Plans d'abonnement + abonnements actifs
- ✅ Crédits + transactions + packs
- ✅ CVs (métadonnées uniquement, pas les fichiers chiffrés)
- ✅ Tâches en arrière-plan
- ✅ Télémétrie + événements
- ✅ Feature usage + OpenAI usage

### Étape 7 : Copier les CV chiffrés

```bash
# Sur le serveur de production
scp -r prisma/cv_data user@production-server:/app/prisma/

# Vérifier les permissions
chmod 755 /app/prisma/cv_data
```

### Étape 8 : Vérifier la migration

```bash
# Exécuter le script de vérification
node scripts/verify-migration.js
```

**Sortie attendue** :

```
✅ users                     : X
✅ accounts                  : X
✅ cvFiles                   : X
✅ backgroundTasks           : X
✅ subscriptionPlans         : 3+
✅ subscriptions             : X
✅ creditBalances            : X
✅ creditTransactions        : X
✅ creditPacks               : 4+
✅ telemetryEvents           : X
✅ featureUsage              : X
✅ openAIUsage               : X

🎉 Migration réussie!
📦 Total d'enregistrements: XXX
```

---

## Vérification Post-Migration

### 1. Test de connexion

```bash
# Tester la connexion PostgreSQL
npx prisma studio

# Vérifier le nombre d'enregistrements
node scripts/verify-migration.js
```

### 2. Test des CVs chiffrés

```bash
# Démarrer l'application
npm run build
npm start

# Vérifier qu'un CV peut être ouvert
# → Se connecter avec votre compte
# → Ouvrir un CV existant
# → Vérifier que le contenu est déchiffré correctement
```

### 3. Test des fonctionnalités critiques

- [ ] Connexion utilisateur (OAuth + Email/Password)
- [ ] Création de CV
- [ ] Import PDF
- [ ] Génération CV avec IA
- [ ] Match score
- [ ] Export PDF
- [ ] Abonnement (consulter le plan actif)
- [ ] Crédits (vérifier le solde)

### 4. Vérifier les logs

```bash
# Logs de l'application
tail -f /var/log/cvsite/app.log

# Logs PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-16-main.log
```

---

## Rollback

### Si problème après migration PostgreSQL

#### 1. Rollback immédiat (retour à SQLite)

```bash
# 1. Arrêter l'application
pm2 stop cvsite

# 2. Restaurer .env
cp .env.backup .env

# 3. Restaurer schema.prisma
git checkout prisma/schema.prisma

# 4. Régénérer le client Prisma
npx prisma generate

# 5. Redémarrer
npm run build
pm2 start cvsite
```

#### 2. Restaurer la base SQLite

```bash
# Si la base SQLite a été modifiée/corrompue
cp prisma/dev.db.backup.<timestamp> prisma/dev.db
```

#### 3. Restaurer les CV chiffrés

```bash
# Si les fichiers ont été altérés
rm -rf prisma/cv_data
cp -r prisma/cv_data.backup.<timestamp> prisma/cv_data
```

---

## Maintenance

### Backups PostgreSQL

#### Backup manuel

```bash
# Backup complet
pg_dump -U cvsite_user -h localhost cvsite_prod > backup_$(date +%Y%m%d_%H%M%S).sql

# Avec compression
pg_dump -U cvsite_user -h localhost cvsite_prod | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

#### Backup automatique quotidien

```bash
# Script /etc/cron.daily/backup-cvsite-postgres
#!/bin/bash
BACKUP_DIR="/backups/cvsite"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="cvsite_prod"
DB_USER="cvsite_user"

mkdir -p $BACKUP_DIR

# Backup PostgreSQL
pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup CVs
tar -czf $BACKUP_DIR/cv_data_$DATE.tar.gz /app/prisma/cv_data

# Garder 30 derniers backups
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete
find $BACKUP_DIR -name "cv_data_*.tar.gz" -mtime +30 -delete

# (Optionnel) Upload vers S3/Backblaze
# aws s3 cp $BACKUP_DIR/db_$DATE.sql.gz s3://backups-cvsite/
```

#### Restaurer un backup

```bash
# Décompresser et restaurer
gunzip -c backup_20250113_120000.sql.gz | psql -U cvsite_user -h localhost cvsite_prod
```

### Monitoring PostgreSQL

#### Vérifier la taille de la base

```sql
SELECT pg_size_pretty(pg_database_size('cvsite_prod'));
```

#### Vérifier les connexions actives

```sql
SELECT count(*) FROM pg_stat_activity WHERE datname = 'cvsite_prod';
```

#### Vérifier les requêtes lentes

```sql
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '5 seconds';
```

### Optimisation PostgreSQL

#### Indexes recommandés (déjà créés par Prisma)

Les indexes suivants sont automatiquement créés par le schéma Prisma :

- `User.email` (unique)
- `Account.provider + providerAccountId` (unique)
- `CvFile.userId + filename` (unique)
- `BackgroundTask.deviceId`, `status`, `createdAt`
- `TelemetryEvent.userId`, `type`, `timestamp`
- `CreditTransaction.userId`, `createdAt`

#### VACUUM et ANALYZE

```bash
# Nettoyer et optimiser
psql -U cvsite_user -h localhost cvsite_prod -c "VACUUM ANALYZE;"
```

#### Ajouter un CRON pour maintenance

```bash
# /etc/cron.weekly/postgres-maintenance
#!/bin/bash
psql -U cvsite_user -h localhost cvsite_prod -c "VACUUM ANALYZE;"
```

---

## Comparaison SQLite vs PostgreSQL

| Critère | SQLite | PostgreSQL |
|---------|--------|------------|
| **Setup** | ✅ Aucun (fichier local) | ⚠️ Installation serveur nécessaire |
| **Scalabilité** | ✅ Jusqu'à ~100k users | ✅ Illimité |
| **Performance lecture** | ✅ Excellent | ✅ Excellent |
| **Performance écriture concurrente** | ⚠️ Limitée (lock fichier) | ✅ Excellent (MVCC) |
| **Backups** | ✅ Simple (copie fichier) | ⚠️ pg_dump requis |
| **Haute disponibilité** | ❌ Non | ✅ Réplication, failover |
| **Maintenance** | ✅ Minimale | ⚠️ VACUUM, monitoring |
| **Coût** | ✅ Gratuit (inclus) | ⚠️ Ressources serveur |

---

## Recommandations

### Utiliser SQLite si :
- MVP ou petit projet (<10k utilisateurs)
- Budget limité
- Déploiement simple privilégié
- Pas de charge concurrente élevée

### Migrer vers PostgreSQL si :
- Croissance prévue (>10k utilisateurs)
- Besoin de haute disponibilité
- Écriture concurrente importante
- Fonctionnalités avancées (réplication, partitioning)

---

## Troubleshooting

### Erreur : "relation does not exist"

```bash
# Réappliquer les migrations
npx prisma migrate deploy
```

### Erreur : "password authentication failed"

```bash
# Vérifier DATABASE_URL
echo $DATABASE_URL

# Tester la connexion manuellement
psql -U cvsite_user -h localhost -d cvsite_prod
```

### CVs illisibles après migration

⚠️ **Cause** : `CV_ENCRYPTION_KEY` a changé

```bash
# Vérifier que la clé est identique
# .env.dev
CV_ENCRYPTION_KEY="abc123..."

# .env.production
CV_ENCRYPTION_KEY="abc123..."  # DOIT être IDENTIQUE
```

### Performance dégradée après migration

```sql
-- Vérifier les indexes manquants
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public';

-- Analyser les requêtes lentes
EXPLAIN ANALYZE SELECT * FROM "CvFile" WHERE "userId" = 'xxx';
```

---

## Ressources

- [Prisma PostgreSQL Guide](https://www.prisma.io/docs/concepts/database-connectors/postgresql)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [pg_dump Reference](https://www.postgresql.org/docs/current/app-pgdump.html)

---

**Dernière mise à jour** : 2025-01-13
