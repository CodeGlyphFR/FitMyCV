/**
 * FitMyCV.io - Documentation Technique
 * JavaScript principal : recherche, navigation, Mermaid
 */

// ========================================
// INDEX DE RECHERCHE
// ========================================

const searchIndex = [
  // Accueil
  { title: "Accueil", path: "index.html", section: "Documentation", keywords: "accueil home documentation fitmycv" },

  // Architecture
  { title: "Vue d'ensemble", path: "01-architecture/overview.html", section: "Architecture", keywords: "architecture vue ensemble stack next.js react prisma" },
  { title: "Stack technologique", path: "01-architecture/tech-stack.html", section: "Architecture", keywords: "stack next.js react tailwind prisma openai stripe" },
  { title: "Base de données", path: "01-architecture/database.html", section: "Architecture", keywords: "database prisma postgresql modèles relations" },
  { title: "Patterns architecturaux", path: "01-architecture/patterns.html", section: "Architecture", keywords: "patterns feature authorization background jobs versioning" },

  // Authentification
  { title: "Authentification", path: "02-authentification/overview.html", section: "Authentification", keywords: "auth login oauth google github apple credentials" },
  { title: "OAuth Flow", path: "02-authentification/oauth-flow.html", section: "Authentification", keywords: "oauth google github apple social login" },
  { title: "Credentials Flow", path: "02-authentification/credentials-flow.html", section: "Authentification", keywords: "email password bcrypt credentials" },
  { title: "Vérification Email", path: "02-authentification/email-verification.html", section: "Authentification", keywords: "email verification token" },

  // Gestion CV
  { title: "Gestion des CV", path: "03-gestion-cv/overview.html", section: "Gestion CV", keywords: "cv gestion crud création édition" },
  { title: "CRUD CV", path: "03-gestion-cv/crud.html", section: "Gestion CV", keywords: "create read update delete cv" },
  { title: "Versioning", path: "03-gestion-cv/versioning.html", section: "Gestion CV", keywords: "version historique restauration rollback" },
  { title: "Import PDF", path: "03-gestion-cv/import-pdf.html", section: "Gestion CV", keywords: "import pdf extraction vision gpt-4o" },
  { title: "Structure CV JSON", path: "03-gestion-cv/structure-cv.html", section: "Gestion CV", keywords: "json structure header experience skills" },

  // Offres emploi
  { title: "Extraction Offres", path: "04-offres-emploi/overview.html", section: "Offres Emploi", keywords: "offre emploi extraction job offer" },
  { title: "Extraction URL", path: "04-offres-emploi/extraction-url.html", section: "Offres Emploi", keywords: "url scraping puppeteer linkedin indeed" },
  { title: "Extraction PDF", path: "04-offres-emploi/extraction-pdf.html", section: "Offres Emploi", keywords: "pdf extraction parsing" },

  // Pipeline Génération
  { title: "Pipeline Génération CV", path: "05-pipeline-generation/overview.html", section: "Pipeline Génération", keywords: "pipeline génération cv adaptation ia openai" },
  { title: "Orchestrateur", path: "05-pipeline-generation/orchestrator.html", section: "Pipeline Génération", keywords: "orchestrator task runner phases" },
  { title: "Phase Classification", path: "05-pipeline-generation/phase-classification.html", section: "Pipeline Génération", keywords: "classification keep remove move_to_projects" },
  { title: "Phase Batches", path: "05-pipeline-generation/phase-batches.html", section: "Pipeline Génération", keywords: "batch experience project skills summary extras" },
  { title: "Phase Recomposition", path: "05-pipeline-generation/phase-recompose.html", section: "Pipeline Génération", keywords: "recompose assemblage final cv" },
  { title: "Prompts IA", path: "05-pipeline-generation/prompts.html", section: "Pipeline Génération", keywords: "prompts système user openai gpt" },
  { title: "Schemas I/O", path: "05-pipeline-generation/schemas-io.html", section: "Pipeline Génération", keywords: "schemas json input output structured" },

  // Pipeline Optimisation
  { title: "Pipeline Optimisation", path: "06-pipeline-optimisation/overview.html", section: "Pipeline Optimisation", keywords: "pipeline optimisation amélioration cv" },
  { title: "Scoring Match", path: "06-pipeline-optimisation/scoring.html", section: "Pipeline Optimisation", keywords: "score matching cv offre pourcentage" },
  { title: "Suggestions IA", path: "06-pipeline-optimisation/suggestions.html", section: "Pipeline Optimisation", keywords: "suggestions amélioration ia recommandations" },
  { title: "Application Modifications", path: "06-pipeline-optimisation/application.html", section: "Pipeline Optimisation", keywords: "modifications application stages" },
  { title: "Système Review", path: "06-pipeline-optimisation/review-system.html", section: "Pipeline Optimisation", keywords: "review accept reject pending changes" },

  // CV Modèle
  { title: "Génération CV Modèle", path: "17-generation-cv-modele/overview.html", section: "CV Modèle", keywords: "cv modèle template génération fictif" },
  { title: "Depuis Offre d'Emploi", path: "17-generation-cv-modele/template-from-offer.html", section: "CV Modèle", keywords: "cv modèle offre emploi url pdf extraction" },
  { title: "Depuis Titre de Poste", path: "17-generation-cv-modele/template-from-job-title.html", section: "CV Modèle", keywords: "cv modèle titre poste job title génération" },

  // Abonnements
  { title: "Système Abonnements", path: "07-abonnements/overview.html", section: "Abonnements", keywords: "abonnement subscription stripe billing" },
  { title: "Modèles Économiques", path: "07-abonnements/business-models.html", section: "Abonnements", keywords: "modèle économique abonnement crédits" },
  { title: "Plans Stripe", path: "07-abonnements/plans-stripe.html", section: "Abonnements", keywords: "plans free pro premium stripe" },
  { title: "Checkout Flow", path: "07-abonnements/checkout-flow.html", section: "Abonnements", keywords: "checkout paiement stripe session" },
  { title: "Webhooks Stripe", path: "07-abonnements/webhooks.html", section: "Abonnements", keywords: "webhooks stripe events signature" },

  // Crédits
  { title: "Système Crédits", path: "08-credits/overview.html", section: "Crédits", keywords: "crédits balance transaction" },
  { title: "Crédits Bienvenue", path: "08-credits/welcome-credits.html", section: "Crédits", keywords: "crédits bienvenue inscription welcome" },
  { title: "Débit et Remboursement", path: "08-credits/debit-refund.html", section: "Crédits", keywords: "débit refund remboursement transaction" },
  { title: "Limites Features", path: "08-credits/feature-limits.html", section: "Crédits", keywords: "limites features compteurs mensuels" },

  // Background Jobs
  { title: "Background Jobs", path: "09-background-jobs/overview.html", section: "Background Jobs", keywords: "jobs queue tâches asynchrone" },
  { title: "Types de Tâches", path: "09-background-jobs/task-types.html", section: "Background Jobs", keywords: "task types generation import translate" },
  { title: "Concurrence", path: "09-background-jobs/concurrency.html", section: "Background Jobs", keywords: "concurrence parallèle limite queue" },

  // Export
  { title: "Export CV", path: "10-export/overview.html", section: "Export", keywords: "export cv pdf docx" },
  { title: "Export PDF", path: "10-export/pdf.html", section: "Export", keywords: "pdf puppeteer export" },
  { title: "Export DOCX", path: "10-export/docx.html", section: "Export", keywords: "docx word export" },

  // Traduction
  { title: "Traduction CV", path: "11-traduction/overview.html", section: "Traduction", keywords: "traduction cv langue multilingue" },

  // Administration
  { title: "Administration", path: "12-administration/overview.html", section: "Administration", keywords: "admin dashboard administration" },
  { title: "Gestion Utilisateurs", path: "12-administration/users.html", section: "Administration", keywords: "utilisateurs users gestion admin" },
  { title: "Mode Abonnement", path: "12-administration/subscription-mode.html", section: "Administration", keywords: "mode abonnement crédits switch" },
  { title: "Gestion Plans", path: "12-administration/plans-management.html", section: "Administration", keywords: "plans gestion création modification" },
  { title: "Packs Crédits", path: "12-administration/credit-packs.html", section: "Administration", keywords: "packs crédits prix quantité" },
  { title: "Monitoring OpenAI", path: "12-administration/openai-monitoring.html", section: "Administration", keywords: "openai monitoring coûts tokens alertes" },
  { title: "Templates Email", path: "12-administration/email-templates.html", section: "Administration", keywords: "email templates triggers" },
  { title: "Paramètres Système", path: "12-administration/settings.html", section: "Administration", keywords: "settings paramètres configuration" },

  // Onboarding
  { title: "Onboarding", path: "13-onboarding/overview.html", section: "Onboarding", keywords: "onboarding parcours guidé" },

  // Email
  { title: "Système Email", path: "14-email/overview.html", section: "Email", keywords: "email smtp resend envoi" },
  { title: "Templates", path: "14-email/templates.html", section: "Email", keywords: "templates email triggers" },

  // API
  { title: "Référence API", path: "15-api-reference/overview.html", section: "API", keywords: "api endpoints routes" },
  { title: "Endpoints Publics", path: "15-api-reference/public.html", section: "API", keywords: "api public endpoints" },
  { title: "Endpoints Authentifiés", path: "15-api-reference/authenticated.html", section: "API", keywords: "api authentifié endpoints" },
  { title: "Endpoints Admin", path: "15-api-reference/admin.html", section: "API", keywords: "api admin endpoints" },

  // Composants
  { title: "Composants React", path: "16-composants/overview.html", section: "Composants", keywords: "composants react ui components" },

  // Extension Navigateur
  { title: "Extension Navigateur", path: "18-extension/overview.html", section: "Extension Navigateur", keywords: "extension navigateur chrome firefox manifest v3 vite service worker content script popup détection extraction readability turndown" },
  { title: "Auth & Intégration SaaS", path: "18-extension/auth-integration.html", section: "Extension Navigateur", keywords: "authentification jwt extension token refresh withExtensionAuth credentials oauth polling sync" },
  { title: "Détection & Extraction Offres", path: "18-extension/detection-extraction.html", section: "Extension Navigateur", keywords: "détection extraction offres emploi json-ld dom scoring readability markdown sélecteurs css job boards linkedin indeed glassdoor" },
  { title: "Interface Popup", path: "18-extension/popup-ui.html", section: "Extension Navigateur", keywords: "popup interface dark mode vues login cv-selector offer-list progress routing i18n crédits" },

  // Déploiement
  { title: "Déploiement & Infrastructure", path: "19-deploiement/overview.html", section: "Déploiement", keywords: "docker dockerfile multi-stage github actions ci cd pre-prod staging production versioning bump puppeteer chromium health check" },

  // Middleware & Sécurité
  { title: "Middleware & Sécurité", path: "20-middleware-securite/overview.html", section: "Middleware & Sécurité", keywords: "proxy cors extension rate limiting security headers csp hsts email verification cleanup" },

  // RGPD
  { title: "RGPD & Consentement", path: "21-rgpd-consentement/overview.html", section: "RGPD & Consentement", keywords: "rgpd consentement cookies analytics broadcastchannel storage revocation registre consentlog audit rétention données suppression compte" },

  // SSE
  { title: "Événements SSE", path: "22-evenements-sse/overview.html", section: "Événements SSE", keywords: "sse server-sent events dbemitter eventemitter prisma temps réel realtime userealtimesync hook broadcast" },

  // i18n
  { title: "Internationalisation (i18n)", path: "23-i18n/overview.html", section: "Internationalisation", keywords: "i18n internationalisation langues locales json traductions fr en es de compétences cv extension" },

  // Sécurité Code
  { title: "Sécurité du Code", path: "24-securite-code/overview.html", section: "Sécurité du Code", keywords: "sécurité filevalidation magic numbers mime xss sanitisation securelogger masquage pii escape html whitelist upload validation" },

  // Scripts
  { title: "Scripts d'Automatisation", path: "25-scripts-automatisation/overview.html", section: "Scripts d'Automatisation", keywords: "scripts bash node versioning bump-version conventional commits migrations données run-data-migrations stripe sync export email templates" },

  // API Extension
  { title: "Endpoints Extension", path: "15-api-reference/extension.html", section: "API", keywords: "api ext extension endpoints jwt bearer authentication refresh generate-cv task sync background-tasks credits balance cvs polling" }
];

