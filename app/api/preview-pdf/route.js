import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { readUserCvFileWithMeta } from "@/lib/cv/storage";
import { formatPhoneNumber } from "@/lib/utils/phoneFormatting";

// French translations (split by category)
import frUi from "@/locales/fr/ui.json";
import frCv from "@/locales/fr/cv.json";
import frEnums from "@/locales/fr/enums.json";

// English translations (split by category)
import enUi from "@/locales/en/ui.json";
import enCv from "@/locales/en/cv.json";
import enEnums from "@/locales/en/enums.json";

// Spanish translations (split by category)
import esUi from "@/locales/es/ui.json";
import esCv from "@/locales/es/cv.json";
import esEnums from "@/locales/es/enums.json";

// German translations (split by category)
import deUi from "@/locales/de/ui.json";
import deCv from "@/locales/de/cv.json";
import deEnums from "@/locales/de/enums.json";

import { capitalizeSkillName } from "@/lib/utils/textFormatting";
import { CommonErrors, CvErrors } from "@/lib/api/apiErrors";

const translations = {
  fr: { ...frUi, ...frCv, ...frEnums },
  en: { ...enUi, ...enCv, ...enEnums },
  es: { ...esUi, ...esCv, ...esEnums },
  de: { ...deUi, ...deCv, ...deEnums },
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

// Translate skill/language levels according to CV language
function translateLevel(language, level, type = 'skill') {
  if (!level) return '';

  const path = type === 'skill' ? `skillLevels.${level}` : `languageLevels.${level}`;
  const translated = getTranslation(language, path);

  return translated === path ? level : translated;
}

// Get section title with smart detection of default vs custom titles
function getSectionTitle(sectionKey, customTitle, language) {
  const t = (path) => getTranslation(language, path);

  if (!customTitle || !customTitle.trim()) {
    return t(`cvSections.${sectionKey}`);
  }

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

  const trimmedTitle = customTitle.trim();
  const isFrenchDefault = defaultTitlesFr[sectionKey] && defaultTitlesFr[sectionKey].includes(trimmedTitle);
  const isEnglishDefault = defaultTitlesEn[sectionKey] && defaultTitlesEn[sectionKey].includes(trimmedTitle);

  if (isFrenchDefault || isEnglishDefault) {
    return t(`cvSections.${sectionKey}`);
  }

  return customTitle;
}

/**
 * Route API pour prévisualiser le CV en HTML avec indicateurs de saut de page
 * Ne consomme pas de crédits
 */
export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    const requestData = await request.json();
    let filename = requestData.filename;
    const language = requestData.language || 'fr';
    const selections = requestData.selections || null;

    if (typeof filename === 'object' && filename !== null) {
      filename = filename.file || filename.name || filename.filename || String(filename);
    }

    filename = String(filename || '');

    if (!filename || filename === 'undefined') {
      return CvErrors.missingFilename();
    }

    // Charger les données du CV
    let cvData;
    let cvLanguage;
    try {
      const cvResult = await readUserCvFileWithMeta(session.user.id, filename);
      cvData = cvResult.content;
      cvLanguage = cvResult.language || language || cvData?.language || 'fr';
    } catch (error) {
      console.error('[PDF Preview] Error loading CV:', error);
      return CvErrors.notFound();
    }

    // Générer le HTML du CV avec indicateurs de saut de page
    const htmlContent = generatePreviewHtml(cvData, cvLanguage, selections);

    return NextResponse.json({ html: htmlContent });

  } catch (error) {
    console.error("Erreur lors de la prévisualisation:", error);
    return NextResponse.json({ error: "Erreur lors de la prévisualisation" }, { status: 500 });
  }
}

