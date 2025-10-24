import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { promises as fs } from "fs";
import path from "path";
import { auth } from "@/lib/auth/session";
import { readUserCvFile } from "@/lib/cv/storage";
import frTranslations from "@/locales/fr.json";
import enTranslations from "@/locales/en.json";
import { trackCvExport } from "@/lib/telemetry/server";
import { incrementFeatureCounter } from "@/lib/subscription/featureUsage";

const translations = {
  fr: frTranslations,
  en: enTranslations,
};

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

  try {
    // Vérifier l'authentification
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const requestData = await request.json();
    let filename = requestData.filename;
    const language = requestData.language || 'fr';
    const selections = requestData.selections || null;
    const customFilename = requestData.customFilename || null;

    // Si filename est un objet, extraire le nom du fichier
    if (typeof filename === 'object' && filename !== null) {
      filename = filename.file || filename.name || filename.filename || String(filename);
    }

    // Assurer que filename est une string
    filename = String(filename || '');

    if (!filename || filename === 'undefined') {
      return NextResponse.json({ error: "Nom de fichier manquant" }, { status: 400 });
    }

    // Vérifier les limites et incrémenter le compteur
    const usageResult = await incrementFeatureCounter(session.user.id, 'export_pdf', {});
    if (!usageResult.success) {
      return NextResponse.json({
        error: usageResult.error,
        actionRequired: usageResult.actionRequired,
        redirectUrl: usageResult.redirectUrl
      }, { status: 403 });
    }

    // Charger les données du CV via le système de stockage utilisateur
    let cvData;
    try {
      const cvContent = await readUserCvFile(session.user.id, filename);
      cvData = JSON.parse(cvContent);
      console.log('[PDF Export] CV loaded successfully for user:', session.user.id);
    } catch (error) {
      console.error('[PDF Export] Error loading CV:', error);
      return NextResponse.json({ error: "CV introuvable" }, { status: 404 });
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

    // Générer le HTML du CV avec les sélections
    const htmlContent = generateCvHtml(cvData, language, selections);

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
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfFilename}.pdf"`
      }
    });

  } catch (error) {
    console.error("Erreur lors de la génération PDF:", error);
    console.error("Stack trace:", error.stack);

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
    if (error.message.includes('Could not find expected browser')) {
      return NextResponse.json({
        error: "Chromium non trouvé. Installation de Puppeteer incomplète."
      }, { status: 500 });
    }

    if (error.message.includes('Failed to launch')) {
      return NextResponse.json({
        error: "Impossible de lancer le navigateur. Vérifiez les dépendances système."
      }, { status: 500 });
    }

    return NextResponse.json({
      error: `Erreur lors de la génération du PDF: ${error.message}`
    }, { status: 500 });
  }
}

