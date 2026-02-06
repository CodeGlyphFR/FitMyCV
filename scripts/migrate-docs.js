#!/usr/bin/env node

/**
 * Script de migration pour la documentation HTML FitMyCV.io
 *
 * Ce script convertit les fichiers HTML existants (avec sidebar/header dupliqués)
 * vers le nouveau format simplifié utilisant l'injection JavaScript.
 *
 * Usage: node scripts/migrate-docs.js
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '../docs/html-docs');

// Trouver tous les fichiers HTML récursivement
function findHtmlFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Ignorer le dossier templates et assets
      if (entry.name !== 'templates' && entry.name !== 'assets') {
        findHtmlFiles(fullPath, files);
      }
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files;
}

// Extraire le contenu entre des balises
function extractContent(html, startMarker, endMarker) {
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker, startIdx);

  if (startIdx === -1 || endIdx === -1) return null;

  return html.substring(startIdx + startMarker.length, endIdx);
}

// Extraire le titre de la page
function extractTitle(html) {
  const match = html.match(/<title>([^<]+)<\/title>/);
  return match ? match[1] : 'Documentation';
}

// Extraire le contenu de .content (innerHTML)
function extractContentDiv(html) {
  // Trouver <div class="content">
  const contentStart = html.indexOf('<div class="content">');
  if (contentStart === -1) return null;

  // Trouver la balise fermante correspondante
  let depth = 1;
  let pos = contentStart + '<div class="content">'.length;
  const startContent = pos;

  while (depth > 0 && pos < html.length) {
    const nextOpen = html.indexOf('<div', pos);
    const nextClose = html.indexOf('</div>', pos);

    if (nextClose === -1) break;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + 4;
    } else {
      depth--;
      if (depth === 0) {
        return html.substring(startContent, nextClose).trim();
      }
      pos = nextClose + 6;
    }
  }

  return null;
}

// Calculer le chemin relatif vers la racine
function getRelativePath(filePath) {
  const relativePath = path.relative(DOCS_DIR, path.dirname(filePath));
  if (!relativePath) return './';

  const depth = relativePath.split(path.sep).length;
  return '../'.repeat(depth);
}

// Générer le nouveau HTML
function generateNewHtml(title, content, relativePath) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${relativePath}assets/css/style.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
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
        ${content}
      </div>
    </main>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-typescript.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-jsx.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-tsx.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-bash.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-sql.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-yaml.min.js"></script>

  <script src="${relativePath}assets/js/layout.js"></script>
  <script src="${relativePath}assets/js/main.js"></script>
</body>
</html>
`;
}

// Traiter un fichier
function processFile(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');

  // Vérifier si le fichier a déjà été migré
  if (html.includes('id="sidebar-container"')) {
    console.log(`  [SKIP] ${path.relative(DOCS_DIR, filePath)} - déjà migré`);
    return false;
  }

  const title = extractTitle(html);
  const content = extractContentDiv(html);

  if (!content) {
    console.log(`  [WARN] ${path.relative(DOCS_DIR, filePath)} - contenu non trouvé`);
    return false;
  }

  const relativePath = getRelativePath(filePath);
  const newHtml = generateNewHtml(title, content, relativePath);

  // Sauvegarder
  fs.writeFileSync(filePath, newHtml, 'utf8');

  // Calculer la réduction de taille
  const oldSize = html.length;
  const newSize = newHtml.length;
  const reduction = Math.round((1 - newSize / oldSize) * 100);

  console.log(`  [OK] ${path.relative(DOCS_DIR, filePath)} (${reduction}% réduit)`);
  return true;
}

// Main
function main() {
  console.log('=== Migration Documentation HTML FitMyCV.io ===\n');
  console.log(`Dossier : ${DOCS_DIR}\n`);

  // Vérifier que les templates existent
  const sidebarPath = path.join(DOCS_DIR, 'templates/sidebar.html');
  const headerPath = path.join(DOCS_DIR, 'templates/header.html');
  const layoutPath = path.join(DOCS_DIR, 'assets/js/layout.js');

  if (!fs.existsSync(sidebarPath)) {
    console.error('ERREUR: templates/sidebar.html non trouvé');
    process.exit(1);
  }
  if (!fs.existsSync(headerPath)) {
    console.error('ERREUR: templates/header.html non trouvé');
    process.exit(1);
  }
  if (!fs.existsSync(layoutPath)) {
    console.error('ERREUR: assets/js/layout.js non trouvé');
    process.exit(1);
  }

  console.log('Templates trouvés ✓\n');

  // Trouver et traiter tous les fichiers HTML
  const files = findHtmlFiles(DOCS_DIR);
  console.log(`${files.length} fichiers HTML trouvés\n`);
  console.log('Migration en cours...\n');

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    try {
      if (processFile(file)) {
        migrated++;
      } else {
        skipped++;
      }
    } catch (error) {
      console.log(`  [ERR] ${path.relative(DOCS_DIR, file)} - ${error.message}`);
      failed++;
    }
  }

  console.log('\n=== Résultat ===');
  console.log(`Migrés : ${migrated}`);
  console.log(`Ignorés : ${skipped}`);
  console.log(`Erreurs : ${failed}`);
  console.log(`Total : ${files.length}`);
}

main();
