import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { promises as fs } from "fs";
import path from "path";
import { auth } from "@/lib/auth/session";
import { readUserCvFileWithMeta } from "@/lib/cv/storage";
import { formatPhoneNumber } from "@/lib/utils/phoneFormatting";

// French translations (split by category)
import frUi from "@/locales/fr/ui.json";
import frErrors from "@/locales/fr/errors.json";
import frAuth from "@/locales/fr/auth.json";
import frCv from "@/locales/fr/cv.json";
import frEnums from "@/locales/fr/enums.json";
import frSubscription from "@/locales/fr/subscription.json";
import frTasks from "@/locales/fr/tasks.json";
import frOnboarding from "@/locales/fr/onboarding.json";
import frAccount from "@/locales/fr/account.json";

// English translations (split by category)
import enUi from "@/locales/en/ui.json";
import enErrors from "@/locales/en/errors.json";
import enAuth from "@/locales/en/auth.json";
import enCv from "@/locales/en/cv.json";
import enEnums from "@/locales/en/enums.json";
import enSubscription from "@/locales/en/subscription.json";
import enTasks from "@/locales/en/tasks.json";
import enOnboarding from "@/locales/en/onboarding.json";
import enAccount from "@/locales/en/account.json";

// Spanish translations (split by category)
import esUi from "@/locales/es/ui.json";
import esErrors from "@/locales/es/errors.json";
import esAuth from "@/locales/es/auth.json";
import esCv from "@/locales/es/cv.json";
import esEnums from "@/locales/es/enums.json";
import esSubscription from "@/locales/es/subscription.json";
import esTasks from "@/locales/es/tasks.json";
import esOnboarding from "@/locales/es/onboarding.json";
import esAccount from "@/locales/es/account.json";

// German translations (split by category)
import deUi from "@/locales/de/ui.json";
import deErrors from "@/locales/de/errors.json";
import deAuth from "@/locales/de/auth.json";
import deCv from "@/locales/de/cv.json";
import deEnums from "@/locales/de/enums.json";
import deSubscription from "@/locales/de/subscription.json";
import deTasks from "@/locales/de/tasks.json";
import deOnboarding from "@/locales/de/onboarding.json";
import deAccount from "@/locales/de/account.json";

import { trackCvExport } from "@/lib/telemetry/server";
import { incrementFeatureCounter } from "@/lib/subscription/featureUsage";
import { refundCredit } from "@/lib/subscription/credits";
import { capitalizeSkillName } from "@/lib/utils/textFormatting";
import { CommonErrors, CvErrors, OtherErrors } from "@/lib/api/apiErrors";

const translations = {
  fr: { ...frUi, ...frErrors, ...frAuth, ...frCv, ...frEnums, ...frSubscription, ...frTasks, ...frOnboarding, ...frAccount },
  en: { ...enUi, ...enErrors, ...enAuth, ...enCv, ...enEnums, ...enSubscription, ...enTasks, ...enOnboarding, ...enAccount },
  es: { ...esUi, ...esErrors, ...esAuth, ...esCv, ...esEnums, ...esSubscription, ...esTasks, ...esOnboarding, ...esAccount },
  de: { ...deUi, ...deErrors, ...deAuth, ...deCv, ...deEnums, ...deSubscription, ...deTasks, ...deOnboarding, ...deAccount },
};

/**
 * Sanitize filename for HTTP Content-Disposition header
 * Returns both ASCII-safe and RFC 5987 encoded versions
 */
