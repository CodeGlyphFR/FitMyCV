#!/bin/bash

# Chemin vers votre base de données
DB_PATH="dev.db"

echo "=========================================="
echo "  DERNIER extractedJobOffer AJOUTÉ"
echo "=========================================="
echo ""

# Exécuter la requête SQLite - Affichage complet
sqlite3 "$DB_PATH" <<EOF
.mode column
.headers on
.width 15 15 30 20 20 50
SELECT 
  id,
  filename,
  sourceType,
  sourceValue,
  createdAt,
  substr(extractedJobOffer, 1, 100) || '...' as extractedJobOffer_preview
FROM CvFile 
WHERE extractedJobOffer IS NOT NULL
ORDER BY createdAt DESC 
LIMIT 1;
EOF

echo ""
echo "=========================================="
echo "  CONTENU COMPLET de extractedJobOffer"
echo "=========================================="
echo ""

# Afficher le contenu complet du champ extractedJobOffer
sqlite3 "$DB_PATH" <<EOF
SELECT extractedJobOffer
FROM CvFile 
WHERE extractedJobOffer IS NOT NULL
ORDER BY createdAt DESC 
LIMIT 1;
EOF