// ========================================
// RECHERCHE
// ========================================

function initSearch() {
  const searchInput = document.querySelector('.search-input');
  const searchContainer = document.querySelector('.search-container');

  if (!searchInput) return;

  // Créer le conteneur de résultats
  let resultsContainer = document.querySelector('.search-results');
  if (!resultsContainer) {
    resultsContainer = document.createElement('div');
    resultsContainer.className = 'search-results';
    searchContainer.style.position = 'relative';
    searchContainer.appendChild(resultsContainer);
  }

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();

    if (query.length < 2) {
      resultsContainer.classList.remove('active');
      return;
    }

    // Séparer la requête en mots individuels
    const queryWords = query.split(/\s+/).filter(w => w.length > 0);

    const results = searchIndex
      .map(item => {
        const title = item.title.toLowerCase();
        const section = item.section.toLowerCase();
        const keywords = item.keywords.toLowerCase();
        const searchText = `${title} ${section} ${keywords}`;

        // Vérifier que TOUS les mots de la requête sont présents
        const allMatch = queryWords.every(word => searchText.includes(word));
        if (!allMatch) return null;

        // Scoring : prioriser les correspondances dans le titre
        let score = 0;
        queryWords.forEach(word => {
          if (title.includes(word)) score += 3;
          if (section.includes(word)) score += 2;
          if (keywords.includes(word)) score += 1;
        });

        return { ...item, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    if (results.length === 0) {
      resultsContainer.innerHTML = '<div class="search-result-item"><div class="search-result-title">Aucun résultat</div></div>';
    } else {
      resultsContainer.innerHTML = results.map(item => `
        <div class="search-result-item" onclick="navigateTo('${item.path}')">
          <div class="search-result-title">${item.title}</div>
          <div class="search-result-path">${item.section}</div>
        </div>
      `).join('');
    }

    resultsContainer.classList.add('active');
  });

  // Fermer les résultats au clic extérieur
  document.addEventListener('click', (e) => {
    if (!searchContainer.contains(e.target)) {
      resultsContainer.classList.remove('active');
    }
  });

  // Navigation clavier
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      resultsContainer.classList.remove('active');
      searchInput.blur();
    }
  });
}