function generateCvHtml(cvData, language = 'fr', selections = null) {
  const t = (path) => getTranslation(language, path);

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
    // Retourner les items avec leur index original pour pouvoir accéder aux options
    return items
      .map((item, originalIndex) => ({ ...item, _originalIndex: originalIndex }))
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
  const sortedExperience = [...rawExperience].sort((a, b) => {
    const dateA = a.end_date === "present" ? "9999-99" : (a.end_date || a.start_date || "");
    const dateB = b.end_date === "present" ? "9999-99" : (b.end_date || b.start_date || "");
    return dateB.localeCompare(dateA);
  });
  const experience = filterItems(sortedExperience, 'experience');

  // Tri des formations par date décroissante (plus récent en premier), puis filtre selon sélections
  const sortedEducation = [...rawEducation].sort((a, b) => {
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

    /* Force breaks everywhere */
    * {
      break-inside: auto !important;
      page-break-inside: auto !important;
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
      padding-bottom: 15px;
      margin-bottom: 12px;
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
      margin-bottom: 12px;
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
      margin-top: 8px;
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
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
    }

    .skill-category h3 {
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #374151;
    }

    .skill-list {
      font-size: 11px;
      color: #374151;
      line-height: 1.4;
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
      margin-bottom: 25px;
      page-break-inside: avoid;
      border-left: 3px solid #e5e7eb;
      padding-left: 15px;
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
      font-size: 12px;
      color: #9ca3af;
      margin-bottom: 6px;
      margin-top: 2px;
    }

    .experience-description {
      margin-bottom: 12px;
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
      margin-bottom: 12px;
    }

    .education-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .education-institution {
      font-weight: 600;
      color: #111827;
      font-size: 13px;
    }

    .education-degree {
      color: #6b7280;
      font-size: 11px;
    }

    .education-dates {
      font-size: 11px;
      color: #6b7280;
    }

    /* Projects and Extras */
    .project-item, .extra-item {
      margin-bottom: 12px;
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
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .language-item {
      font-size: 11px;
      margin-bottom: 4px;
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

      .section {
        page-break-inside: avoid;
      }

      .experience-item {
        break-inside: avoid;
        page-break-inside: avoid;
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
          ${contact.phone ? `<span class="contact-item">${formatPhone(contact.phone, contact.location)}</span>` : ''}
          ${contact.location ? `<span class="contact-item">${formatLocation(contact.location)}</span>` : ''}
        </div>
      ` : ''}
      ${isSubsectionEnabled('header', 'links') && contact.links && contact.links.length > 0 ? `
        <div class="contact-links">
          ${contact.links.map(link => `<a href="${link.url}" target="_blank">${link.label || link.url}</a>`).join('')}
        </div>
      ` : ''}
    </header>

    <!-- Summary -->
    ${isSectionEnabled('summary') && isSubsectionEnabled('summary', 'description') && summary.description && summary.description.trim() ? `
      <section class="section">
        <h2 class="section-title">${getSectionTitle('summary', section_titles.summary, language)}</h2>
        <div class="summary-content">${summary.description}</div>
      </section>
    ` : ''}

    <!-- Skills -->
    ${isSectionEnabled('skills') && Object.values(skills).some(skillArray => Array.isArray(skillArray) && skillArray.length > 0) ? `
      <section class="section">
        <h2 class="section-title">${getSectionTitle('skills', section_titles.skills, language)}</h2>
        <div class="skills-grid">
          ${isSubsectionEnabled('skills', 'hard_skills') && skills.hard_skills && skills.hard_skills.filter(skill => skill.name && skill.proficiency).length > 0 ? `
            <div class="skill-category">
              <h3>${t('cvSections.hardSkills')}</h3>
              <div class="skill-list">
                ${skills.hard_skills.filter(skill => skill.name && skill.proficiency).map(skill => `${skill.name} (${skill.proficiency})`).join(', ')}
              </div>
            </div>
          ` : ''}

          ${isSubsectionEnabled('skills', 'tools') && skills.tools && skills.tools.filter(tool => tool.name && tool.proficiency).length > 0 ? `
            <div class="skill-category">
              <h3>${t('cvSections.tools')}</h3>
              <div class="skill-list">
                ${skills.tools.filter(tool => tool.name && tool.proficiency).map(tool => `${tool.name} (${tool.proficiency})`).join(', ')}
              </div>
            </div>
          ` : ''}

          ${isSubsectionEnabled('skills', 'soft_skills') && skills.soft_skills && skills.soft_skills.filter(s => s && s.trim()).length > 0 ? `
            <div class="skill-category">
              <h3>${t('cvSections.softSkills')}</h3>
              <div class="skill-list">
                ${skills.soft_skills.filter(s => s && s.trim()).join(', ')}
              </div>
            </div>
          ` : ''}

          ${isSubsectionEnabled('skills', 'methodologies') && skills.methodologies && skills.methodologies.filter(m => m && m.trim()).length > 0 ? `
            <div class="skill-category">
              <h3>${t('cvSections.methodologies')}</h3>
              <div class="skill-list">
                ${skills.methodologies.filter(m => m && m.trim()).join(', ')}
              </div>
            </div>
          ` : ''}
        </div>
      </section>
    ` : ''}

    <!-- Experience -->
    ${isSectionEnabled('experience') && experience && experience.length > 0 ? `
      <section class="section">
        <h2 class="section-title">${getSectionTitle('experience', section_titles.experience, language)}</h2>
        ${experience.map((exp, index) => `
          <div class="experience-item">
            <div class="experience-header">
              <div>
                ${exp.title ? `<div class="experience-title">${exp.title}</div>` : ''}
                ${exp.company ? `<div class="experience-company">${exp.company}${exp.department_or_client ? ` (${exp.department_or_client})` : ''}</div>` : ''}
              </div>
              ${exp.start_date || exp.end_date ? `<div class="experience-dates">${formatDate(exp.start_date, language)} – ${formatDate(exp.end_date, language)}</div>` : ''}
            </div>
            ${exp.location ? `<div class="experience-location">${formatLocation(exp.location)}</div>` : ''}
            ${exp.description && exp.description.trim() ? `<div class="experience-description">${exp.description}</div>` : ''}

            ${(exp.responsibilities && exp.responsibilities.length > 0) || (exp.deliverables && exp.deliverables.length > 0) ? `
              <div class="experience-lists">
                ${exp.responsibilities && exp.responsibilities.length > 0 ? `
                  <div class="responsibilities">
                    <h4>${t('cvSections.responsibilities')}</h4>
                    <ul>
                      ${exp.responsibilities.map(resp => `<li>${resp}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}

                ${exp.deliverables && exp.deliverables.length > 0 && (selections?.sections?.experience?.itemsOptions?.[exp._originalIndex]?.includeDeliverables !== false) ? `
                  <div class="deliverables">
                    <h4>${t('cvSections.deliverables')}</h4>
                    <ul>
                      ${exp.deliverables.map(deliv => `<li>${deliv}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}
              </div>
            ` : ''}

            ${exp.skills_used && exp.skills_used.length > 0 ? `
              <div class="skills-used">
                <strong>${t('cvSections.technologies')}:</strong> ${exp.skills_used.join(', ')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </section>
    ` : ''}

    <!-- Education -->
    ${isSectionEnabled('education') && education && education.length > 0 ? `
      <section class="section">
        <h2 class="section-title">${getSectionTitle('education', section_titles.education, language)}</h2>
        ${education.map(edu => `
          <div class="education-item">
            <div class="education-header">
              <div>
                ${edu.institution ? `<div class="education-institution">${edu.institution}</div>` : ''}
                ${edu.degree || edu.field_of_study ? `<div class="education-degree">${edu.degree || ''}${edu.degree && edu.field_of_study ? ' • ' : ''}${edu.field_of_study || ''}</div>` : ''}
              </div>
              ${edu.start_date || edu.end_date ? `<div class="education-dates">${edu.start_date && edu.start_date !== edu.end_date ? `${formatDate(edu.start_date, language)} – ` : ''}${formatDate(edu.end_date, language)}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </section>
    ` : ''}

    <!-- Languages -->
    ${isSectionEnabled('languages') && languages && languages.filter(lang => lang.name && lang.level).length > 0 ? `
      <section class="section">
        <h2 class="section-title">${getSectionTitle('languages', section_titles.languages, language)}</h2>
        <div class="languages-grid">
          ${languages.filter(lang => lang.name && lang.level).map(lang => `
            <div class="language-item">
              <strong>${lang.name}:</strong> ${lang.level}
            </div>
          `).join('')}
        </div>
      </section>
    ` : ''}

    <!-- Projects -->
    ${isSectionEnabled('projects') && projects && projects.length > 0 ? `
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
    ` : ''}

    <!-- Extras -->
    ${isSectionEnabled('extras') && extras && extras.filter(extra => extra.name && extra.summary).length > 0 ? `
      <section class="section">
        <h2 class="section-title">${getSectionTitle('extras', section_titles.extras, language)}</h2>
        <div class="extras-grid">
          ${extras.filter(extra => extra.name && extra.summary).map(extra => `
            <div class="extra-item">
              <strong>${extra.name}:</strong> ${extra.summary}
            </div>
          `).join('')}
        </div>
      </section>
    ` : ''}
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

function getCountryCallingCode(countryCode) {
  const countryCodes = {
    'FR': '+33', 'BE': '+32', 'CH': '+41', 'LU': '+352', 'MC': '+377',
    'US': '+1', 'CA': '+1', 'UK': '+44', 'GB': '+44', 'DE': '+49',
    'IT': '+39', 'ES': '+34', 'PT': '+351', 'NL': '+31', 'AT': '+43',
    'SE': '+46', 'NO': '+47', 'DK': '+45', 'FI': '+358', 'PL': '+48',
    'CZ': '+420', 'SK': '+421', 'HU': '+36', 'RO': '+40', 'BG': '+359',
    'GR': '+30', 'TR': '+90', 'RU': '+7', 'UA': '+380', 'BY': '+375',
    'JP': '+81', 'CN': '+86', 'KR': '+82', 'IN': '+91', 'AU': '+61',
    'NZ': '+64', 'ZA': '+27', 'BR': '+55', 'AR': '+54', 'MX': '+52',
    'CL': '+56', 'CO': '+57', 'PE': '+51', 'VE': '+58', 'EG': '+20',
    'MA': '+212', 'TN': '+216', 'DZ': '+213', 'SN': '+221', 'CI': '+225'
  };
  return countryCodes[countryCode?.toUpperCase()] || '';
}

function formatPhone(phone, location) {
  if (!phone) return "";

  // Si le numéro commence déjà par +, on le laisse tel quel
  if (phone.startsWith('+')) return phone;

  // Essayer de déterminer l'indicatif à partir du pays
  let countryCode = '';
  if (location?.country_code) {
    countryCode = getCountryCallingCode(location.country_code);
  }

  // Si on a trouvé un indicatif et que le numéro ne commence pas par +
  if (countryCode && !phone.startsWith('+')) {
    // Supprimer le 0 initial s'il existe (format français/européen)
    const cleanPhone = phone.replace(/^0+/, '');
    return `${countryCode} ${cleanPhone}`;
  }

  return phone;
}

function formatLocation(location) {
  if (!location) return "";
  const parts = [];
  if (location.city) parts.push(location.city);
  if (location.region) parts.push(location.region);
  if (location.country_code) parts.push(`(${location.country_code})`);
  return parts.join(", ");
}