function sanitizeFilenameForHeader(filename) {
  // ASCII-safe version: replace non-ASCII chars with underscore
  const asciiSafe = filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\x20-\x7E]/g, '_')   // Replace non-printable ASCII with _
    .replace(/["\\]/g, '_');          // Replace quotes and backslashes

  // RFC 5987 encoded version for full Unicode support
  const encoded = encodeURIComponent(filename)
    .replace(/'/g, '%27');

  return { asciiSafe, encoded };
}

// Helper function to get translation
function getTranslation(language, path) {
  const keys = path.split(".");
  let value = translations[language] || translations.fr;

  for (const key of keys) {
    if (value && typeof value === "object") {
      value = value[key];
    } else {
      return path;
    }
  }

  return value || path;
}

// Translate skill/language levels according to CV language
function translateLevel(language, level, type = 'skill') {
  if (!level) return '';

  const path = type === 'skill' ? `skillLevels.${level}` : `languageLevels.${level}`;
  const translated = getTranslation(language, path);

  // Si la traduction retourne le path (non trouvé), retourner le niveau original
  return translated === path ? level : translated;
}

// Get section title with smart detection of default vs custom titles
function getSectionTitle(sectionKey, customTitle, language) {
  const t = (path) => getTranslation(language, path);

  // Si pas de titre personnalisé, utiliser la traduction par défaut
  if (!customTitle || !customTitle.trim()) {
    return t(`cvSections.${sectionKey}`);
  }

  // Titres par défaut en français (avec variantes)
  const defaultTitlesFr = {
    header: ["En-tête"],
    summary: ["Résumé"],
    experience: ["Expérience"],
    education: ["Formation", "Éducation"],
    skills: ["Compétences"],
    projects: ["Projets personnels", "Projets"],
    languages: ["Langues"],
    extras: ["Informations complémentaires", "Extras"]
  };

  // Titres par défaut en anglais
  const defaultTitlesEn = {
    header: ["Header"],
    summary: ["Summary"],
    experience: ["Experience"],
    education: ["Education"],
    skills: ["Skills"],
    projects: ["Personal Projects", "Projects"],
    languages: ["Languages"],
    extras: ["Additional Information", "Extras"]
  };

  // Vérifier si le titre correspond à un titre par défaut (FR ou EN)
  const trimmedTitle = customTitle.trim();
  const isFrenchDefault = defaultTitlesFr[sectionKey] && defaultTitlesFr[sectionKey].includes(trimmedTitle);
  const isEnglishDefault = defaultTitlesEn[sectionKey] && defaultTitlesEn[sectionKey].includes(trimmedTitle);

  // Si c'est un titre par défaut, utiliser la traduction
  if (isFrenchDefault || isEnglishDefault) {
    return t(`cvSections.${sectionKey}`);
  }

  // Sinon, c'est un titre personnalisé, on le garde tel quel
  return customTitle;
}

export async function POST(request) {
  console.log('[PDF Export] Request received'); // Log pour debug
  const startTime = Date.now();

  // Variables pour tracking du crédit (remboursement si échec)
  // Déclarées hors du try pour être accessibles dans le catch
  let creditTransactionId = null;
  let creditUsed = false;
  let userId = null;

  try {
    // Vérifier l'authentification
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }
    userId = session.user.id;

    const requestData = await request.json();
    let filename = requestData.filename;
    const language = requestData.language || 'fr';
    const selections = requestData.selections || null;
    const sectionsOrder = requestData.sectionsOrder || ['summary', 'skills', 'experience', 'education', 'languages', 'projects', 'extras'];
    const customFilename = requestData.customFilename || null;

    // Si filename est un objet, extraire le nom du fichier
    if (typeof filename === 'object' && filename !== null) {
      filename = filename.file || filename.name || filename.filename || String(filename);
    }

    // Assurer que filename est une string
    filename = String(filename || '');

    if (!filename || filename === 'undefined') {
      return CvErrors.missingFilename();
    }

    // Vérifier les limites et incrémenter le compteur
    const usageResult = await incrementFeatureCounter(session.user.id, 'export_cv', {});
    if (!usageResult.success) {
      return NextResponse.json({
        error: usageResult.error,
        actionRequired: usageResult.actionRequired,
        redirectUrl: usageResult.redirectUrl
      }, { status: 403 });
    }
    // Sauvegarder pour remboursement potentiel si échec
    creditTransactionId = usageResult.transactionId;
    creditUsed = usageResult.usedCredit;

    // Charger les données du CV via le système de stockage utilisateur
    let cvData;
    let cvLanguage;
    try {
      const cvResult = await readUserCvFileWithMeta(session.user.id, filename);
      cvData = cvResult.content;
      // Utiliser la langue de la DB, ou celle de la requête, ou fallback vers cv.language ou 'fr'
      cvLanguage = cvResult.language || language || cvData?.language || 'fr';
      console.log('[PDF Export] CV loaded successfully for user:', session.user.id);
    } catch (error) {
      console.error('[PDF Export] Error loading CV:', error);
      // Rembourser le crédit si utilisé
      if (creditUsed && creditTransactionId) {
        try {
          await refundCredit(session.user.id, creditTransactionId, 'CV introuvable lors de l\'export');
          console.log('[PDF Export] Crédit remboursé suite à CV introuvable');
        } catch (refundError) {
          console.error('[PDF Export] Erreur lors du remboursement:', refundError);
        }
      }
      return CvErrors.notFound();
    }

    // Lancer Puppeteer avec options compatibles
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection'
      ],
      executablePath: puppeteer.executablePath(),
      timeout: 60000
    });

    const page = await browser.newPage();

    // Générer le HTML du CV avec les sélections (utilise la langue depuis DB)
    const htmlContent = generateCvHtml(cvData, cvLanguage, selections, sectionsOrder);

    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Générer le PDF avec gestion intelligente des sauts de page
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        right: '12mm',
        bottom: '15mm',
        left: '12mm'
      },
      preferCSSPageSize: true,
      displayHeaderFooter: false
    });

    await browser.close();

    // Tracking télémétrie - Succès
    const duration = Date.now() - startTime;
    try {
      await trackCvExport({
        userId: session.user.id,
        deviceId: null,
        language,
        duration,
        status: 'success',
      });
    } catch (trackError) {
      console.error('[PDF Export] Erreur tracking télémétrie:', trackError);
    }

    // Retourner le PDF
    const pdfFilename = customFilename || filename.replace('.json', '');
    const { asciiSafe, encoded } = sanitizeFilenameForHeader(pdfFilename);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${asciiSafe}.pdf"; filename*=UTF-8''${encoded}.pdf`
      }
    });

  } catch (error) {
    console.error("Erreur lors de la génération PDF:", error);
    console.error("Stack trace:", error.stack);

    // Rembourser le crédit si utilisé
    if (creditUsed && creditTransactionId && userId) {
      try {
        await refundCredit(userId, creditTransactionId, `Échec export PDF: ${error.message}`);
        console.log('[PDF Export] Crédit remboursé suite à erreur:', error.message);
      } catch (refundError) {
        console.error('[PDF Export] Erreur lors du remboursement:', refundError);
      }
    }

    // Tracking télémétrie - Erreur
    const duration = Date.now() - startTime;
    try {
      const session = await auth();
      if (session?.user?.id) {
        await trackCvExport({
          userId: session.user.id,
          deviceId: null,
          language: 'fr', // Valeur par défaut si la langue n'est pas disponible
          duration,
          status: 'error',
          error: error.message,
        });
      }
    } catch (trackError) {
      console.error('[PDF Export] Erreur tracking télémétrie:', trackError);
    }

    // Erreurs spécifiques de Puppeteer
    return OtherErrors.exportPdfFailed();
  }
}