function generatePreviewHtml(cvData, language = 'fr', selections = null) {
  const t = (path) => getTranslation(language, path);

  const isSectionEnabled = (sectionKey) => {
    if (!selections || !selections.sections) return true;
    return selections.sections[sectionKey]?.enabled !== false;
  };

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

  const languages = filterItems(rawLanguages, 'languages');
  const projects = filterItems(rawProjects, 'projects');
  const extras = filterItems(rawExtras, 'extras');

  const contact = header.contact || {};

  // Hauteur de page A4 en pixels
  // A4 = 297mm, marges Puppeteer = 15mm top + 15mm bottom = 30mm
  // Contenu = 267mm. À 96 DPI = 1009px, mais Puppeteer rend légèrement plus
  // Valeur calibrée empiriquement pour correspondre au rendu réel
  const PAGE_HEIGHT_PX = 1020;

  return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CV Preview - ${header.full_name || t('cvSections.header')}</title>
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
      background: #9ca3af;
      font-size: 11px;
      padding: 20px;
    }

    .page-wrapper {
      width: 210mm;
      min-height: 297mm;
      background: white;
      margin: 0 auto;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      position: relative;
    }

    .cv-container {
      padding: 15mm;
      position: relative;
    }

    /* Indicateur de saut de page */
    .page-break-indicator {
      position: absolute;
      left: 0;
      right: 0;
      height: 0;
      border-top: 2px dashed #ef4444;
      z-index: 1000;
    }

    .page-break-indicator::before {
      content: 'Saut de page';
      position: absolute;
      right: 0;
      top: -10px;
      background: #ef4444;
      color: white;
      font-size: 9px;
      padding: 2px 6px;
      border-radius: 3px;
    }

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

    .summary-content {
      margin-bottom: 15px;
      line-height: 1.6;
      text-align: justify;
    }

    .skills-grid {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .skill-category {
      font-size: 11px;
      color: #374151;
      line-height: 1.5;
    }

    .skill-category strong {
      font-weight: 600;
    }

    .experience-item {
      margin-bottom: 15px;
      border-left: 3px solid #e5e7eb;
      padding-left: 15px;
    }

    .experience-item:not(:first-child) {
      margin-top: 8px;
    }

    .experience-header-block,
    .experience-responsibilities-block,
    .experience-deliverables-block {
      /* Ces blocs sont indivisibles dans le PDF */
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

    .responsibilities, .deliverables {
      font-size: 11px;
      margin-bottom: 6px;
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
    }

    .skills-used {
      margin-top: 6px;
      font-size: 11px;
      color: #6b7280;
      line-height: 1.4;
    }

    .education-item {
      margin-bottom: 4px;
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

    .languages-grid {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .language-item {
      font-size: 11px;
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="page-wrapper">
    <div class="cv-container" id="cv-container">
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

    ${isSectionEnabled('summary') && isSubsectionEnabled('summary', 'description') && summary.description && summary.description.trim() ? `
      <section class="section">
        <h2 class="section-title">${getSectionTitle('summary', section_titles.summary, language)}</h2>
        <div class="summary-content">${summary.description}</div>
      </section>
    ` : ''}

    ${isSectionEnabled('skills') && Object.values(skills).some(skillArray => Array.isArray(skillArray) && skillArray.length > 0) ? (() => {
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
    })() : ''}

    ${isSectionEnabled('experience') && experience && experience.length > 0 ? (() => {
      const hideDescription = selections?.sections?.experience?.options?.hideDescription === true;
      const hideTechnologies = selections?.sections?.experience?.options?.hideTechnologies === true;
      return `
      <section class="section">
        <h2 class="section-title">${getSectionTitle('experience', section_titles.experience, language)}</h2>
        ${experience.map((exp, index) => `
          <div class="experience-item">
            <div class="experience-header-block">
              <div class="experience-header">
                <div>
                  ${exp.title ? `<div class="experience-title">${exp.title}</div>` : ''}
                  ${exp.company ? `<div class="experience-company">${exp.company}${exp.department_or_client ? ` (${exp.department_or_client})` : ''}</div>` : ''}
                </div>
                ${exp.start_date || exp.end_date ? `<div class="experience-dates">${formatDate(exp.start_date, language)} – ${formatDate(exp.end_date, language)}</div>` : ''}
              </div>
              ${exp.location ? `<div class="experience-location">${formatLocation(exp.location)}</div>` : ''}
              ${!hideDescription && exp.description && exp.description.trim() ? `<div class="experience-description">${exp.description}</div>` : ''}
            </div>

            ${exp.responsibilities && exp.responsibilities.length > 0 ? `
              <div class="experience-responsibilities-block">
                <div class="responsibilities">
                  ${!hideDescription ? `<h4>${t('cvSections.responsibilities')}</h4>` : ''}
                  <ul>
                    ${exp.responsibilities.map(resp => `<li>${resp}</li>`).join('')}
                  </ul>
                </div>
              </div>
            ` : ''}

            ${((exp.deliverables && exp.deliverables.length > 0 && (selections?.sections?.experience?.itemsOptions?.[exp._originalIndex]?.includeDeliverables !== false)) || (!hideTechnologies && exp.skills_used && exp.skills_used.length > 0)) ? `
              <div class="experience-deliverables-block">
                ${exp.deliverables && exp.deliverables.length > 0 && (selections?.sections?.experience?.itemsOptions?.[exp._originalIndex]?.includeDeliverables !== false) ? `
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
    })() : ''}

    ${isSectionEnabled('education') && education && education.length > 0 ? `
      <section class="section">
        <h2 class="section-title">${getSectionTitle('education', section_titles.education, language)}</h2>
        ${education.map(edu => `
          <div class="education-item">
            <strong>${edu.institution || ''}</strong>${edu.degree || edu.field_of_study ? ` - ${edu.degree || ''}${edu.degree && edu.field_of_study ? ' • ' : ''}${edu.field_of_study || ''}` : ''}${edu.start_date || edu.end_date ? ` <span class="education-dates">(${edu.start_date && edu.start_date !== edu.end_date ? `${formatDate(edu.start_date, language)} – ` : ''}${formatDate(edu.end_date, language)})</span>` : ''}
          </div>
        `).join('')}
      </section>
    ` : ''}

    ${isSectionEnabled('languages') && languages && languages.filter(lang => lang.name && lang.level).length > 0 ? `
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
    ` : ''}

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
  </div>

  <script>
    // Simuler les sauts de page exactement comme Puppeteer/CSS le fait
    window.addEventListener('load', function() {
      const container = document.getElementById('cv-container');
      const pageWrapper = document.querySelector('.page-wrapper');

      // Calculer dynamiquement la hauteur de contenu par page en mm convertis en pixels
      // A4 = 297mm, marges = 15mm top + 15mm bottom = 30mm
      // Contenu par page = 267mm
      // Créer un élément temporaire pour mesurer 267mm en pixels
      const measureDiv = document.createElement('div');
      measureDiv.style.cssText = 'position:absolute;width:267mm;height:267mm;visibility:hidden;';
      document.body.appendChild(measureDiv);
      const PAGE_HEIGHT = measureDiv.offsetHeight;
      document.body.removeChild(measureDiv);

      // Position de départ du contenu (après le padding top du container)
      const containerStyle = getComputedStyle(container);
      const paddingTop = parseFloat(containerStyle.paddingTop);
      const containerRect = container.getBoundingClientRect();
      const containerTop = containerRect.top + window.scrollY + paddingTop;

      // Éléments avec break-inside: avoid (ne doivent pas être coupés)
      // Exactement les mêmes que dans export-pdf @media print
      const breakInsideAvoidSelectors = [
        '.experience-header-block',
        '.experience-responsibilities-block',
        '.experience-deliverables-block',
        '.skill-category',
        '.education-item',
        '.project-item',
        '.extra-item',
        '.languages-grid'
      ];

      // Éléments avec break-after: avoid (doivent rester avec l'élément suivant)
      const breakAfterAvoidSelectors = [
        '.section-title'
      ];

      // Construire la liste des blocs indivisibles
      const blocks = [];

      // Ajouter les blocs break-inside: avoid
      breakInsideAvoidSelectors.forEach(selector => {
        container.querySelectorAll(selector).forEach(el => {
          const rect = el.getBoundingClientRect();
          blocks.push({
            element: el,
            top: rect.top + window.scrollY - containerTop,
            bottom: rect.bottom + window.scrollY - containerTop,
            height: rect.height,
            type: 'break-inside-avoid'
          });
        });
      });

      // Pour les section-title avec break-after: avoid,
      // on les groupe avec l'élément suivant
      breakAfterAvoidSelectors.forEach(selector => {
        container.querySelectorAll(selector).forEach(el => {
          const rect = el.getBoundingClientRect();
          const titleTop = rect.top + window.scrollY - containerTop;
          const titleBottom = rect.bottom + window.scrollY - containerTop;

          // Trouver le premier élément suivant dans la même section
          const section = el.closest('.section');
          if (section) {
            const firstChild = section.querySelector('.experience-item, .skill-category, .education-item, .project-item, .extra-item, .languages-grid, .summary-content');
            if (firstChild) {
              const childRect = firstChild.getBoundingClientRect();
              // Le bloc = titre + premier enfant (ils ne doivent pas être séparés)
              blocks.push({
                element: el,
                top: titleTop,
                bottom: childRect.bottom + window.scrollY - containerTop,
                height: (childRect.bottom + window.scrollY - containerTop) - titleTop,
                type: 'title-with-content'
              });
            }
          }
        });
      });

      // Trier par position verticale
      blocks.sort((a, b) => a.top - b.top);

      // Supprimer les doublons (blocs qui se chevauchent)
      const uniqueBlocks = [];
      for (const block of blocks) {
        const isDuplicate = uniqueBlocks.some(existing =>
          block.top >= existing.top && block.bottom <= existing.bottom
        );
        if (!isDuplicate) {
          uniqueBlocks.push(block);
        }
      }

      // Simuler la pagination - parcourir tout le document
      const pageBreaks = [];
      let currentPageStart = 0;
      let currentPageEnd = PAGE_HEIGHT;
      // Calculer la hauteur du contenu (sans le padding)
      const paddingBottom = parseFloat(containerStyle.paddingBottom);
      const totalHeight = container.scrollHeight - paddingTop - paddingBottom;

      // Tolérance pour les différences de rendu entre navigateur et Puppeteer
      const TOLERANCE = 20;

      // Debug - afficher les blocs détectés
      console.log('PAGE_HEIGHT:', PAGE_HEIGHT);
      console.log('totalHeight:', totalHeight);
      console.log('Blocs détectés:', uniqueBlocks.map(b => ({
        type: b.type,
        top: Math.round(b.top),
        bottom: Math.round(b.bottom),
        element: b.element?.className || b.element?.tagName
      })));

      // Si le contenu tient sur une seule page (avec tolérance), pas de saut de page
      if (totalHeight <= PAGE_HEIGHT + TOLERANCE) {
        console.log('Content fits on one page');
        return; // Pas besoin d'ajouter des indicateurs
      }

      // Continuer tant qu'on n'a pas parcouru tout le document
      while (currentPageEnd < totalHeight + PAGE_HEIGHT) {
        // Trouver si un bloc serait coupé à currentPageEnd
        let blockToCut = null;

        for (const block of uniqueBlocks) {
          // Le bloc commence avant la fin de page ET se termine après
          if (block.top < currentPageEnd && block.bottom > currentPageEnd) {
            // Ce bloc serait coupé
            if (!blockToCut || block.top < blockToCut.top) {
              blockToCut = block;
            }
          }
        }

        if (blockToCut) {
          // Un bloc serait coupé -> saut de page juste avant ce bloc
          console.log('Bloc coupé à', currentPageEnd, ':', {
            type: blockToCut.type,
            top: Math.round(blockToCut.top),
            bottom: Math.round(blockToCut.bottom),
            element: blockToCut.element?.className
          });
          pageBreaks.push(blockToCut.top);
          currentPageStart = blockToCut.top;
          currentPageEnd = blockToCut.top + PAGE_HEIGHT;
        } else {
          // Pas de bloc coupé, passer à la page suivante
          if (currentPageEnd < totalHeight) {
            pageBreaks.push(currentPageEnd);
          }
          currentPageStart = currentPageEnd;
          currentPageEnd = currentPageStart + PAGE_HEIGHT;
        }
      }

      // Ajouter les indicateurs visuels
      // Les positions sont relatives au contenu (après padding), donc on ajoute paddingTop pour positionner dans le container
      pageBreaks.forEach(position => {
        const indicator = document.createElement('div');
        indicator.className = 'page-break-indicator';
        indicator.style.top = (position + paddingTop) + 'px';
        container.appendChild(indicator);
      });
    });
  </script>
</body>
</html>
  `;
}

function formatDate(dateStr, language = 'fr') {
  if (!dateStr) return "";
  if (dateStr.toLowerCase() === "present") {
    return getTranslation(language, "cvSections.present");
  }

  const parts = String(dateStr).split("-");
  const year = parts[0];
  if (!parts[1]) return year;
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
