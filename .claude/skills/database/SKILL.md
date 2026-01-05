---
name: database
description: Interroger et gérer les bases de données PostgreSQL du projet (DEV/PROD). Gérer les migrations Prisma. Utiliser quand il faut vérifier des données, debug, créer des migrations, seed la DB, ou résoudre des problèmes de migration.
---

# Database Management Skill

Ce skill permet d'interroger les bases de données PostgreSQL et de gérer les migrations Prisma pour le projet FitMyCV.

## Détection de l'environnement

**TOUJOURS** lire le fichier `.env` pour détecter l'environnement AVANT toute opération :

```bash
cat .env | grep -E "DATABASE_URL|NODE_ENV|CV_BASE_DIR"
```

### Indicateurs d'environnement :
| Indicateur | DEV | PROD |
|------------|-----|------|
| DATABASE_URL | contient `fitmycv_dev` | contient `fitmycv_prod` |
| NODE_ENV | `development` | `production` |
| CV_BASE_DIR | contient `/DEV/` | contient `/PROD/` |

## Règles de sécurité STRICTES

### Environnement DEV
- Lecture : autorisée
- Écriture : autorisée
- Migrations : autorisées

### Environnement PROD
- Lecture : autorisée MAIS avec **confirmation explicite** avant chaque requête
- Écriture : **INTERDITE** (pas de INSERT, UPDATE, DELETE)
- Migrations : `migrate deploy` uniquement, avec **confirmation explicite**

**Format de confirmation PROD :**
```
⚠️ ENVIRONNEMENT PRODUCTION DÉTECTÉ
Action demandée : [description]
Requête : [la requête SQL ou commande]

Confirmer l'exécution ? (oui/non)
```

## Connexion à la base de données

### Via psql (recommandé pour les requêtes)
```bash
# Extraire les infos de connexion du .env (sans le paramètre ?schema= incompatible avec psql)
DATABASE_URL=$(grep DATABASE_URL .env | cut -d'"' -f2 | sed 's/\?schema=.*//')
psql "$DATABASE_URL" -c "SELECT * FROM ..."
```

### Via Prisma (pour les opérations ORM)
```bash
npx prisma studio  # Interface graphique
```

## Commandes Prisma

### AUTORISÉES
```bash
# Créer une migration (DEV uniquement)
npx prisma migrate dev --name <nom_descriptif>

# Appliquer les migrations (PROD : avec confirmation)
npx prisma migrate deploy

# Regénérer le client Prisma
npx prisma generate

# Seed la base de données (DEV uniquement)
npx prisma db seed

# Reset la DB (DEV uniquement, JAMAIS en PROD)
npm run db:reset
```

### INTERDITES - JAMAIS UTILISER
```bash
# INTERDIT : casse la table de migrations
npx prisma db push  # ❌ JAMAIS

# INTERDIT : perte de données potentielle
npx prisma migrate reset  # ❌ en PROD
```

## Gestion des migrations

### Créer une nouvelle migration (DEV)
1. Modifier `prisma/schema.prisma`
2. Exécuter : `npx prisma migrate dev --name <nom_descriptif>`
3. Vérifier le fichier SQL généré dans `prisma/migrations/`
4. Tester la migration
5. Commiter les fichiers de migration

### Appliquer en PROD
1. Vérifier que les migrations sont testées en DEV
2. Demander confirmation explicite
3. Exécuter : `npx prisma migrate deploy`

### En cas d'erreur de migration

**NE JAMAIS** résoudre une erreur de migration avec `db push` ou en modifiant directement la table `_prisma_migrations`.

**Procédure :**
1. Analyser l'erreur précise
2. Identifier la cause (conflit de schéma, données existantes, etc.)
3. Proposer une solution (migration corrective, script de données, etc.)
4. **Demander confirmation** avant chaque étape de correction
5. Documenter la résolution

## Référence des modèles

Pour la liste complète des modèles Prisma, voir [MODELS.md](MODELS.md).

## Requêtes courantes

Pour des exemples de requêtes SQL fréquentes, voir [QUERIES.md](QUERIES.md).