function generateCvHtml(cvData, language = 'fr', selections = null, sectionsOrder = null) {
  const t = (path) => getTranslation(language, path);

  // Ordre par défaut des sections si non spécifié
  const defaultOrder = ['summary', 'skills', 'experience', 'education', 'languages', 'projects', 'extras'];
  const order = sectionsOrder || defaultOrder;

  // Fonction helper pour vérifier si une section est activée
  const isSectionEnabled = (sectionKey) => {
    if (!selections || !selections.sections) return true;
    return selections.sections[sectionKey]?.enabled !== false;
  };

  // Fonction helper pour vérifier si une sous-section est activée
  const isSubsectionEnabled = (sectionKey, subsectionKey) => {
    if (!selections || !selections.sections) return true;
    const section = selections.sections[sectionKey];
    if (!section || !section.subsections) return true;
    return section.subsections[subsectionKey] !== false;
  };

  // Fonction helper pour filtrer les éléments d'une liste selon les sélections
  const filterItems = (items, sectionKey) => {
    if (!selections || !selections.sections) return items;
    const section = selections.sections[sectionKey];
    if (!section || !section.items) return items;
    // Retourner les items filtrés selon les sélections
    // Si _originalIndex existe déjà (ajouté avant tri), l'utiliser, sinon utiliser l'index de position
    return items
      .map((item, index) => ({
        ...item,
        _originalIndex: item._originalIndex !== undefined ? item._originalIndex : index
      }))
      .filter((item) => section.items.includes(item._originalIndex));
  };

  const {
    header = {},
    summary = {},
    skills = {},
    experience: rawExperience = [],
    education: rawEducation = [],
    languages: rawLanguages = [],
    projects: rawProjects = [],
    extras: rawExtras = [],
    section_titles = {}
  } = cvData;

  // Tri des expériences par date décroissante (plus récent en premier), puis filtre selon sélections
  // IMPORTANT: Ajouter _originalIndex AVANT le tri pour conserver la correspondance avec les sélections UI
  const sortedExperience = rawExperience
    .map((item, index) => ({ ...item, _originalIndex: index }))
    .sort((a, b) => {
      const dateA = a.end_date === "present" ? "9999-99" : (a.end_date || a.start_date || "");
      const dateB = b.end_date === "present" ? "9999-99" : (b.end_date || b.start_date || "");
      return dateB.localeCompare(dateA);
    });
  const experience = filterItems(sortedExperience, 'experience');

  // Tri des formations par date décroissante (plus récent en premier), puis filtre selon sélections
  // IMPORTANT: Ajouter _originalIndex AVANT le tri pour conserver la correspondance avec les sélections UI
  const sortedEducation = rawEducation
    .map((item, index) => ({ ...item, _originalIndex: index }))
    .sort((a, b) => {
      const dateA = a.end_date || a.start_date || "";
      const dateB = b.end_date || b.start_date || "";
      return dateB.localeCompare(dateA);
    });
  const education = filterItems(sortedEducation, 'education');

  // Filtrer les autres listes selon les sélections
  const languages = filterItems(rawLanguages, 'languages');
  const projects = filterItems(rawProjects, 'projects');
  const extras = filterItems(rawExtras, 'extras');

  const contact = header.contact || {};

  return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CV - ${header.full_name || t('cvSections.header')}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.4;
      color: #1f2937;
      background: white;
      font-size: 11px;
    }

    .break-point {
      break-after: auto;
      page-break-after: auto;
      margin-bottom: 20px;
    }

    .experience-item:not(:first-child) {
      margin-top: 8px;
      page-break-before: auto;
    }

    /* Forcer l'espacement après les sauts de page */
    .experience-item {
      orphans: 2;
      widows: 2;
    }

    @media print {
      .experience-item {
        margin-top: 8px !important;
        margin-bottom: 8px !important;
      }

      .experience-item:first-child {
        margin-top: 0 !important;
      }
    }

    .experience-header {
      orphans: 3;
      widows: 3;
    }

    .cv-container {
      max-width: 100%;
      margin: 0 auto;
      padding: 0;
    }

    /* Header Section */
    .header {
      padding-bottom: 6px;
      margin-bottom: 6px;
    }

    .header h1 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 6px;
      color: #111827;
    }

    .header .title {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 6px;
    }

    .contact-info {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 11px;
    }

    .contact-item {
      color: #4b5563;
    }

    .contact-links {
      margin-top: 4px;
    }

    .contact-links a {
      color: #2563eb;
      text-decoration: none;
      margin-right: 15px;
    }

    /* Section Styling */
    .section {
      margin-bottom: 10px;
    }

    .section:not(:first-child) {
      margin-top: 15px;
    }

    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
      border-bottom: 1px solid #d1d5db;
      padding-bottom: 5px;
      margin-bottom: 10px;
    }

    /* Summary */
    .summary-content {
      margin-bottom: 15px;
      line-height: 1.6;
      text-align: justify;
    }

    .domains {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .domain-tag {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 10px;
      color: #374151;
    }

    /* Skills */
    .skills-grid {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .skill-category {
      break-inside: avoid;
      page-break-inside: avoid;
      font-size: 11px;
      color: #374151;
      line-height: 1.5;
    }

    .skill-category strong {
      font-weight: 600;
    }

    .skill-item {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 10px;
    }

    /* Experience */
    .experience-item {
      margin-bottom: 15px;
      border-left: 3px solid #e5e7eb;
      padding-left: 15px;
    }

    /* Bloc 1 : Header + Description (INDIVISIBLE) */
    .experience-header-block {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* Bloc 2 : Responsabilités seules (INDIVISIBLE) */
    .experience-responsibilities-block {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* Bloc 3 : Livrables + Technologies (INDIVISIBLE) */
    .experience-deliverables-block {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .experience-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }

    .experience-title {
      font-weight: 600;
      font-size: 13px;
      color: #111827;
    }

    .experience-company {
      color: #6b7280;
      font-size: 12px;
    }

    .experience-dates {
      font-size: 11px;
      color: #6b7280;
      white-space: nowrap;
      margin-left: 8px;
    }

    .experience-location {
      color: #9ca3af;
    }

    .experience-description {
      margin-bottom: 4px;
      line-height: 1.6;
      text-align: justify;
    }

    .experience-lists {
      display: block;
      margin-bottom: 6px;
    }

    .responsibilities, .deliverables {
      font-size: 11px;
      margin-bottom: 6px;
      break-inside: avoid;
      -webkit-column-break-inside: avoid;
    }

    .responsibilities h4, .deliverables h4 {
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 4px;
      color: #374151;
    }

    .responsibilities ul, .deliverables ul {
      list-style: disc;
      padding-left: 15px;
      margin-bottom: 8px;
    }

    .responsibilities li, .deliverables li {
      margin-bottom: 2px;
      line-height: 1.3;
    }

    .deliverables-inline {
      margin-top: 6px;
      font-size: 11px;
      color: #6b7280;
      line-height: 1.4;
      break-inside: avoid;
      -webkit-column-break-inside: avoid;
    }

    .skills-used {
      margin-top: 6px;
      font-size: 11px;
      color: #6b7280;
      line-height: 1.4;
      break-inside: avoid;
      -webkit-column-break-inside: avoid;
    }

    .skill-tag {
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 9px;
      color: #374151;
    }

    /* Education */
    .education-item {
      margin-bottom: 4px;
      break-inside: avoid;
      page-break-inside: avoid;
      font-size: 11px;
      line-height: 1.5;
      color: #374151;
    }

    .education-item strong {
      font-weight: 600;
      color: #111827;
    }

    .education-dates {
      color: #6b7280;
    }

    /* Projects and Extras */
    .project-item {
      margin-bottom: 12px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* Extras courts (grille 3 colonnes) */
    .extras-grid-short {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px 16px;
      margin-bottom: 12px;
    }

    .extra-item-short {
      font-size: 11px;
    }

    .extra-item-short:nth-child(3n+1) {
      text-align: left;
    }

    .extra-item-short:nth-child(3n+2) {
      text-align: center;
    }

    .extra-item-short:nth-child(3n) {
      text-align: right;
    }

    /* Extras longs */
    .extra-item {
      margin-bottom: 8px;
      break-inside: avoid;
      page-break-inside: avoid;
      font-size: 11px;
    }

    .project-header {
      display: flex;
      justify-content: between;
      align-items: flex-start;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }

    .project-name {
      font-weight: 600;
      color: #111827;
      font-size: 13px;
    }

    .project-role {
      color: #6b7280;
      font-size: 12px;
    }

    .project-dates {
      font-size: 11px;
      color: #6b7280;
      margin-left: auto;
    }

    .project-summary {
      margin-bottom: 10px;
      line-height: 1.6;
      text-align: justify;
    }

    /* Languages */
    .languages-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px 16px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .language-item {
      font-size: 11px;
    }

    .language-item:nth-child(3n+1) {
      text-align: left;
    }

    .language-item:nth-child(3n+2) {
      text-align: center;
    }

    .language-item:nth-child(3n) {
      text-align: right;
    }


    /* Page break utilities */
    .page-break-before {
      page-break-before: always;
    }

    .page-break-after {
      page-break-after: always;
    }

    .page-break-inside-avoid {
      page-break-inside: avoid;
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .section-title {
        break-after: avoid !important;
        page-break-after: avoid !important;
      }

      /* Blocs indivisibles pour les expériences */
      .experience-header-block,
      .experience-responsibilities-block,
      .experience-deliverables-block {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }

      /* Autres sections indivisibles */
      .education-item,
      .languages-grid,
      .project-item,
      .extra-item,
      .skill-category {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
    }
  </style>
</head>
<body>
  <div class="cv-container">
    <!-- Header -->
    <header class="header">
      <h1>${header.full_name || ''}</h1>
      ${header.current_title ? `<div class="title">${header.current_title}</div>` : ''}
      ${isSubsectionEnabled('header', 'contact') && (contact.email || contact.phone || contact.location) ? `
        <div class="contact-info">
          ${contact.email ? `<span class="contact-item">${contact.email}</span>` : ''}
          ${contact.phone ? `<span class="contact-item">${formatPhoneNumber(contact.phone, contact.location?.country_code)}</span>` : ''}
          ${contact.location ? `<span class="contact-item">${formatLocation(contact.location)}</span>` : ''}
        </div>
      ` : ''}
      ${isSubsectionEnabled('header', 'links') && contact.links && contact.links.length > 0 ? `
        <div class="contact-links">
          ${contact.links.map(link => `<a href="${link.url}" target="_blank">${link.label || link.url}</a>`).join('')}
        </div>
      ` : ''}
    </header>

    ${(() => {
      // Générateurs de sections
      const sectionGenerators = {
        summary: () => {
          if (!isSectionEnabled('summary') || !isSubsectionEnabled('summary', 'description') || !summary.description || !summary.description.trim()) return '';
          return `
            <section class="section">
              <h2 class="section-title">${getSectionTitle('summary', section_titles.summary, language)}</h2>
              <div class="summary-content">${summary.description}</div>
            </section>
          `;
        },
        skills: () => {
          if (!isSectionEnabled('skills') || !Object.values(skills).some(skillArray => Array.isArray(skillArray) && skillArray.length > 0)) return '';
          const hideProficiency = selections?.sections?.skills?.options?.hideProficiency === true;
          return `
            <section class="section">
              <h2 class="section-title">${getSectionTitle('skills', section_titles.skills, language)}</h2>
              <div class="skills-grid">
                ${isSubsectionEnabled('skills', 'hard_skills') && skills.hard_skills && skills.hard_skills.filter(skill => skill.name && skill.proficiency).length > 0 ? `
                  <div class="skill-category">
                    <strong>${t('cvSections.hardSkills')}:</strong> ${skills.hard_skills.filter(skill => skill.name && skill.proficiency).map(skill => hideProficiency ? capitalizeSkillName(skill.name) : `${capitalizeSkillName(skill.name)} (${translateLevel(language, skill.proficiency, 'skill')})`).join(', ')}
                  </div>
                ` : ''}
                ${isSubsectionEnabled('skills', 'tools') && skills.tools && skills.tools.filter(tool => tool.name && tool.proficiency).length > 0 ? `
                  <div class="skill-category">
                    <strong>${t('cvSections.tools')}:</strong> ${skills.tools.filter(tool => tool.name && tool.proficiency).map(tool => hideProficiency ? capitalizeSkillName(tool.name) : `${capitalizeSkillName(tool.name)} (${translateLevel(language, tool.proficiency, 'skill')})`).join(', ')}
                  </div>
                ` : ''}
                ${isSubsectionEnabled('skills', 'soft_skills') && skills.soft_skills && skills.soft_skills.filter(s => s && s.trim()).length > 0 ? `
                  <div class="skill-category">
                    <strong>${t('cvSections.softSkills')}:</strong> ${skills.soft_skills.filter(s => s && s.trim()).map(s => capitalizeSkillName(s)).join(', ')}
                  </div>
                ` : ''}
                ${isSubsectionEnabled('skills', 'methodologies') && skills.methodologies && skills.methodologies.filter(m => m && m.trim()).length > 0 ? `
                  <div class="skill-category">
                    <strong>${t('cvSections.methodologies')}:</strong> ${skills.methodologies.filter(m => m && m.trim()).map(m => capitalizeSkillName(m)).join(', ')}
                  </div>
                ` : ''}
              </div>
            </section>
          `;
        },
        experience: () => {
          if (!isSectionEnabled('experience') || !experience || experience.length === 0) return '';
          const hideDescription = selections?.sections?.experience?.options?.hideDescription === true;
          const hideTechnologies = selections?.sections?.experience?.options?.hideTechnologies === true;
          const hideDeliverables = selections?.sections?.experience?.options?.hideDeliverables === true;
          return `
            <section class="section">
              <h2 class="section-title">${getSectionTitle('experience', section_titles.experience, language)}</h2>
              ${experience.map((exp, index) => `
                <div class="experience-item">
                  <div class="experience-header-block">
                    <div class="experience-header">
                      <div>
                        ${exp.title ? `<div class="experience-title">${exp.title}</div>` : ''}
                        ${exp.company ? `<div class="experience-company">${exp.company}${exp.department_or_client ? ` (${exp.department_or_client})` : ''}${exp.location ? `<span class="experience-location"> - ${formatLocation(exp.location)}</span>` : ''}</div>` : ''}
                      </div>
                      ${exp.start_date || exp.end_date ? `<div class="experience-dates">${formatDate(exp.start_date, language)} – ${formatDate(exp.end_date, language)}</div>` : ''}
                    </div>
                    ${!hideDescription && exp.description && exp.description.trim() ? `<div class="experience-description">${exp.description}</div>` : ''}
                  </div>
                  ${exp.responsibilities && exp.responsibilities.length > 0 ? `
                    <div class="experience-responsibilities-block">
                      <div class="responsibilities">
                        <ul>
                          ${exp.responsibilities.map(resp => `<li>${resp}</li>`).join('')}
                        </ul>
                      </div>
                    </div>
                  ` : ''}
                  ${((!hideDeliverables && exp.deliverables && exp.deliverables.length > 0) || (!hideTechnologies && exp.skills_used && exp.skills_used.length > 0)) ? `
                    <div class="experience-deliverables-block">
                      ${!hideDeliverables && exp.deliverables && exp.deliverables.length > 0 ? `
                        <div class="deliverables-inline">
                          <strong>${t('cvSections.deliverables')}:</strong> ${exp.deliverables.join(', ')}
                        </div>
                      ` : ''}
                      ${!hideTechnologies && exp.skills_used && exp.skills_used.length > 0 ? `
                        <div class="skills-used">
                          <strong>${t('cvSections.technologies')}:</strong> ${exp.skills_used.join(', ')}
                        </div>
                      ` : ''}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </section>
          `;
        },
        education: () => {
          if (!isSectionEnabled('education') || !education || education.length === 0) return '';
          return `
            <section class="section">
              <h2 class="section-title">${getSectionTitle('education', section_titles.education, language)}</h2>
              ${education.map(edu => `
                <div class="education-item">
                  <strong>${edu.institution || ''}</strong>${edu.degree || edu.field_of_study ? ` - ${edu.degree || ''}${edu.degree && edu.field_of_study ? ' • ' : ''}${edu.field_of_study || ''}` : ''}${edu.start_date || edu.end_date ? ` <span class="education-dates">(${edu.start_date && edu.start_date !== edu.end_date ? `${formatDate(edu.start_date, language)} – ` : ''}${formatDate(edu.end_date, language)})</span>` : ''}
                </div>
              `).join('')}
            </section>
          `;
        },
        languages: () => {
          if (!isSectionEnabled('languages') || !languages || languages.filter(lang => lang.name && lang.level).length === 0) return '';
          return `
            <section class="section">
              <h2 class="section-title">${getSectionTitle('languages', section_titles.languages, language)}</h2>
              <div class="languages-grid">
                ${languages.filter(lang => lang.name && lang.level).map(lang => `
                  <div class="language-item">
                    <strong>${lang.name}:</strong> ${translateLevel(language, lang.level, 'language')}
                  </div>
                `).join('')}
              </div>
            </section>
          `;
        },
        projects: () => {
          if (!isSectionEnabled('projects') || !projects || projects.length === 0) return '';
          return `
            <section class="section">
              <h2 class="section-title">${getSectionTitle('projects', section_titles.projects, language)}</h2>
              ${projects.map(project => `
                <div class="project-item">
                  <div class="project-header">
                    <div>
                      ${project.name ? `<div class="project-name">${project.name}</div>` : ''}
                      ${project.role ? `<div class="project-role">${project.role}</div>` : ''}
                    </div>
                    ${project.start_date || project.end_date ? `
                      <div class="project-dates">${formatDate(project.start_date, language)}${project.end_date ? ` – ${formatDate(project.end_date, language)}` : ''}</div>
                    ` : ''}
                  </div>
                  ${project.summary && project.summary.trim() ? `<div class="project-summary">${project.summary}</div>` : ''}
                  ${project.tech_stack && project.tech_stack.length > 0 ? `
                    <div class="skills-used">
                      <strong>${t('cvSections.technologies')}:</strong> ${project.tech_stack.join(', ')}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </section>
          `;
        },
        extras: () => {
          if (!isSectionEnabled('extras') || !extras || extras.filter(extra => extra.name && extra.summary).length === 0) return '';
          return `
            <section class="section">
              <h2 class="section-title">${getSectionTitle('extras', section_titles.extras, language)}</h2>
              ${extras.filter(extra => extra.name && extra.summary && (extra.summary || '').length <= 40).length > 0 ? `
                <div class="extras-grid-short">
                  ${extras.filter(extra => extra.name && extra.summary && (extra.summary || '').length <= 40).map(extra => `
                    <div class="extra-item-short">
                      <strong>${extra.name}:</strong> ${extra.summary}
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              ${extras.filter(extra => extra.name && extra.summary && (extra.summary || '').length > 40).map(extra => `
                <div class="extra-item">
                  <strong>${extra.name}:</strong> ${extra.summary}
                </div>
              `).join('')}
            </section>
          `;
        }
      };

      // Générer les sections dans l'ordre spécifié
      return order.map(sectionKey => {
        const generator = sectionGenerators[sectionKey];
        return generator ? generator() : '';
      }).join('');
    })()}
  </div>
</body>
</html>
  `;
}

function formatDate(dateStr, language = 'fr') {
  if (!dateStr) return "";
  if (dateStr.toLowerCase() === "present") {
    return getTranslation(language, "cvSections.present");
  }

  // Format YYYY-MM to MM/YYYY or YYYY only
  const parts = String(dateStr).split("-");
  const year = parts[0];
  if (!parts[1]) return year; // Retourne uniquement l'année si pas de mois
  const month = parts[1];
  const mm = String(Number(month)).padStart(2, "0");
  return `${mm}/${year}`;
}

function formatLocation(location) {
  if (!location) return "";
  const parts = [];
  if (location.city) parts.push(location.city);
  if (location.region) parts.push(location.region);
  if (location.country_code) parts.push(`(${location.country_code})`);
  return parts.join(", ");
}