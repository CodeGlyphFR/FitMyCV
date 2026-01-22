# Guide de Contribution - Documentation HTML

Ce document décrit la méthodologie à suivre pour ajouter ou modifier des éléments dans la documentation HTML de FitMyCV.io.

## Structure des Fichiers

```
docs/html-docs/
├── index.html                    # Page d'accueil
├── assets/
│   ├── css/style.css            # Styles (classes CSS disponibles)
│   └── js/main.js               # Navigation, recherche, Mermaid
├── templates/
│   ├── sidebar.html             # Menu de navigation latéral
│   └── header.html              # En-tête avec recherche
└── XX-nom-section/              # Dossiers de sections (numérotés)
    ├── overview.html            # Vue d'ensemble de la section
    └── *.html                   # Pages de détail
```

## Checklist pour Ajouter une Nouvelle Section

### 1. Créer le Dossier et les Fichiers HTML

**Emplacement** : `docs/html-docs/XX-nom-section/`

- Utiliser un numéro de section cohérent avec l'ordre logique (ex: `17-generation-cv-modele`)
- Créer au minimum un fichier `overview.html`
- Chaque fichier HTML doit suivre le template standard (voir section Template)

### 2. Mettre à Jour le Sidebar

**Fichier** : `docs/html-docs/templates/sidebar.html`

Ajouter la nouvelle section dans la zone appropriée :

```html
<li class="nav-item has-children">
  <a href="#">Nom Section</a>
  <ul class="nav-children nav-list">
    <li class="nav-item"><a href="XX-nom-section/overview.html">Vue d'ensemble</a></li>
    <li class="nav-item"><a href="XX-nom-section/page1.html">Page 1</a></li>
    <li class="nav-item"><a href="XX-nom-section/page2.html">Page 2</a></li>
  </ul>
</li>
```

**Note** : Utiliser les entités HTML pour les caractères spéciaux (ex: `&eacute;` pour `é`, `&egrave;` pour `è`).

### 3. Mettre à Jour l'Index Principal

**Fichier** : `docs/html-docs/index.html`

Ajouter une entrée dans la table "Structure de la Documentation" :

```html
<tr>
  <td><strong>Nom Section</strong></td>
  <td>Description courte de la section</td>
</tr>
```

### 4. Mettre à Jour le searchIndex (Navigation Prev/Next)

**Fichier** : `docs/html-docs/assets/js/main.js`

Ajouter les nouvelles pages dans le tableau `searchIndex` :

```javascript
// Nom Section
{ title: "Titre Page", path: "XX-nom-section/overview.html", section: "Nom Section", keywords: "mots clés recherche" },
{ title: "Titre Page 2", path: "XX-nom-section/page2.html", section: "Nom Section", keywords: "mots clés" },
```

**Important** : L'ordre dans `searchIndex` détermine la navigation Précédent/Suivant. Les boutons sont générés automatiquement par JavaScript.

### 5. Mettre à Jour l'API Reference (si endpoints)

**Fichier** : `docs/html-docs/15-api-reference/authenticated.html` (ou `admin.html`, `public.html`)

Ajouter les endpoints avec leur documentation :

```html
<h2>Nom Section</h2>

<table>
  <thead>
    <tr>
      <th>Endpoint</th>
      <th>Méthode</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>/api/xxx</code></td>
      <td>POST</td>
      <td>Description</td>
    </tr>
  </tbody>
</table>
```

## Template de Page HTML

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Titre Page | FitMyCV.io</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../assets/css/style.css?v=1.0.4">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css">

  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>mermaid.initialize({ startOnLoad: false });</script>
</head>
<body>
  <div class="layout">
    <!-- Sidebar injectée par layout.js -->
    <div id="sidebar-container"></div>

    <!-- Main Content -->
    <main class="main">
      <!-- Header injecté par layout.js -->
      <div id="header-container"></div>

      <div class="content">
        <!-- Breadcrumb -->
        <div class="breadcrumb">
          <a href="../index.html">Docs</a>
          <span>/</span>
          <a href="./overview.html">Nom Section</a>
          <span>/</span>
          <span>Titre Page</span>
        </div>

        <!-- Contenu -->
        <h1>Titre Page</h1>
        <p class="lead">Description introductive de la page.</p>

        <!-- ... contenu ... -->

      </div>
    </main>
  </div>

  <!-- Scripts Prism.js -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js"></script>
  <!-- ... autres langages selon besoin ... -->

  <script src="../assets/js/layout.js?v=1.0.4"></script>
  <script src="../assets/js/main.js?v=1.0.4"></script>
