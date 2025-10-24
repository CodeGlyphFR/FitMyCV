# Guide Administrateur - FitMyCv.ai

Guide complet du dashboard admin et de la gestion de FitMyCv.ai.

---

## Table des matières

- [Accès admin](#accès-admin)
- [Dashboard Overview](#dashboard-overview)
- [Gestion des utilisateurs](#gestion-des-utilisateurs)
- [Analytics](#analytics)
- [Settings](#settings)
- [Monitoring OpenAI](#monitoring-openai)
- [Plans d'abonnement](#plans-dabonnement)
- [Maintenance](#maintenance)

---

## Accès admin

### Obtenir le rôle admin

**Méthode 1 : Via Prisma Studio**

```bash
npx prisma studio
```

1. Ouvrir la table `User`
2. Trouver votre utilisateur
3. Changer le champ `role` de `"USER"` à `"ADMIN"`
4. Sauvegarder

**Méthode 2 : Via SQL direct**

```sql
UPDATE User
SET role = 'ADMIN'
WHERE email = 'votre@email.com';
```

### Se connecter

1. Aller sur `/admin/analytics`
2. Le middleware vérifie le rôle
3. Si non admin → redirection `/`

---

## Dashboard Overview

### URL

```
http://localhost:3001/admin/analytics
```

### Tabs disponibles

| Tab | Description |
|-----|-------------|
| **Overview** | Vue d'ensemble : KPIs, graphiques |
| **Users** | Gestion des utilisateurs |
| **Features** | Analytics par feature |
| **Errors** | Logs d'erreurs |
| **Feedback** | Feedbacks utilisateurs |
| **OpenAI Costs** | Coûts et usage OpenAI |
| **Exports** | Analytics des exports PDF |
| **Settings** | Configuration globale |
| **Subscription Plans** | Gestion des plans d'abonnement |

### Navigation entre les onglets

**Amélioration UX** :

- **Drag-to-scroll** : Cliquez et glissez sur la barre d'onglets pour scroller horizontalement
- **Scrollbar masquée** : La scrollbar horizontale est invisible pour un rendu plus épuré
- **Curseur visuel** : Le curseur change en main (`grab`/`grabbing`) pour indiquer l'action de drag
- **Support mobile** : Fonctionne aussi au doigt sur tablette/smartphone (swipe horizontal)
- **Responsive** : S'adapte à toutes les tailles d'écran

**Composant** : `TabsBar` (`components/admin/TabsBar.jsx`)

### KPIs principaux

**Overview Tab** affiche :

- **Total Users** : Nombre d'utilisateurs inscrits
- **New Users (7d)** : Nouveaux utilisateurs (7 derniers jours)
- **Total CVs** : Nombre total de CVs générés
- **CVs Generated (7d)** : CVs générés (7 derniers jours)
- **OpenAI Cost (30d)** : Coût OpenAI (30 derniers jours)
- **Avg Match Score** : Score de correspondance moyen

---

## Gestion des utilisateurs

### UsersTab

#### Fonctionnalités

1. **Liste paginée** : 50 utilisateurs par page
2. **Recherche** : Par email ou nom
3. **Filtres** :
   - Rôle (USER/ADMIN)
   - Date d'inscription
   - Email vérifié
4. **Actions** :
   - Voir détails
   - Changer rôle
   - Supprimer utilisateur

#### Détails utilisateur

Cliquer sur un utilisateur affiche :

- **Informations** : Email, nom, rôle, date d'inscription
- **CVs** : Liste des CVs créés
- **Feedbacks** : Feedbacks soumis
- **Telemetry** : Événements trackés
- **OpenAI Usage** : Coûts par feature/modèle

#### Supprimer un utilisateur

1. Cliquer sur "Supprimer"
2. Confirmer dans le dialog
3. L'utilisateur est supprimé avec :
   - Tous ses CVs (fichiers + metadata)
   - Tous ses feedbacks
   - Toute sa telemetry
   - Tous ses consentements
   - Cascade delete via Prisma

**Code** :

```javascript
// app/api/admin/users/[userId]/route.js
export async function DELETE(request, { params }) {
  const session = await requireAdmin();

  const { userId } = params;

  await prisma.user.delete({
    where: { id: userId }
  });

  return NextResponse.json({ success: true });
}
```

---

## Analytics

### FeaturesTab

**Métriques par feature** :

- **Feature Name** : generate_cv, import_pdf, translate_cv, etc.
- **Usage Count** : Nombre d'utilisations
- **Avg Duration** : Durée moyenne (ms)
- **Success Rate** : Taux de succès (%)
- **Last Used** : Dernière utilisation

**Graphiques** :

- Usage dans le temps (par jour)
- Distribution par niveau d'analyse (rapid/medium/deep)
- Top utilisateurs par feature

### ErrorsTab

**Logs d'erreurs** :

- **Date/Time** : Horodatage
- **Type** : Type d'erreur (CV_GENERATION_FAILED, etc.)
- **Message** : Message d'erreur
- **User** : Utilisateur concerné
- **Stack Trace** : Trace complète (expandable)

**Filtres** :

- Type d'erreur
- Période
- Utilisateur
- Statut (new/resolved)

### FeedbackTab

**Feedbacks utilisateurs** :

- **Rating** : 1-5 étoiles
- **Comment** : Texte du feedback
- **Is Bug Report** : Flag bug
- **Context** : CV, page URL, user agent
- **Status** : new, reviewed, resolved

**Actions** :

- Marquer comme reviewed
- Marquer comme resolved
- Répondre (si email configuré)
- Supprimer

---

## Settings

### SettingsTab

#### Catégories

1. **ai_models** : Configuration des modèles OpenAI
2. **features** : Activation/désactivation de features
3. **general** : Configuration générale

#### Settings AI Models

| Setting Name | Value | Description |
|-------------|-------|-------------|
| `model_analysis_rapid` | gpt-5-nano-2025-08-07 | Modèle pour analyse rapide |
| `model_analysis_medium` | gpt-5-mini-2025-08-07 | Modèle pour analyse standard |
| `model_analysis_deep` | gpt-5-2025-08-07 | Modèle pour analyse approfondie |

#### Settings Features

| Setting Name | Value | Description |
|-------------|-------|-------------|
| `registration_enabled` | 1 | Autoriser les inscriptions (0 = fermé) |
| `maintenance_mode` | 0 | Mode maintenance (1 = activé) |

#### Actions

- **Créer setting** : Nouveau setting custom
- **Modifier setting** : Changer la valeur
- **Supprimer setting** : Supprimer (avec confirmation)
- **Historique** : Voir l'historique des modifications

**Code** :

```javascript
// Modifier un setting
PUT /api/admin/settings/[id]
{
  "value": "nouvelle-valeur"
}
```

---

## Monitoring OpenAI

### OpenAICostsTab

#### Vue d'ensemble

**Métriques** :

- **Total Cost (30d)** : Coût total sur 30 jours
- **Total Tokens (30d)** : Tokens consommés
- **Total Calls (30d)** : Nombre d'appels OpenAI
- **Avg Cost per Call** : Coût moyen par appel

#### Graphiques

1. **Évolution des coûts** (daily)
   - Ligne temporelle
   - Coût par jour
   - Zoom sur période

2. **Répartition par modèle**
   - Pie chart
   - % par modèle (nano/mini/full)

3. **Répartition par feature**
   - Bar chart
   - generate_cv, import_pdf, translate_cv, etc.

4. **Top utilisateurs**
   - Table des 10 users les plus coûteux
   - Coût total + breakdown

#### Alertes OpenAI

Configurer des alertes de coûts :

**Types d'alertes** :

| Type | Description | Exemple |
|------|-------------|---------|
| `user_daily` | Limite quotidienne par user | $5/jour |
| `user_monthly` | Limite mensuelle par user | $50/mois |
| `global_daily` | Limite quotidienne globale | $100/jour |
| `global_monthly` | Limite mensuelle globale | $1000/mois |
| `feature_daily` | Limite quotidienne par feature | $20/jour |

**Création d'alerte** :

```javascript
POST /api/admin/openai-alerts
{
  "type": "global_daily",
  "threshold": 100.00,
  "name": "Limite globale journalière",
  "description": "Alerte si coût > $100/jour",
  "enabled": true
}
```

#### Tarification OpenAI

**OpenAIPricing** table :

Configurer les prix par modèle :

```javascript
POST /api/admin/openai-pricing
{
  "modelName": "gpt-5-nano-2025-08-07",
  "inputPricePerMToken": 0.10,
  "outputPricePerMToken": 0.40,
  "cachePricePerMToken": 0.05,
  "description": "Modèle rapide et économique",
  "isActive": true
}
```

#### Balance OpenAI

**OpenAI Balance Check** :

```javascript
GET /api/admin/openai-balance
```

Affiche :

- **Available** : Solde disponible
- **Used** : Solde utilisé
- **Total** : Solde total

---

## Plans d'abonnement

### SubscriptionPlansTab

#### Structure

**Plan** :

- **Name** : Gratuit, Pro, Premium
- **Description** : Description du plan
- **Price Monthly** : Prix mensuel (€)
- **Price Yearly** : Prix annuel (€)
- **Yearly Discount** : % de réduction annuelle
- **Max CV Count** : Nombre max de CVs (-1 = illimité)

#### Feature Limits

Chaque plan a des limites par feature :

**SubscriptionPlanFeatureLimit** :

| Feature | Enabled | Usage Limit | Allowed Analysis Levels |
|---------|---------|-------------|-------------------------|
| `generate_cv` | ✅ | -1 (illimité) | ["rapid", "medium", "deep"] |
| `import_pdf` | ✅ | 10/mois | ["medium"] |
| `translate_cv` | ✅ | 5/mois | - |
| `calculate_match_score` | ✅ | -1 | - |
| `export_cv` | ✅ | -1 | - |

**Exemple : Plan Gratuit**

```javascript
{
  "name": "Gratuit",
  "description": "Idéal pour débuter",
  "priceMonthly": 0,
  "priceYearly": 0,
  "maxCvCount": 3,
  "featureLimits": [
    {
      "featureName": "generate_cv",
      "isEnabled": true,
      "usageLimit": 3,  // 3 générations/mois
      "allowedAnalysisLevels": ["rapid"]
    },
    {
      "featureName": "import_pdf",
      "isEnabled": false,
      "usageLimit": 0
    }
  ]
}
```

#### CRUD Plans

**Créer plan** :

```javascript
POST /api/admin/subscription-plans
{
  "name": "Pro",
  "description": "Pour professionnels",
  "priceMonthly": 9.99,
  "priceYearly": 99.99,
  "yearlyDiscountPercent": 16.7,
  "priceCurrency": "EUR",
  "maxCvCount": -1  // Illimité
}
```

**Modifier plan** :

```javascript
PUT /api/admin/subscription-plans/[id]
{
  "priceMonthly": 14.99
}
```

**Supprimer plan** :

```javascript
DELETE /api/admin/subscription-plans/[id]
```

---

## Maintenance

### Mode maintenance

**Activer** :

```javascript
PUT /api/admin/settings/{settingId}
{
  "value": "1"  // maintenance_mode
}
```

Quand activé :

- Message affiché sur toutes les pages
- Seuls les admins peuvent accéder
- Nouvelles inscriptions bloquées

### Désactiver les inscriptions

```javascript
PUT /api/admin/settings/{settingId}
{
  "value": "0"  // registration_enabled
}
```

### Nettoyage télémétrie

Supprimer les anciennes données de télémétrie :

```javascript
POST /api/admin/telemetry/cleanup
{
  "olderThan": "90d"  // Supprimer données > 90 jours
}
```

**Types de données** :

- TelemetryEvent
- FeatureUsage (anciennes périodes)
- OpenAICall (logs individuels)

**Notes** :

- OpenAIUsage (agrégations) : conservé indéfiniment
- Logs de sécurité : conservés 1 an minimum

### Nettoyage tâches orphelines

Exécuté automatiquement au démarrage du serveur (`instrumentation.js`) :

```javascript
// Marquer les tâches running/queued comme failed
await prisma.backgroundTask.updateMany({
  where: {
    status: { in: ['running', 'queued'] }
  },
  data: {
    status: 'failed',
    error: 'Server restarted while task was in progress'
  }
});
```

---

**Dashboard admin complet** | Monitoring, Analytics, Configuration, Sécurité