function navigateTo(path) {
  // Déterminer le chemin de base
  const currentPath = window.location.pathname;
  const depth = (currentPath.match(/\//g) || []).length;
  const basePath = depth > 2 ? '../' : '';
  window.location.href = basePath + path;
}

// ========================================
// NAVIGATION SIDEBAR (SPA-style)
// ========================================

function initNavigation() {
  // Toggle sous-menus
  document.querySelectorAll('.nav-item.has-children > a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const parent = link.parentElement;
      parent.classList.toggle('open');
    });
  });

  // Navigation AJAX pour les liens de la sidebar
  // Utiliser data-href (chemin original depuis la racine) s'il existe
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    const originalHref = link.getAttribute('data-href') || link.getAttribute('href');
    if (originalHref && originalHref !== '#' && originalHref.endsWith('.html')) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        // Passer le chemin original depuis la racine, pas le href modifié
        navigateToPage(originalHref, originalHref);
      });
    }
  });

  // Navigation AJAX pour le logo
  const logo = document.querySelector('.sidebar-logo');
  if (logo) {
    logo.addEventListener('click', (e) => {
      e.preventDefault();
      navigateToPage('index.html', 'index.html');
    });
  }

  // Gérer le bouton retour/avancer du navigateur
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.href) {
      loadPageContent(e.state.href, false);
    }
  });

  // Marquer l'élément actif initial
  updateActiveLink();

  // Initialiser les liens du contenu (breadcrumb, liens internes)
  initContentLinks();
}

// Intercepter les liens internes dans le contenu (breadcrumb + Prochaines Sections)
function initContentLinks() {
  // Breadcrumb
  const breadcrumbLinks = document.querySelectorAll('.breadcrumb a');

  breadcrumbLinks.forEach(link => {
    if (link.dataset.ajaxBound) return;
    link.dataset.ajaxBound = 'true';

    const href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#')) return;

    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateToPage(href, null);
    });
  });

  // Liens "Prochaines Sections" (h2 + ul avec liens .html)
  // Chercher les liens .html qui suivent un h2 contenant "Prochaines"
  const content = document.querySelector('.content');
  if (!content) return;

  const allLinks = content.querySelectorAll('a[href$=".html"]');
  allLinks.forEach(link => {
    if (link.dataset.ajaxBound) return;
    // Ignorer les liens du breadcrumb (déjà traités)
    if (link.closest('.breadcrumb')) return;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('http')) return;

    link.dataset.ajaxBound = 'true';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateToPage(href, href);
    });
  });
}

function getBaseUrl() {
  const url = window.location.href;
  // Support pour l'accès via l'API admin
  if (url.includes('/api/admin/docs/')) {
    return url.substring(0, url.lastIndexOf('/api/admin/docs/') + '/api/admin/docs/'.length);
  }
  // Support pour l'accès direct via html-docs
  if (url.includes('/html-docs/')) {
    return url.substring(0, url.lastIndexOf('/html-docs/') + '/html-docs/'.length);
  }
  // Fallback: utiliser le répertoire courant
  return url.substring(0, url.lastIndexOf('/') + 1);
}

