# Télémétrie et Analytics - Guide de démarrage

## 🎯 Vue d'ensemble

Ce projet intègre un système complet de télémétrie pour suivre l'utilisation de l'application et analyser le comportement des utilisateurs.

### Fonctionnalités

✅ **Tracking automatique** :
- Navigation et temps passé sur chaque page
- Actions utilisateur (clics, soumissions de formulaires)
- Génération, import, export de CVs
- Calculs de match score et optimisations
- Erreurs et événements système

✅ **Dashboard admin complet** :
- Vue d'ensemble avec KPIs
- Analyse des features utilisées
- Statistiques de sessions
- Analyse des erreurs
- Export de données (JSON/CSV)
- **Gestion des Settings** (modification des paramètres de la table Setting)

✅ **API REST** pour interroger les données

---

## 🚀 Démarrage rapide

### 1. Base de données

La migration Prisma a déjà été appliquée. Vérifiez que les tables suivantes existent :

```bash
npx prisma studio
```

Tables créées :
- `TelemetryEvent` - Événements trackés
- `FeatureUsage` - Usage agrégé par feature
- `FeatureUsageCounter` - Compteurs d'usage par période
- `User` - Champ `role` (USER | ADMIN)

### 2. Créer un utilisateur admin

Pour accéder au dashboard analytics, vous devez avoir un compte avec le rôle `ADMIN`.

**Option A : Via le script** (recommandé)
```bash
node scripts/make-admin.js votre-email@example.com
```

**Option B : Via Prisma Studio**
1. Ouvrez Prisma Studio : `npx prisma studio`
2. Allez dans la table `User`
3. Trouvez votre utilisateur
4. Changez le champ `role` de `USER` à `ADMIN`
5. Sauvegardez

**Option C : Via SQL direct**
```bash
sqlite3 prisma/dev.db "UPDATE User SET role = 'ADMIN' WHERE email = 'votre-email@example.com';"
```

### 3. Accéder au dashboard

1. Démarrez l'application : `npm run dev` (port 3001 selon vos règles)
2. Connectez-vous avec votre compte admin
3. Accédez à `/admin/analytics`

---

## 📊 Utilisation du dashboard

### Onglet "Vue d'ensemble"
- **KPIs** : utilisateurs actifs, CVs générés/exportés, taux de conversion
- **Graphiques** : top features, répartition

### Onglet "Features"
- Utilisation de chaque feature
- Breakdown par analysis level (rapid/medium/deep)
- Durée moyenne d'exécution

### Onglet "Sessions"
- Durée moyenne et médiane
- Distribution des durées
- Sessions récentes

### Onglet "Erreurs"
- Erreurs par type
- Messages d'erreur fréquents
- Taux d'erreur global

### Onglet "Exports"
- Export JSON/CSV des données
- Documentation de l'API REST

### Onglet "Settings" ⭐
- **Gestion des paramètres de la table Setting**
- Édition inline des valeurs
- Création/Suppression de settings
- Filtres par catégorie
- Parfait pour modifier les modèles OpenAI, features flags, etc.

---

## 🔧 Intégration du tracking

Le tracking côté client est **déjà activé** via le `TelemetryProvider` dans `RootProviders`.

### Types d'événements disponibles

Le système track automatiquement les événements suivants (définis dans `lib/telemetry/server.js`) :

**CV Management** :
- `CV_GENERATED_URL` - CV généré depuis URL
- `CV_GENERATED_PDF` - CV généré depuis PDF
- `CV_TEMPLATE_CREATED_URL` / `CV_TEMPLATE_CREATED_PDF` - Template créé
- `CV_GENERATED_FROM_JOB_TITLE` - CV depuis job title
- `CV_IMPORTED` / `CV_FIRST_IMPORTED` - Import PDF
- `CV_EXPORTED` - Export PDF
- `CV_CREATED_MANUAL` - Création manuelle
- `CV_EDITED` / `CV_DELETED` / `CV_TRANSLATED`

**Match Score & Optimization** :
- `MATCH_SCORE_CALCULATED`
- `CV_OPTIMIZED`

**Job Processing** :
- `JOB_QUEUED` / `JOB_STARTED` / `JOB_COMPLETED` / `JOB_FAILED` / `JOB_CANCELLED`

**Auth** :
- `USER_REGISTERED` / `USER_LOGIN` / `USER_LOGOUT`
- `EMAIL_VERIFIED` / `PASSWORD_RESET`

**Navigation & Interaction** (Frontend) :
- `PAGE_VIEW` / `BUTTON_CLICK`
- `MODAL_OPENED` / `MODAL_CLOSED`
- `FORM_SUBMITTED`

### Tracking côté serveur

Pour tracker un événement dans une route API ou un job :

```javascript
import { trackEvent, EventTypes } from '@/lib/telemetry/server';

await trackEvent({
  type: EventTypes.CV_GENERATED_URL,
  userId: session.user.id,
  metadata: {
    analysisLevel: 'medium',
    duration: 12500,
    cvId: newCvId
  },
  status: 'success'
});
```

---

## 📡 API Analytics

