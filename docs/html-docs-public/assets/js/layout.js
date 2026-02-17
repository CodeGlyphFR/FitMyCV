/**
 * FitMyCV.io - Documentation Technique
 * Layout injection : charge sidebar et header depuis les templates
 */

// Base absolue des docs (toujours /docs/)
const DOCS_BASE = '/docs/';


// Charger et injecter le layout (sidebar + header)
async function initLayout() {
  try {
    // Charger sidebar et header en parallèle (chemins absolus)
    const [sidebarRes, headerRes] = await Promise.all([
      fetch(DOCS_BASE + 'templates/sidebar.html'),
      fetch(DOCS_BASE + 'templates/header.html')
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
