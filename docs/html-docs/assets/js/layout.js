/**
 * FitMyCV.io - Documentation Technique
 * Layout injection : charge sidebar et header depuis les templates
 */

// Déterminer si on est dans un sous-dossier (ex: 01-architecture/)
function isInSubfolder() {
  const path = window.location.pathname;
  // Chercher un pattern comme /01-architecture/ ou /05-pipeline-generation/
  return /\/\d{2}-[^/]+\//.test(path);
}

// Obtenir le préfixe pour remonter à la racine
function getPrefix() {
  return isInSubfolder() ? '../' : '';
}

// Corriger les liens de la sidebar après injection
function fixSidebarLinks() {
  const prefix = getPrefix();
  if (!prefix) return; // Pas besoin de corriger si on est à la racine

  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  sidebar.querySelectorAll('a').forEach(link => {
    const href = link.getAttribute('href');
    // Ignorer les liens vides, les ancres, les URLs absolues et les liens déjà corrigés
    if (!href || href === '#' || href.startsWith('http') || href.startsWith('/') || href.startsWith('../')) {
      return;
    }
    // Ajouter le préfixe pour remonter à la racine
    link.setAttribute('href', prefix + href);
  });
}

// Charger et injecter le layout (sidebar + header)
async function initLayout() {
  const prefix = getPrefix();

  try {
    // Charger sidebar et header en parallèle
    const [sidebarRes, headerRes] = await Promise.all([
      fetch(prefix + 'templates/sidebar.html'),
      fetch(prefix + 'templates/header.html')
    ]);

    if (!sidebarRes.ok || !headerRes.ok) {
      console.error('Erreur chargement templates:', sidebarRes.status, headerRes.status);
      return;
    }

    const [sidebarHtml, headerHtml] = await Promise.all([
      sidebarRes.text(),
      headerRes.text()
    ]);

    // Injecter la sidebar
    const sidebarContainer = document.getElementById('sidebar-container');
    if (sidebarContainer) {
      sidebarContainer.outerHTML = sidebarHtml;
    }

    // Corriger les liens de la sidebar
    fixSidebarLinks();

    // Injecter le header
    const headerContainer = document.getElementById('header-container');
    if (headerContainer) {
      headerContainer.outerHTML = headerHtml;
    }

    // Signaler que le layout est prêt
    document.dispatchEvent(new CustomEvent('layoutReady'));

  } catch (error) {
    console.error('Erreur initialisation layout:', error);
  }
}

// Exécuter dès que possible
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLayout);
} else {
  initLayout();
}
