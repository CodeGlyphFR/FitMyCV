#!/usr/bin/env node

/**
 * Corrige les liens du breadcrumb pour utiliser des chemins absolus
 * depuis la racine de la documentation
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
      if (entry.name !== 'templates' && entry.name !== 'assets') {
        findHtmlFiles(fullPath, files);
      }
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files;
}

// Corriger les breadcrumbs dans un fichier
function fixBreadcrumbs(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(DOCS_DIR, filePath);
  const dirName = path.dirname(relativePath);

  // Si le fichier est à la racine, pas de correction nécessaire
  if (dirName === '.') {
    return false;
  }

  let modified = false;

  // Pattern pour trouver les liens du breadcrumb avec des chemins relatifs simples
  // Ex: <a href="overview.html">Email</a>
  const breadcrumbRegex = /(<div class="breadcrumb">[\s\S]*?<a href=")([^"\/][^"]*\.html)(">[^<]+<\/a>)/g;

  html = html.replace(breadcrumbRegex, (match, before, href, after) => {
    // Si le lien ne contient pas de dossier et n'est pas ../
    if (!href.includes('/') && !href.startsWith('.')) {
      // Ajouter le dossier courant
      const newHref = dirName + '/' + href;
      console.log(`  ${relativePath}: "${href}" -> "${newHref}"`);
      modified = true;
      return before + newHref + after;
    }
    return match;
  });

  if (modified) {
    fs.writeFileSync(filePath, html, 'utf8');
  }

  return modified;
}

// Main
function main() {
  console.log('=== Correction des breadcrumbs ===\n');

  const files = findHtmlFiles(DOCS_DIR);
  let fixed = 0;

  for (const file of files) {
    if (fixBreadcrumbs(file)) {
      fixed++;
    }
  }

  console.log(`\n${fixed} fichiers corrigés`);
}

main();