function navigateToPage(href, clickedLink) {
  let targetUrl;

  console.log('[navigateToPage] href:', href, '| current URL:', window.location.href);

  if (href.startsWith('/')) {
    // Chemin absolu depuis la racine du site
    targetUrl = window.location.origin + href;
    console.log('[navigateToPage] → Chemin absolu, targetUrl:', targetUrl);
  } else if (href.startsWith('../') || href.startsWith('./')) {
    // Chemin relatif explicite : résoudre par rapport à l'URL courante
    targetUrl = new URL(href, window.location.href).href;
    console.log('[navigateToPage] → Chemin relatif explicite, targetUrl:', targetUrl);
  } else {
    // Chemin depuis la racine docs (ex: index.html, 01-architecture/overview.html)
    const baseUrl = getBaseUrl();
    targetUrl = baseUrl + href;
    console.log('[navigateToPage] → Chemin depuis racine, baseUrl:', baseUrl, '| targetUrl:', targetUrl);
  }

  // Fermer la sidebar en mode mobile
  closeSidebarMobile();

  loadPageContent(targetUrl, true, clickedLink);
}

function closeSidebarMobile() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar && window.innerWidth <= 768) {
    sidebar.classList.remove('open');
  }
}

async function loadPageContent(url, pushState = true, clickedLink = null) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Extraire le nouveau contenu
    const newContent = doc.querySelector('.content');
    const newTitle = doc.querySelector('title');

    if (newContent) {
      // Scroll à 0 AVANT de modifier le contenu pour éviter les décalages
      const main = document.querySelector('.main');
      main.scrollTop = 0;
      window.scrollTo(0, 0);

      // Remplacer le contenu
      const currentContent = document.querySelector('.content');
      currentContent.innerHTML = newContent.innerHTML;

      // Mettre à jour le titre
      if (newTitle) {
        document.title = newTitle.textContent;
      }

      // Mettre à jour l'URL
      if (pushState) {
        history.pushState({ href: url }, '', url);
      }

      // Mettre à jour le lien actif dans la sidebar
      updateActiveLink(clickedLink);

      // Réinitialiser les éléments dynamiques du contenu
      reinitContentElements();

      // Re-scroll à 0 après le rendu pour être sûr
      requestAnimationFrame(() => {
        main.scrollTop = 0;
        window.scrollTo(0, 0);
      });
    } else {
      throw new Error('Content not found in page');
    }
  } catch (error) {
    console.error('Navigation error:', error, 'URL:', url);
    // Fallback: navigation classique
    window.location.href = url;
  }
}

function updateActiveLink(clickedLinkOrHref = null) {
  // Retirer la classe active de tous les liens
  document.querySelectorAll('.nav-item a.active').forEach(link => {
    link.classList.remove('active');
  });

  let activeLink = null;
  let targetHref = null;
  let shouldForceCenter = false;

  // Déterminer le href cible
  if (clickedLinkOrHref) {
    shouldForceCenter = true;
    if (clickedLinkOrHref instanceof Element) {
      targetHref = clickedLinkOrHref.getAttribute('href');
    } else {
      targetHref = clickedLinkOrHref;
    }
  }

  // Si on a un href cible, chercher le lien exact dans la sidebar
  if (targetHref) {
    // Normaliser le href cible (retirer les ../ et ./)
    const normalizedTarget = targetHref.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '');

    const allLinks = document.querySelectorAll('.sidebar-nav a');
    for (const link of allLinks) {
      const linkHref = link.getAttribute('href');
      if (!linkHref || linkHref === '#') continue;

      // Normaliser le href du lien sidebar
      const normalizedLink = linkHref.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '');

      if (normalizedLink === normalizedTarget) {
        activeLink = link;
        break;
      }
    }
  }

  // Fallback: chercher par URL actuelle
  if (!activeLink) {
    const currentPath = window.location.pathname;
    let currentRelativePath = currentPath;

    // Support pour l'accès via l'API admin
    const apiDocsIndex = currentPath.indexOf('/api/admin/docs/');
    const htmlDocsIndex = currentPath.indexOf('html-docs/');

    if (apiDocsIndex !== -1) {
      currentRelativePath = currentPath.substring(apiDocsIndex + '/api/admin/docs/'.length);
    } else if (htmlDocsIndex !== -1) {
      currentRelativePath = currentPath.substring(htmlDocsIndex + 'html-docs/'.length);
    } else {
      const segments = currentPath.split('/').filter(s => s);
      if (segments.length >= 2 && segments[segments.length - 1].endsWith('.html')) {
        currentRelativePath = segments.slice(-2).join('/');
      } else if (segments.length >= 1) {
        currentRelativePath = segments[segments.length - 1];
      }
    }

    const allLinks = document.querySelectorAll('.sidebar-nav a');
    for (const link of allLinks) {
      const href = link.getAttribute('href');
      if (!href || href === '#') continue;

      // Normaliser le href du lien (gérer les chemins relatifs ET absolus)
      let linkPath = href;
      if (href.startsWith('/api/admin/docs/')) {
        linkPath = href.substring('/api/admin/docs/'.length);
      } else if (href.includes('html-docs/')) {
        linkPath = href.substring(href.indexOf('html-docs/') + 'html-docs/'.length);
      } else {
        linkPath = href.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '');
      }

      if (linkPath === currentRelativePath) {
        activeLink = link;
        break;
      }
    }
  }

  // Appliquer l'état actif
  if (activeLink) {
    activeLink.classList.add('active');

    // Ouvrir les parents du lien
    let parent = activeLink.closest('.nav-item.has-children');
    while (parent) {
      parent.classList.add('open');
      parent = parent.parentElement.closest('.nav-item.has-children');
    }

    // Scroll vers l'élément actif
    scrollToActiveItem(activeLink, shouldForceCenter);
  }
}

