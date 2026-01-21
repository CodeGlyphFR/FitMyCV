import { formatPhoneNumber } from "@/lib/utils/phoneFormatting";
import { capitalizeSkillName } from "@/lib/utils/textFormatting";
import { getTranslation, translateLevel, getSectionTitle, createTranslator } from './cvTranslations';
import { formatDate, formatLocation, isSectionEnabled, isSubsectionEnabled } from './cvUtils';

/**
 * Generate the header section HTML
 */
export function generateHeaderSection(header, contact, selections, language) {
  return `
    <header class="header">
      <h1>${header.full_name || ''}</h1>
      ${header.current_title ? `<div class="title">${header.current_title}</div>` : ''}
      ${isSubsectionEnabled(selections, 'header', 'contact') && (contact.email || contact.phone || contact.location) ? `
        <div class="contact-info">
          ${contact.email ? `<span class="contact-item">${contact.email}</span>` : ''}
          ${contact.phone ? `<span class="contact-item">${formatPhoneNumber(contact.phone, contact.location?.country_code)}</span>` : ''}
          ${contact.location ? `<span class="contact-item">${formatLocation(contact.location)}</span>` : ''}
        </div>
      ` : ''}
      ${isSubsectionEnabled(selections, 'header', 'links') && contact.links && contact.links.length > 0 ? `
        <div class="contact-links">
          ${contact.links.map(link => `<a href="${link.url}" target="_blank">${link.label || link.url}</a>`).join('')}
        </div>
      ` : ''}
    </header>
  `;
}

/**
 * Create section generators for CV rendering
 * @param {Object} data - CV data (header, summary, skills, experience, etc.)
 * @param {string} language - Language code
 * @param {Object} selections - Selection configuration
 * @param {Object} options - Additional options
 * @param {boolean} options.isExport - Whether this is for PDF export (vs preview)
 * @param {Function} options.shouldBreakBefore - Function to check page breaks (export only)
 */
