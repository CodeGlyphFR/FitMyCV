# 🛠️ Scripts & Automatisation

Ce dossier contient les outils de maintenance et les moteurs de l'automatisation du projet FitMyCV.

## ⚠️ Avertissement Production

Depuis la mise en place du workflow CI/CD avec GitHub Actions, la plupart des migrations de données sont automatisées.
**Ne lancez plus de scripts de migration manuellement sur le serveur de production.**

---

## 🚀 Automatisation (CI/CD)

Ces scripts sont les piliers de ton usine logicielle et sont principalement appelés par GitHub Actions.

* **`bump-version.sh`** : Calcule et propage le nouveau numéro de version dans toute la codebase en fonction du message de commit (Conventional Commits).
* **`run-data-migrations.js`** : Moteur d'exécution des migrations de données. Il joue les scripts situés dans `prisma/data-migrations/` une seule fois.

---

## 📦 Maintenance Manuelle

Outils nécessitant une intervention humaine ponctuelle ou utilisés en développement.

### 💳 Stripe
* **`sync-stripe.mjs`** : Synchronise les plans d'abonnement et les packs de crédits entre la base de données et Stripe.

### 📧 Emails
* **`preview-emails.js`** : Lance un serveur local (Port 3001) pour prévisualiser les templates d'emails avec support Dark/Light mode.
* **`export-email-templates.js`** : Exporte les templates de la base de données vers `prisma/email-templates/` au format JSON pour le versionnage.

---

## 💾 Migrations de Données

Pour toute modification de données (naming, nettoyage, calculs) générée par Claude Code :

1.  **Emplacement** : Ne plus créer de fichiers à la racine de ce dossier. Utilisez `/prisma/data-migrations/`.
2.  **Format** : `YYYYMMDD_HHMM_description.js`.
3.  **Exécution** : Automatique lors de chaque déploiement (Pré-prod et Prod) via la commande `npm run db:migrate-data`.

---

## 🔍 Debug & Diagnostic

Les scripts de type `check-batch*.mjs` ou `debug-*.mjs` sont des outils de diagnostic ponctuel. Ils permettent d'auditer les résultats de l'IA sans modifier la base de données.