function scrollToActiveItem(activeLink, forceCenter = false) {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar || !activeLink) return;

  const sidebarHeight = sidebar.clientHeight;
  const sidebarScrollTop = sidebar.scrollTop;

  // Trouver la position absolue du lien
  let offsetTop = 0;
  let element = activeLink;
  while (element && element !== sidebar) {
    offsetTop += element.offsetTop;
    element = element.offsetParent;
  }

  const linkHeight = activeLink.offsetHeight;
  const linkTop = offsetTop - sidebarScrollTop;
  const linkBottom = linkTop + linkHeight;

  // Si pas forcé, vérifier si l'élément est déjà visible
  if (!forceCenter) {
    const margin = 50;
    if (linkTop >= margin && linkBottom <= sidebarHeight - margin) {
      return; // Déjà visible, pas besoin de scroller
    }
  }

  // Centrer l'élément
  const scrollPosition = offsetTop - (sidebarHeight / 2) + (linkHeight / 2);

  sidebar.scrollTo({
    top: Math.max(0, scrollPosition),
    behavior: 'smooth'
  });
}

function reinitContentElements() {
  // Réinitialiser les blocs de code
  initCodeCopy();

  // Réinitialiser Mermaid avec la méthode complète
  reinitMermaid();

  // Réinitialiser le zoom des diagrammes
  initDiagramZoom();

  // Réinitialiser les liens internes (breadcrumb, liens vers autres pages)
  initContentLinks();

  // Injecter la navigation précédent/suivant
  injectPageNavigation();
}

// ========================================
// NAVIGATION PAGE (Précédent/Suivant)
// ========================================

function getCurrentPageIndex() {
  const currentPath = window.location.pathname;
  let normalizedPath = currentPath;

  // Normaliser le chemin selon l'environnement
  if (currentPath.includes('/api/admin/docs/')) {
    normalizedPath = currentPath.split('/api/admin/docs/')[1];
  } else if (currentPath.includes('/html-docs/')) {
    normalizedPath = currentPath.split('/html-docs/')[1];
  }

  // Supprimer le slash initial si présent
  normalizedPath = normalizedPath.replace(/^\//, '');

  return searchIndex.findIndex(item => normalizedPath === item.path || normalizedPath.endsWith('/' + item.path));
}

function createPageNavigation() {
  const currentIndex = getCurrentPageIndex();
  if (currentIndex === -1) return null;

  const prev = currentIndex > 0 ? searchIndex[currentIndex - 1] : null;
  const next = currentIndex < searchIndex.length - 1 ? searchIndex[currentIndex + 1] : null;

  return { prev, next };
}

function getRelativeNavPath(targetPath) {
  // Calcule le chemin relatif correct depuis la page courante vers la cible
  const currentPath = window.location.pathname;

  // Extraire le dossier courant (le dossier contenant le fichier HTML actuel)
  // Ex: /05-pipeline-generation/overview.html -> "05-pipeline-generation"
  // Ex: /html-docs/05-pipeline-generation/overview.html -> "05-pipeline-generation"
  // Ex: /index.html -> ""
  // Ex: /html-docs/index.html -> ""
  let currentDir = '';

  // Nettoyer le path pour obtenir juste la partie relative à la doc
  let cleanPath = currentPath;
  if (cleanPath.includes('/api/admin/docs/')) {
    cleanPath = cleanPath.split('/api/admin/docs/')[1] || '';
  } else if (cleanPath.includes('/html-docs/')) {
    cleanPath = cleanPath.split('/html-docs/')[1] || '';
  }
  // Enlever le slash initial si présent
  cleanPath = cleanPath.replace(/^\//, '');

  // Maintenant cleanPath est genre "05-pipeline-generation/overview.html" ou "index.html"
  if (cleanPath.includes('/')) {
    currentDir = cleanPath.substring(0, cleanPath.lastIndexOf('/'));
  }

  // Extraire le dossier cible
  // Ex: "05-pipeline-generation/orchestrator.html" -> "05-pipeline-generation"
  // Ex: "index.html" -> ""
  const targetDir = targetPath.includes('/')
    ? targetPath.substring(0, targetPath.lastIndexOf('/'))
    : '';

  // Extraire juste le nom du fichier cible
  const targetFile = targetPath.includes('/')
    ? targetPath.substring(targetPath.lastIndexOf('/') + 1)
    : targetPath;

  // Debug
  console.log('[PageNav] currentPath:', currentPath, '| currentDir:', currentDir, '| targetPath:', targetPath, '| targetDir:', targetDir);

  // Calculer le chemin relatif
  if (currentDir === '' && targetDir === '') {
    // Racine -> Racine (ex: index.html -> autre.html)
    return './' + targetFile;
  } else if (currentDir === '' && targetDir !== '') {
    // Racine -> Sous-dossier (ex: index.html -> 01-architecture/overview.html)
    return targetPath;
  } else if (currentDir !== '' && targetDir === '') {
    // Sous-dossier -> Racine (ex: 01-architecture/overview.html -> index.html)
    return '../' + targetPath;
  } else if (currentDir === targetDir) {
    // Même sous-dossier (ex: overview.html -> orchestrator.html dans 05-pipeline-generation/)
    // Utiliser ./ explicite pour que navigateToPage() le traite comme relatif
    return './' + targetFile;
  } else {
    // Sous-dossiers différents (ex: 05-pipeline-generation/x.html -> 06-pipeline-optimisation/y.html)
    return '../' + targetPath;
  }
}

function renderPageNavigation(nav) {
  if (!nav) return '';
  const { prev, next } = nav;

  let html = '<nav class="page-nav">';

  if (prev) {
    const prevHref = getRelativeNavPath(prev.path);
    html += `
      <a href="${prevHref}" class="page-nav-link page-nav-prev">
        <span class="page-nav-direction">← Précédent</span>
        <span class="page-nav-title">${prev.title}</span>
        <span class="page-nav-section">${prev.section}</span>
      </a>`;
  } else {
    html += '<div class="page-nav-spacer"></div>';
  }

  if (next) {
    const nextHref = getRelativeNavPath(next.path);
    html += `
      <a href="${nextHref}" class="page-nav-link page-nav-next">
        <span class="page-nav-direction">Suivant →</span>
        <span class="page-nav-title">${next.title}</span>
        <span class="page-nav-section">${next.section}</span>
      </a>`;
  } else {
    html += '<div class="page-nav-spacer"></div>';
  }

  html += '</nav>';
  return html;
}

function injectPageNavigation() {
  const content = document.querySelector('.content');
  if (!content) return;

  // Supprimer navigation existante
  const existingNav = content.querySelector('.page-nav');
  if (existingNav) existingNav.remove();

  const nav = createPageNavigation();
  const navHtml = renderPageNavigation(nav);

  if (navHtml) {
    content.insertAdjacentHTML('beforeend', navHtml);

    // Lier à la navigation AJAX
    content.querySelectorAll('.page-nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        // Utiliser href (chemin relatif correct) pour la navigation
        // navigateToPage() sait résoudre les chemins relatifs avec ../
        navigateToPage(link.getAttribute('href'), link.getAttribute('href'));
      });
    });
  }
}

