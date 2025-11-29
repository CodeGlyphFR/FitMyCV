# Guide d'utilisation - FitMyCv.ai

Ce document décrit le flux type pour exploiter la plateforme de génération de CV optimisés ATS.

## 1. Préparation de l'espace de travail

1. Créez le fichier `.env.local` à partir de `.env.example` et renseignez vos secrets.
2. Initialisez la base de données :
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```
3. Lancez le serveur Next.js :
   ```bash
   npm run dev  # http://localhost:3001
   ```

## 2. Création du compte et premier CV

1. Ouvrez `http://localhost:3001` et créez un compte (OAuth ou email/mot de passe).
2. Au premier login, vous pouvez :
   - **Créer un CV vierge** : Template vide pour édition manuelle
   - **Importer un CV existant** : Upload PDF pour conversion automatique en format ATS

## 3. Génération de CV avec IA

### À partir d'un CV existant + offre d'emploi

1. Sélectionnez un CV source (importé ou créé manuellement)
2. Cliquez sur le générateur IA (icône GPT)
3. Ajoutez une ou plusieurs offres d'emploi :
   - **URL** : Indeed, LinkedIn, Welcome to the Jungle, etc.
   - **PDF** : Téléchargement direct de l'offre
4. Choisissez le niveau d'analyse :
   - **Rapide** : Tests et usage fréquent
   - **Normal** : Usage quotidien
   - **Approfondi** : Candidatures importantes
5. Lancez la génération :
   - Un CV est généré **pour chaque offre** (multi-offres = multi-CVs)
   - L'IA adapte votre CV source sans inventer de compétences
   - Le nouveau CV apparaît dans votre liste

### CV Modèle (fictif) depuis une offre

1. Utilisez l'option "CV Modèle" pour générer un CV fictif parfait pour une offre
2. Inspirez-vous de ce modèle pour adapter votre propre profil

### CV depuis un titre de poste

1. Tapez un titre de poste dans la barre de recherche (ex: "Développeur Full Stack")
2. Un CV fictif réaliste est généré pour explorer ce métier

## 4. Gestion multi-CV

- **Sélecteur de CV** : Dropdown en haut à gauche pour changer de CV actif
- **Icônes source** : Identifie l'origine (manuel, PDF import, IA généré, traduit)
- **Renommer/Supprimer** : Menu contextuel sur chaque CV
- **Cookie cvFile** : Mémorise le CV actif entre les sessions

## 5. Amélioration et optimisation

### Score de match

1. Pour les CVs générés depuis une offre, calculez le score de correspondance
2. L'analyse détaille :
   - Score global (0-100)
   - Breakdown par catégorie (compétences, expérience, formation, projets, soft skills)
   - Suggestions d'amélioration avec impact estimé
   - Compétences manquantes vs matchées

### Optimisation automatique

1. Après le calcul du score, cliquez sur "Optimiser"
2. L'IA applique automatiquement les suggestions
3. Consultez l'**historique de modifications** pour voir chaque changement

## 6. Traduction

- **Langues supportées** : Français, Anglais et Espagnol
- Traduisez un CV existant via le bouton traduction
- Le CV traduit est sauvegardé comme nouveau fichier

## 7. Export PDF

1. Cliquez sur "Exporter" pour générer le PDF
2. **Customisez votre export** :
   - Activez/désactivez chaque section
   - Expériences : avec ou sans livrables clés
   - Choisissez le thème (Default, Modern, Classic)
3. Le PDF est optimisé ATS (sans photo, format standard)

## 8. Édition manuelle

- Activez le mode édition pour modifier directement chaque section
- Auto-sauvegarde toutes les 2 secondes
- Undo/Redo disponibles (Ctrl+Z / Ctrl+Y)

## 9. Administration et maintenance

- **API** : Routes `app/api/cvs` pour opérations CRUD
- **Prisma Studio** : `npx prisma studio` pour inspecter la base
- **CVs chiffrés** : Format Base64 avec préfixe `cv1`
- **Clés à protéger** : `CV_ENCRYPTION_KEY` et `NEXTAUTH_SECRET`

## 10. Déploiement

1. Construisez puis démarrez l'app :
   ```bash
   npm run build
   npm start  # http://localhost:3000
   ```
2. Configurez stockage persistant pour `data/users` si horizontal scaling
3. Ajoutez HTTPS et proxy (Nginx/Caddy) pour `NEXTAUTH_URL`

---

**Bon usage !**
