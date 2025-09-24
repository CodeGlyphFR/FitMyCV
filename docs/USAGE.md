# Guide d'utilisation

Ce document décrit le flux type pour exploiter la plateforme de génération de CV ciblés.

## 1. Préparation de l'espace de travail
1. Créez le fichier `.env.local` à partir de `.env.example` et renseignez vos secrets.
2. Initialisez la base de données :
   ```bash
   npx prisma migrate deploy
   npx prisma db seed # si vous ajoutez un script de seed
   ```
3. Lancez le serveur Next.js :
   ```bash
   npm run dev
   ```
4. Dans un second terminal (optionnel), activez l'environnement Python puis installez les dépendances IA :
   ```bash
   source .venv/bin/activate  # ou équivalent Windows
   pip install -r requirements.txt
   ```

## 2. Création du compte et CV générique
1. Ouvrez `http://localhost:3000` et créez un compte (OAuth ou email/mot de passe).
2. Au premier login, l'application provisionne un fichier `main.json` minimal dans `data/users/<user-id>/cvs/`.
3. Éditez votre CV générique via l'interface (sections Résumé, Compétences, Expériences, etc.).
   - Les données sont validées contre `data/schema.json`.
   - Chaque sauvegarde chiffre le contenu avant écriture disque.

## 3. Ciblage d'une offre
1. Cliquez sur le sélecteur de CV en haut à gauche pour vérifier le fichier courant (`main.json`).
2. Ouvrez le générateur IA (icône ChatGPT) :
   - Ajoutez un ou plusieurs liens vers l'offre d'emploi.
   - Ajoutez des pièces jointes (PDF, DOCX, TXT) contenant la description de l'offre.
3. Lancez la génération :
   - Les logs s'affichent en temps réel.
   - Le script Python `scripts/generate_cv.py` appelle l'API OpenAI en injectant votre CV générique + l'offre.
   - Les nouveaux fichiers générés (ex. `offer-<slug>.json`) apparaissent dans la liste de CV.

## 4. Gestion multi-CV
- Chaque fichier `.json` du dossier utilisateur est accessible via le sélecteur.
- Le cookie `cvFile` mémorise le CV actif. L'interface recharge automatiquement les sections.
- Vous pouvez renommer ou supprimer un CV depuis le menu contextuel.
- La validation AJV est visible en mode debug (header `x-debug: 1`).

## 5. Export et diffusion
- Utilisez le bouton "Exporter" pour récupérer une version imprimable/PDF du CV actif.
- Personnalisez les titres de section et l'ordre via `order_hint` dans le JSON (`projects` est toujours inclus automatiquement).
- Le footer affiche la version et l'auteur : adaptez-le dans `app/page.jsx` si besoin.

## 6. Administration et maintenance
- Les API `app/api/cvs` permettent de créer, mettre à jour et supprimer des fichiers côté serveur.
- Prisma Studio (`npx prisma studio`) aide à inspecter les comptes/utilisateurs.
- Les CV sont stockés au format chiffré Base64 (préfixe `cv1`). Pour débugger manuellement, utilisez `lib/cv/crypto.decryptString()` depuis un script node.
- Mettez à jour la clé `CV_ENCRYPTION_KEY` et `NEXTAUTH_SECRET` lors du déploiement production.

## 7. Déploiement
1. Construisez puis démarrez l'app :
   ```bash
   npm run build
   npm start
   ```
2. Assurez-vous que le script Python est présent sur le serveur avec `openai` configuré.
3. Configurez un stockage persistant (volume Docker, S3, etc.) pour `data/users` si vous horizontalisez.
4. Ajoutez HTTPS et un proxy (Nginx/Caddy) pour exposer `NEXTAUTH_URL`.

Bon usage !