</body>
</html>
```

## Composants UI Disponibles

### Callout (encadré informatif)

```html
<div class="callout callout-info">
  <div class="callout-title">Titre</div>
  <p>Contenu du callout.</p>
</div>
```

Classes disponibles : `callout-info`, `callout-warning`, `callout-success`

### Diagramme Mermaid

```html
<div class="diagram">
  <div class="diagram-title">Titre du diagramme</div>
  <div class="mermaid">
flowchart TB
    A[Étape 1] --> B[Étape 2]
    B --> C[Étape 3]
  </div>
</div>
```

**Règle importante** : Pour empiler des subgraphs verticalement, utiliser `flowchart TB` avec une liaison invisible `~~~` :

```
flowchart TB
    subgraph A["Bloc 1"]
        direction LR
        ...
    end
    subgraph B["Bloc 2"]
        direction LR
        ...
    end
    A ~~~ B
```

### Data Flow (Input/Process/Output)

```html
<div class="data-flow">
  <div class="data-flow-header">
    <span class="data-flow-badge input">INPUT</span>
    <span class="data-flow-title">Titre</span>
  </div>
  <div class="data-flow-content">
    <h5>Sous-titre</h5>
    <p>Description...</p>
    <pre><code class="language-json">{ "exemple": "code" }</code></pre>
  </div>
</div>
```

Badges disponibles : `input`, `process`, `output`, `ai`

### Table

```html
<table>
  <thead>
    <tr>
      <th>Colonne 1</th>
      <th>Colonne 2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Valeur 1</td>
      <td>Valeur 2</td>
    </tr>
  </tbody>
</table>
```

### Card Grid

```html
<div class="card-grid">
  <div class="card">
    <h4>Titre Card</h4>
    <p>Description de la card.</p>
  </div>
  <div class="card">
    <h4>Titre Card 2</h4>
    <p>Description.</p>
  </div>
</div>
```

### Section "Prochaines Sections"

À placer en fin de page overview :

```html
<h2>Prochaines Sections</h2>

<ul>
  <li><a href="./page1.html">Page 1</a> - Description courte</li>
  <li><a href="./page2.html">Page 2</a> - Description courte</li>
</ul>
```

## Règles de Contenu

### Structure d'une Page de Documentation

1. **Breadcrumb** - Navigation fil d'Ariane
2. **Titre H1** - Titre principal de la page
3. **Lead** - Paragraphe introductif (classe `lead`)
4. **Callout Coût** - Si la fonctionnalité consomme des crédits
5. **Diagramme principal** - Vue d'ensemble du flux
6. **Data Flow détaillé** - Étapes avec INPUT/PROCESS/OUTPUT
7. **Tables** - Erreurs, fichiers clés, endpoints
8. **Prochaines Sections** - Liens vers pages de détail (overview uniquement)

### Conventions de Nommage

- **Fichiers** : kebab-case (`template-from-offer.html`)
- **Dossiers** : numéro + kebab-case (`17-generation-cv-modele`)
- **IDs HTML** : kebab-case
- **Classes CSS** : kebab-case avec préfixes (`data-flow-`, `page-nav-`)

### Caractères Spéciaux (Entités HTML)

| Caractère | Entité |
|-----------|--------|
| é | `&eacute;` |
| è | `&egrave;` |
| ê | `&ecirc;` |
| à | `&agrave;` |
| ù | `&ugrave;` |
| ô | `&ocirc;` |
| î | `&icirc;` |
| ç | `&ccedil;` |

## Vérification

Après modification, vérifier :

1. [ ] La page s'affiche correctement dans le navigateur
2. [ ] Le sidebar affiche la nouvelle section
3. [ ] Les diagrammes Mermaid se rendent correctement
4. [ ] La navigation Précédent/Suivant fonctionne
5. [ ] La recherche trouve les nouvelles pages
6. [ ] Les liens de navigation (breadcrumb) fonctionnent