export function createSectionGenerators(data, language, selections, options = {}) {
  const {
    summary,
    skills,
    experience,
    education,
    languages,
    projects,
    extras,
    section_titles = {}
  } = data;

  const t = createTranslator(language);
  const { isExport = false, shouldBreakBefore = () => false } = options;

  // Get section options
  const hideProficiency = selections?.sections?.skills?.options?.hideProficiency === true;
  const hideDescription = selections?.sections?.experience?.options?.hideDescription === true;
  const hideTechnologies = selections?.sections?.experience?.options?.hideTechnologies === true;
  const hideDeliverables = selections?.sections?.experience?.options?.hideDeliverables === true;

  return {
    summary: () => {
      if (!isSectionEnabled(selections, 'summary') ||
          !isSubsectionEnabled(selections, 'summary', 'description') ||
          !summary.description || !summary.description.trim()) {
        return '';
      }
      const sectionTitle = getSectionTitle('summary', section_titles.summary, language);
      const breakClass = isExport && shouldBreakBefore('section', sectionTitle) ? ' page-break-before' : '';
      return `
        <section class="section${breakClass}">
          <h2 class="section-title">${sectionTitle}</h2>
          <div class="summary-content">${summary.description}</div>
        </section>
      `;
    },

    skills: () => {
      if (!isSectionEnabled(selections, 'skills') ||
          !Object.values(skills).some(skillArray => Array.isArray(skillArray) && skillArray.length > 0)) {
        return '';
      }
      const sectionTitle = getSectionTitle('skills', section_titles.skills, language);
      const breakClass = isExport && shouldBreakBefore('section', sectionTitle) ? ' page-break-before' : '';
      return `
        <section class="section${breakClass}">
          <h2 class="section-title">${sectionTitle}</h2>
          <div class="skills-grid">
            ${isSubsectionEnabled(selections, 'skills', 'hard_skills') && skills.hard_skills && skills.hard_skills.filter(skill => skill.name && skill.proficiency).length > 0 ? `
              <div class="skill-category">
                <strong>${t('cvSections.hardSkills')}:</strong> ${skills.hard_skills.filter(skill => skill.name && skill.proficiency).map(skill => hideProficiency ? capitalizeSkillName(skill.name) : `${capitalizeSkillName(skill.name)} (${translateLevel(language, skill.proficiency, 'skill')})`).join(', ')}
              </div>
            ` : ''}
            ${isSubsectionEnabled(selections, 'skills', 'tools') && skills.tools && skills.tools.filter(tool => tool.name && tool.proficiency).length > 0 ? `
              <div class="skill-category">
                <strong>${t('cvSections.tools')}:</strong> ${skills.tools.filter(tool => tool.name && tool.proficiency).map(tool => hideProficiency ? capitalizeSkillName(tool.name) : `${capitalizeSkillName(tool.name)} (${translateLevel(language, tool.proficiency, 'skill')})`).join(', ')}
              </div>
            ` : ''}
            ${isSubsectionEnabled(selections, 'skills', 'soft_skills') && skills.soft_skills && skills.soft_skills.filter(s => s && s.trim()).length > 0 ? `
              <div class="skill-category">
                <strong>${t('cvSections.softSkills')}:</strong> ${skills.soft_skills.filter(s => s && s.trim()).map(s => capitalizeSkillName(s)).join(', ')}
              </div>
            ` : ''}
            ${isSubsectionEnabled(selections, 'skills', 'methodologies') && skills.methodologies && skills.methodologies.filter(m => m && m.trim()).length > 0 ? `
              <div class="skill-category">
                <strong>${t('cvSections.methodologies')}:</strong> ${skills.methodologies.filter(m => m && m.trim()).map(m => capitalizeSkillName(m)).join(', ')}
              </div>
            ` : ''}
          </div>
        </section>
      `;
    },

    experience: () => {
      if (!isSectionEnabled(selections, 'experience') || !experience || experience.length === 0) {
        return '';
      }
      const sectionTitle = getSectionTitle('experience', section_titles.experience, language);
      const sectionBreakClass = isExport && shouldBreakBefore('section', sectionTitle) ? ' page-break-before' : '';

      return `
        <section class="section${sectionBreakClass}">
          <h2 class="section-title">${sectionTitle}</h2>
          ${experience.map((exp, index) => {
            // Page break classes (export only)
            const itemBreak = isExport && shouldBreakBefore('experience-item', index) ? ' page-break-before' : '';
            const headerBreak = isExport && shouldBreakBefore('experience-header-block', index) ? ' page-break-before' : '';
            const respBreak = isExport && shouldBreakBefore('experience-responsibilities-block', index) ? ' page-break-before' : '';
            const delivBreak = isExport && shouldBreakBefore('experience-deliverables-block', index) ? ' page-break-before' : '';

            // Deliverables visibility logic
            const showDeliverables = isExport
              ? !hideDeliverables && exp.deliverables && exp.deliverables.length > 0
              : exp.deliverables && exp.deliverables.length > 0 && (selections?.sections?.experience?.itemsOptions?.[exp._originalIndex]?.includeDeliverables !== false);

            return `
              <div class="experience-item${itemBreak}">
                <div class="experience-header-block${headerBreak}">
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
                  <div class="experience-responsibilities-block${respBreak}">
                    <div class="responsibilities">
                      <ul>
                        ${exp.responsibilities.map(resp => `<li>${resp}</li>`).join('')}
                      </ul>
                    </div>
                  </div>
                ` : ''}
                ${(showDeliverables || (!hideTechnologies && exp.skills_used && exp.skills_used.length > 0)) ? `
                  <div class="experience-deliverables-block${delivBreak}">
                    ${showDeliverables ? `
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
            `;
          }).join('')}
        </section>
      `;
    },

    education: () => {
      if (!isSectionEnabled(selections, 'education') || !education || education.length === 0) {
        return '';
      }
      const sectionTitle = getSectionTitle('education', section_titles.education, language);
      const breakClass = isExport && shouldBreakBefore('section', sectionTitle) ? ' page-break-before' : '';

      return `
        <section class="section${breakClass}">
          <h2 class="section-title">${sectionTitle}</h2>
          ${education.map((edu, index) => {
            const itemBreak = isExport && shouldBreakBefore('education-item', index) ? ' page-break-before' : '';
            return `
              <div class="education-item${itemBreak}">
                <strong>${edu.institution || ''}</strong>${edu.degree || edu.field_of_study ? ` - ${edu.degree || ''}${edu.degree && edu.field_of_study ? ' • ' : ''}${edu.field_of_study || ''}` : ''}${edu.start_date || edu.end_date ? ` <span class="education-dates">(${edu.start_date && edu.start_date !== edu.end_date ? `${formatDate(edu.start_date, language)} – ` : ''}${formatDate(edu.end_date, language)})</span>` : ''}
              </div>
            `;
          }).join('')}
        </section>
      `;
    },

    languages: () => {
      if (!isSectionEnabled(selections, 'languages') ||
          !languages || languages.filter(lang => lang.name && lang.level).length === 0) {
        return '';
      }
      const sectionTitle = getSectionTitle('languages', section_titles.languages, language);
      const breakClass = isExport && shouldBreakBefore('section', sectionTitle) ? ' page-break-before' : '';

      return `
        <section class="section${breakClass}">
          <h2 class="section-title">${sectionTitle}</h2>
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
      if (!isSectionEnabled(selections, 'projects') || !projects || projects.length === 0) {
        return '';
      }
      const sectionTitle = getSectionTitle('projects', section_titles.projects, language);
      const breakClass = isExport && shouldBreakBefore('section', sectionTitle) ? ' page-break-before' : '';

      return `
        <section class="section${breakClass}">
          <h2 class="section-title">${sectionTitle}</h2>
          ${projects.map((project, index) => {
            const itemBreak = isExport && shouldBreakBefore('project-item', index) ? ' page-break-before' : '';
            return `
              <div class="project-item${itemBreak}">
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
            `;
          }).join('')}
        </section>
      `;
    },

    extras: () => {
      if (!isSectionEnabled(selections, 'extras') ||
          !extras || extras.filter(extra => extra.name && extra.summary).length === 0) {
        return '';
      }
      const sectionTitle = getSectionTitle('extras', section_titles.extras, language);
      const breakClass = isExport && shouldBreakBefore('section', sectionTitle) ? ' page-break-before' : '';

      const shortExtras = extras.filter(extra => extra.name && extra.summary && (extra.summary || '').length <= 40);
      const longExtras = extras.filter(extra => extra.name && extra.summary && (extra.summary || '').length > 40);

      return `
        <section class="section${breakClass}">
          <h2 class="section-title">${sectionTitle}</h2>
          ${shortExtras.length > 0 ? `
            <div class="extras-grid-short">
              ${shortExtras.map((extra, index) => {
                const itemBreak = isExport && shouldBreakBefore('extra-item', index) ? ' page-break-before' : '';
                return `
                  <div class="extra-item-short${itemBreak}">
                    <strong>${extra.name}:</strong> ${extra.summary}
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}
          ${longExtras.map((extra, index) => {
            const itemBreak = isExport && shouldBreakBefore('extra-item', index) ? ' page-break-before' : '';
            return `
              <div class="extra-item${itemBreak}">
                <strong>${extra.name}:</strong> ${extra.summary}
              </div>
            `;
          }).join('')}
        </section>
      `;
    }
  };
}

/**
 * Generate all sections HTML in the specified order
 */
export function generateSectionsHtml(sectionGenerators, order) {
  return order.map(sectionKey => {
    const generator = sectionGenerators[sectionKey];
    return generator ? generator() : '';
  }).join('');
}