// ========================================
// TABLE DES MATIÈRES
// ========================================

function initTableOfContents() {
  const toc = document.querySelector('.toc-list');
  if (!toc) return;

  const headings = document.querySelectorAll('.content h2, .content h3');

  headings.forEach(heading => {
    // Générer un ID si nécessaire
    if (!heading.id) {
      heading.id = heading.textContent.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
  });

  // Observer pour marquer l'élément actif
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const id = entry.target.id;
      const tocLink = toc.querySelector(`a[href="#${id}"]`);
      if (tocLink) {
        if (entry.isIntersecting) {
          toc.querySelectorAll('a').forEach(a => a.classList.remove('active'));
          tocLink.classList.add('active');
        }
      }
    });
  }, { rootMargin: '-100px 0px -66% 0px' });

  headings.forEach(heading => observer.observe(heading));
}

// ========================================
// MOBILE MENU
// ========================================

function initMobileMenu() {
  const header = document.querySelector('.header');
  const sidebar = document.querySelector('.sidebar');
  const main = document.querySelector('.main');

  // Créer le bouton hamburger s'il n'existe pas
  let menuButton = document.querySelector('.mobile-menu-button');
  if (!menuButton && header) {
    menuButton = document.createElement('button');
    menuButton.className = 'mobile-menu-button';
    menuButton.title = 'Menu';
    menuButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
    </svg>`;
    header.insertBefore(menuButton, header.firstChild);
  }

  if (menuButton && sidebar) {
    menuButton.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.toggle('open');
    });
  }

  // Fermer la sidebar quand on clique sur le contenu principal
  if (main && sidebar) {
    main.addEventListener('click', () => {
      if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
      }
    });
  }
}

// ========================================
// COPIER CODE ET BADGES LANGAGE
// ========================================

const COPY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
</svg>`;

const CHECK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
</svg>`;

// Mapping des langages vers leurs noms d'affichage
const LANG_DISPLAY_NAMES = {
  'javascript': 'JavaScript',
  'js': 'JavaScript',
  'typescript': 'TypeScript',
  'ts': 'TypeScript',
  'jsx': 'JSX',
  'tsx': 'TSX',
  'java': 'Java',
  'python': 'Python',
  'py': 'Python',
  'html': 'HTML',
  'css': 'CSS',
  'json': 'JSON',
  'bash': 'Bash',
  'shell': 'Shell',
  'sh': 'Shell',
  'sql': 'SQL',
  'prisma': 'Prisma',
  'graphql': 'GraphQL',
  'yaml': 'YAML',
  'yml': 'YAML',
  'markdown': 'Markdown',
  'md': 'Markdown'
};

// Détecte le langage à partir du contenu du code
function detectLanguageFromContent(codeText) {
  const firstLine = codeText.trim().split('\n')[0].toLowerCase();

  // Détection par commentaire de fichier
  if (firstLine.includes('.js') || firstLine.includes('.jsx')) return 'javascript';
  if (firstLine.includes('.ts') || firstLine.includes('.tsx')) return 'typescript';
  if (firstLine.includes('.py')) return 'python';
  if (firstLine.includes('.java')) return 'java';
  if (firstLine.includes('.html')) return 'html';
  if (firstLine.includes('.css')) return 'css';
  if (firstLine.includes('.json')) return 'json';
  if (firstLine.includes('.sql')) return 'sql';
  if (firstLine.includes('.prisma') || firstLine.includes('prisma/schema')) return 'prisma';
  if (firstLine.includes('.sh') || firstLine.includes('bash')) return 'bash';
  if (firstLine.includes('.yaml') || firstLine.includes('.yml')) return 'yaml';
  if (firstLine.includes('.md')) return 'markdown';

  // Détection par syntaxe
  if (codeText.includes('import ') && codeText.includes('from ')) return 'javascript';
  if (codeText.includes('async function') || codeText.includes('export async')) return 'javascript';
  if (codeText.includes('interface ') && codeText.includes(': ')) return 'typescript';
  if (codeText.includes('def ') && codeText.includes(':')) return 'python';
  if (codeText.includes('public class ') || codeText.includes('private ')) return 'java';
  if (codeText.includes('<html') || codeText.includes('<!DOCTYPE')) return 'html';
  if (codeText.includes('SELECT ') || codeText.includes('INSERT INTO')) return 'sql';
  if (codeText.includes('model ') && codeText.includes('@id')) return 'prisma';
  if (codeText.startsWith('{') && codeText.includes('"')) return 'json';
  if (codeText.includes('npm ') || codeText.includes('npx ') || codeText.includes('git ')) return 'bash';

  return null;
}

function initCodeCopy() {
  document.querySelectorAll('pre').forEach(pre => {
    // Éviter de traiter deux fois
    if (pre.parentElement.classList.contains('code-block')) return;

    const codeElement = pre.querySelector('code');
    if (!codeElement) return;

    // Créer le wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block';
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    // Détecter le langage
    let lang = null;
    const codeClasses = codeElement.className.split(' ');
    for (const cls of codeClasses) {
      if (cls.startsWith('language-')) {
        lang = cls.replace('language-', '');
        break;
      }
    }

    // Si pas de classe, essayer de détecter depuis le contenu
    if (!lang) {
      lang = detectLanguageFromContent(codeElement.textContent);
    }

    // Créer le bouton copier
    const button = document.createElement('button');
    button.className = 'copy-button';
    button.innerHTML = COPY_ICON;
    button.title = 'Copier le code';

    button.addEventListener('click', () => {
      const code = codeElement.textContent;
      navigator.clipboard.writeText(code).then(() => {
        button.innerHTML = CHECK_ICON;
        button.classList.add('copied');
        setTimeout(() => {
          button.innerHTML = COPY_ICON;
          button.classList.remove('copied');
        }, 2000);
      });
    });

    // Créer le header avec badge de langage si détecté
    if (lang && LANG_DISPLAY_NAMES[lang]) {
      const header = document.createElement('div');
      header.className = 'code-block-header';

      const badge = document.createElement('span');
      badge.className = `code-lang-badge lang-${lang}`;
      badge.textContent = LANG_DISPLAY_NAMES[lang];

      header.appendChild(badge);
      header.appendChild(button); // Bouton dans le header
      wrapper.insertBefore(header, pre);

      // Ajouter la classe de langage pour Prism.js si pas déjà présente
      if (!codeElement.classList.contains(`language-${lang}`)) {
        codeElement.classList.add(`language-${lang}`);
      }
    } else {
      // Pas de header, bouton en position absolue sur le wrapper
      wrapper.appendChild(button);
    }
  });

  // Initialiser Prism.js si disponible
  if (typeof Prism !== 'undefined') {
    Prism.highlightAll();
  }
}

// ========================================
// DARK MODE
// ========================================

function initTheme() {
  // Vérifier la préférence sauvegardée ou détecter la préférence système
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  } else if (prefersDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  // Écouter les changements de préférence système
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      reinitMermaid();
    }
  });
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);

  // Réinitialiser Mermaid avec le nouveau thème
  reinitMermaid();
}

// ========================================
// MERMAID
// ========================================

function getMermaidTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    theme: isDark ? 'dark' : 'neutral',
    themeVariables: isDark ? {
      primaryColor: '#38bdf8',
      primaryTextColor: '#f1f5f9',
      primaryBorderColor: '#0ea5e9',
      lineColor: '#64748b',
      secondaryColor: '#1e293b',
      tertiaryColor: '#334155',
      fontFamily: 'Inter, sans-serif',
      background: '#0f172a'
    } : {
      primaryColor: '#0ea5e9',
      primaryTextColor: '#1e293b',
      primaryBorderColor: '#0284c7',
      lineColor: '#64748b',
      secondaryColor: '#f8fafc',
      tertiaryColor: '#f1f5f9',
      fontFamily: 'Inter, sans-serif'
    }
  };
}

function initMermaid() {
  if (typeof mermaid !== 'undefined') {
    // IMPORTANT: Stocker le code original AVANT tout rendu
    // Sinon, après le rendu, el.textContent ne contient plus le code Mermaid
    document.querySelectorAll('.mermaid').forEach(el => {
      if (!el.getAttribute('data-original') && el.textContent.trim()) {
        el.setAttribute('data-original', el.textContent);
      }
    });

    const themeConfig = getMermaidTheme();
    mermaid.initialize({
      startOnLoad: false, // Ne pas rendre automatiquement
      ...themeConfig,
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      }
    });

    // Rendre manuellement les diagrammes
    mermaid.run();
  }
}

function reinitMermaid() {
  if (typeof mermaid !== 'undefined') {
    const themeConfig = getMermaidTheme();
    mermaid.initialize({
      startOnLoad: false,
      ...themeConfig,
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      }
    });

    // Re-render les diagrammes
    document.querySelectorAll('.mermaid').forEach(el => {
      const code = el.getAttribute('data-original') || el.textContent;
      if (!el.getAttribute('data-original')) {
        el.setAttribute('data-original', code);
      }
      el.removeAttribute('data-processed');
      el.innerHTML = code;
    });
    mermaid.run();
  }
}

// ========================================
// DIAGRAM ZOOM (Lightbox)
// ========================================

function initDiagramZoom() {
  // Créer le lightbox une seule fois
  let lightbox = document.querySelector('.diagram-lightbox');
  if (!lightbox) {
    lightbox = document.createElement('div');
    lightbox.className = 'diagram-lightbox';
    lightbox.innerHTML = `
      <div class="diagram-lightbox-viewport">
        <div class="diagram-lightbox-content"></div>
      </div>
      <button class="diagram-lightbox-close" title="Fermer (Échap)">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
      <div class="diagram-lightbox-controls">
        <button class="diagram-lightbox-btn" data-action="zoom-out" title="Dézoomer">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M8 11h6"/></svg>
        </button>
        <div class="diagram-lightbox-zoom-level">100%</div>
        <button class="diagram-lightbox-btn" data-action="zoom-in" title="Zoomer">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/></svg>
        </button>
        <div class="diagram-lightbox-separator"></div>
        <button class="diagram-lightbox-btn" data-action="fit" title="Ajuster à l'écran">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
        </button>
        <button class="diagram-lightbox-btn" data-action="reset" title="Taille réelle (100%)">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9V5h4M5 15v4h4M15 5h4v4M15 19h4v-4"/></svg>
        </button>
      </div>
    `;
    document.body.appendChild(lightbox);

    const viewport = lightbox.querySelector('.diagram-lightbox-viewport');
    const content = lightbox.querySelector('.diagram-lightbox-content');
    const zoomLabel = lightbox.querySelector('.diagram-lightbox-zoom-level');

    let scale = 1;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let panStartX = 0;
    let panStartY = 0;

    const MIN_SCALE = 0.1;
    const MAX_SCALE = 8;

    function updateTransform() {
      content.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
      zoomLabel.textContent = Math.round(scale * 100) + '%';
    }

    function fitToScreen() {
      const svg = content.querySelector('svg');
      if (!svg) return;

      const svgRect = svg.getBoundingClientRect();
      const svgW = svgRect.width / scale;
      const svgH = svgRect.height / scale;
      const vpW = viewport.clientWidth;
      const vpH = viewport.clientHeight;
      const padding = 60;

      scale = Math.min((vpW - padding) / svgW, (vpH - padding) / svgH, 2);
      panX = (vpW - svgW * scale) / 2;
      panY = (vpH - svgH * scale) / 2;
      updateTransform();
    }

    function resetZoom() {
      const svg = content.querySelector('svg');
      if (!svg) return;
      scale = 1;
      const vpW = viewport.clientWidth;
      const vpH = viewport.clientHeight;
      const svgW = svg.getAttribute('width') ? parseFloat(svg.getAttribute('width')) : svg.viewBox.baseVal.width || 800;
      const svgH = svg.getAttribute('height') ? parseFloat(svg.getAttribute('height')) : svg.viewBox.baseVal.height || 400;
      panX = (vpW - svgW) / 2;
      panY = (vpH - svgH) / 2;
      updateTransform();
    }

    function zoomAtPoint(delta, clientX, clientY) {
      const rect = viewport.getBoundingClientRect();
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;

      const prevScale = scale;
      scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * delta));

      // Zoom vers le point de la souris
      panX = mouseX - (mouseX - panX) * (scale / prevScale);
      panY = mouseY - (mouseY - panY) * (scale / prevScale);
      updateTransform();
    }

    // Mouse wheel zoom
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      zoomAtPoint(delta, e.clientX, e.clientY);
    }, { passive: false });

    // Pan with drag
    viewport.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      panStartX = panX;
      panStartY = panY;
      viewport.classList.add('dragging');
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      panX = panStartX + (e.clientX - dragStartX);
      panY = panStartY + (e.clientY - dragStartY);
      updateTransform();
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
      viewport.classList.remove('dragging');
    });

    // Touch support (pinch zoom + pan)
    let lastTouchDist = 0;
    let lastTouchCenter = { x: 0, y: 0 };

    viewport.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        panStartX = panX;
        panStartY = panY;
      } else if (e.touches.length === 2) {
        isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastTouchDist = Math.hypot(dx, dy);
        lastTouchCenter = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2
        };
      }
    }, { passive: true });

    viewport.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && isDragging) {
        panX = panStartX + (e.touches[0].clientX - dragStartX);
        panY = panStartY + (e.touches[0].clientY - dragStartY);
        updateTransform();
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (lastTouchDist > 0) {
          const delta = dist / lastTouchDist;
          const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          zoomAtPoint(delta, cx, cy);
        }
        lastTouchDist = dist;
      }
    }, { passive: false });

    viewport.addEventListener('touchend', () => {
      isDragging = false;
      lastTouchDist = 0;
    }, { passive: true });

    // Control buttons
    lightbox.querySelectorAll('.diagram-lightbox-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const vpW = viewport.clientWidth;
        const vpH = viewport.clientHeight;
        if (action === 'zoom-in') zoomAtPoint(1.3, vpW / 2, vpH / 2);
        else if (action === 'zoom-out') zoomAtPoint(1 / 1.3, vpW / 2, vpH / 2);
        else if (action === 'fit') fitToScreen();
        else if (action === 'reset') resetZoom();
      });
    });

    // Close handlers
    function closeLightbox() {
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
    }

    lightbox.querySelector('.diagram-lightbox-close').addEventListener('click', closeLightbox);

    // Close on click background (not on the SVG itself)
    viewport.addEventListener('click', (e) => {
      // Only close if it was a simple click (no drag movement)
      if (e.target === viewport) closeLightbox();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lightbox.classList.contains('active')) {
        closeLightbox();
      }
    });

    // Open function
    lightbox._open = function(svgElement) {
      const svgClone = svgElement.cloneNode(true);
      // Supprimer les contraintes de taille
      svgClone.style.maxWidth = 'none';
      svgClone.style.maxHeight = 'none';
      svgClone.removeAttribute('width');
      svgClone.removeAttribute('height');

      // Utiliser le viewBox pour dimensionner correctement
      const viewBox = svgClone.getAttribute('viewBox');
      if (viewBox) {
        const parts = viewBox.split(/\s+/);
        const vbW = parseFloat(parts[2]);
        const vbH = parseFloat(parts[3]);
        svgClone.setAttribute('width', vbW);
        svgClone.setAttribute('height', vbH);
      }

      content.innerHTML = '';
      content.appendChild(svgClone);

      scale = 1;
      panX = 0;
      panY = 0;
      updateTransform();

      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';

      // Fit après que le SVG soit rendu
      requestAnimationFrame(() => fitToScreen());
    };
  }

  // Attacher les click handlers à tous les diagrammes Mermaid
  document.querySelectorAll('.mermaid').forEach(el => {
    if (el.dataset.zoomBound) return;
    el.dataset.zoomBound = 'true';

    el.addEventListener('click', () => {
      const svg = el.querySelector('svg');
      if (svg) {
        document.querySelector('.diagram-lightbox')._open(svg);
      }
    });
  });
}

// ========================================
// INITIALISATION
// ========================================

// Initialiser le thème immédiatement pour éviter le flash
initTheme();

// Fonction d'initialisation principale
function initAll() {
  initSearch();
  initNavigation();
  initTableOfContents();
  initMobileMenu();
  initCodeCopy();
  initMermaid();
  initDiagramZoom();
  injectPageNavigation();
}

// Support pour les deux modes :
// 1. Avec layout.js (nouvelles pages) : attendre layoutReady
// 2. Sans layout.js (anciennes pages) : DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  // Si la sidebar existe déjà (ancien format), initialiser directement
  if (document.querySelector('.sidebar-nav')) {
    initAll();
  }
});

// Écouter l'événement layoutReady (nouveau format avec templates)
document.addEventListener('layoutReady', () => {
  initAll();
});