Tous les endpoints sont protégés et nécessitent un rôle `ADMIN`.

### Endpoints disponibles

```
GET /api/analytics/summary?period=30d
GET /api/analytics/events?userId=xxx&type=CV_GENERATED&limit=100
GET /api/analytics/features
GET /api/analytics/users/[userId]/summary
GET /api/analytics/errors?period=7d
GET /api/analytics/openai-usage?period=30d
GET /api/analytics/feedbacks
```

### Endpoints Settings

```
GET /api/admin/settings?category=ai_models
POST /api/admin/settings
PUT /api/admin/settings/[id]
DELETE /api/admin/settings/[id]
GET /api/admin/settings/history
```

### Exemple d'utilisation

```javascript
// Récupérer le résumé des 30 derniers jours
const res = await fetch('/api/analytics/summary?period=30d');
const data = await res.json();

console.log(data.kpis.activeUsers);
console.log(data.topFeatures);
```

---

## 🎨 Utiliser le tracking dans vos composants

```javascript
import { useTelemetry } from '@/hooks/useTelemetry';

function MyComponent() {
  const telemetry = useTelemetry();

  const handleClick = () => {
    telemetry.buttonClick('export-cv', { format: 'pdf' });
    // ... votre logique ...
  };

  return <button onClick={handleClick}>Exporter</button>;
}
```

Fonctions disponibles :
- `track(type, metadata)` - Event générique
- `pageView(path, metadata)` - Vue de page
- `buttonClick(name, metadata)` - Clic bouton
- `modalOpened(name, metadata)` - Modal ouvert
- `modalClosed(name, metadata)` - Modal fermé
- `formSubmitted(name, metadata)` - Formulaire soumis

---

## 🧪 Tester le système

### 1. Vérifier le tracking côté client

1. Ouvrez les DevTools (F12)
2. Allez dans l'onglet Network
3. Naviguez dans l'app
4. Vérifiez les requêtes POST vers `/api/telemetry/track`

### 2. Vérifier les données dans le dashboard

1. Accédez à `/admin/analytics`
2. Vérifiez que les événements apparaissent
3. Testez les différents onglets

### 3. Vérifier directement en base

```bash
npx prisma studio
```

Ou via SQL :
```bash
sqlite3 prisma/dev.db

SELECT type, COUNT(*) as count FROM TelemetryEvent GROUP BY type ORDER BY count DESC;
SELECT * FROM TelemetryEvent ORDER BY timestamp DESC LIMIT 10;
SELECT * FROM FeatureUsage;
```

---

## 🔐 Sécurité et confidentialité

- **Données anonymes** : Les events sans userId sont acceptés
- **Protection admin** : Dashboard protégé par role ADMIN
- **Pas de données sensibles** : Ne jamais tracker de mots de passe, tokens, etc.
- **Consentement** : Le système de cookies existant gère le consentement

---

## 📝 Métriques trackées

### Utilisateur
- Temps de connexion (via sessions)
- Dernière feature utilisée
- Nombre total d'actions

### CVs
- Générés (avec analysis level)
- Importés (avec analysis level)
- Créés manuellement
- Exportés
- Édités (avec type d'opération)
- Traduits

### Système
- Calculs de match score
- Optimisations de CV
- Erreurs et échecs
- Durées d'exécution

---

## 🛠️ Maintenance

### Nettoyage des vieilles données (optionnel)

Pour l'instant, la rétention est **illimitée**. Si vous souhaitez nettoyer :

```javascript
// Supprimer les events de plus de 6 mois
await prisma.telemetryEvent.deleteMany({
  where: {
    timestamp: {
      lt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
    }
  }
});
```

### Agrégation mensuelle (recommandé pour production)

Créez un job CRON qui agrège les anciennes données par jour/semaine/mois.

---

## 📚 Ressources

- **Schéma Prisma** : `prisma/schema.prisma`
- **Service backend** : `lib/telemetry/server.js`
- **Hook frontend** : `hooks/useTelemetry.js`

---

## 🐛 Dépannage

### Le dashboard ne s'affiche pas

1. Vérifiez que vous êtes admin : `SELECT role FROM User WHERE email = 'votre-email@example.com';`
2. Vérifiez que vous êtes connecté
3. Vérifiez la console pour des erreurs

### Pas de données dans le dashboard

1. Vérifiez que le tracking côté client fonctionne (Network tab)
2. Vérifiez la table TelemetryEvent dans Prisma Studio
3. Effectuez quelques actions dans l'app (générer un CV, etc.)

### Erreurs dans la console

1. Vérifiez que Recharts est bien installé : `npm list recharts`
2. Vérifiez que la migration est appliquée : `npx prisma migrate status`
3. Régénérez le client Prisma : `npx prisma generate`

---

## ✅ Prochaines étapes

1. ✅ Créer un utilisateur admin
2. ✅ Accéder au dashboard
3. [ ] Tester avec des données réelles
4. [ ] Configurer un nettoyage automatique (optionnel)
5. [ ] Créer des alertes sur les erreurs critiques (optionnel)

---

Bon tracking ! 🚀
