/**
 * Word document builder for CV export
 */
import {
  Document,
  Paragraph,
  TextRun,
  BorderStyle,
  AlignmentType,
} from "docx";
import { formatPhoneNumber } from "@/lib/utils/phoneFormatting";
import { capitalizeSkillName } from "@/lib/utils/textFormatting";
import { getTranslation, translateLevel, getSectionTitle } from "./translations";

/**
 * Generate Word document from CV data
 */
export function generateWordDocument(cvData, language = 'fr', selections = null, sectionsOrder = null) {
  const t = (path) => getTranslation(language, path);

  const defaultOrder = ['summary', 'skills', 'experience', 'education', 'languages', 'projects', 'extras'];
  const order = sectionsOrder || defaultOrder;

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

  const filterItems = (items, sectionKey) => {
    if (!selections || !selections.sections) return items;
    const section = selections.sections[sectionKey];
    if (!section || !section.items) return items;
    return items
      .map((item, index) => ({ ...item, _originalIndex: item._originalIndex !== undefined ? item._originalIndex : index }))
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

  // Sort experiences
  const sortedExperience = rawExperience
    .map((item, index) => ({ ...item, _originalIndex: index }))
    .sort((a, b) => {
      const dateA = a.end_date === "present" ? "9999-99" : (a.end_date || a.start_date || "");
      const dateB = b.end_date === "present" ? "9999-99" : (b.end_date || b.start_date || "");
      return dateB.localeCompare(dateA);
    });
  const experience = filterItems(sortedExperience, 'experience');

  // Sort education
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

  // Build document sections
  const children = [];

  // Header
  if (header.full_name) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: header.full_name, bold: true, size: 36 })],
        spacing: { after: 100 }
      })
    );
  }

  if (header.current_title) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: header.current_title, color: "666666", size: 24 })],
        spacing: { after: 100 }
      })
    );
  }

  // Contact info
  if (isSubsectionEnabled('header', 'contact')) {
    const contactParts = [];
    if (contact.email) contactParts.push(contact.email);
    if (contact.phone) contactParts.push(formatPhoneNumber(contact.phone, contact.location?.country_code));
    if (contact.location) contactParts.push(formatLocation(contact.location));

    if (contactParts.length > 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: contactParts.join(' | '), size: 20, color: "555555" })],
          spacing: { after: 100 }
        })
      );
    }
  }

  // Links
  if (isSubsectionEnabled('header', 'links') && contact.links?.length > 0) {
    children.push(
      new Paragraph({
        children: contact.links.map((link, i) =>
          new TextRun({
            text: (link.label || link.url) + (i < contact.links.length - 1 ? '  |  ' : ''),
            size: 20,
            color: "0066CC"
          })
        ),
        spacing: { after: 200 }
      })
    );
  }

  // Section generators
  const sectionGenerators = {
    summary: () => generateSummarySection(summary, section_titles, language, isSectionEnabled, isSubsectionEnabled),
    skills: () => generateSkillsSection(skills, section_titles, language, selections, isSectionEnabled, isSubsectionEnabled, t),
    experience: () => generateExperienceSection(experience, section_titles, language, selections, isSectionEnabled, t),
    education: () => generateEducationSection(education, section_titles, language, isSectionEnabled),
    languages: () => generateLanguagesSection(languages, section_titles, language, isSectionEnabled),
    projects: () => generateProjectsSection(projects, section_titles, language, isSectionEnabled, t),
    extras: () => generateExtrasSection(extras, section_titles, language, isSectionEnabled),
  };

  // Generate sections in order
  order.forEach(sectionKey => {
    const generator = sectionGenerators[sectionKey];
    if (generator) {
      children.push(...generator());
    }
  });

  return new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 720,
            right: 720,
            bottom: 720,
            left: 720
          }
        }
      },
      children
    }]
  });
}

function createSectionTitle(title) {
  return new Paragraph({
    children: [new TextRun({ text: title, bold: true, size: 26 })],
    spacing: { before: 240, after: 120 },
    border: {
      bottom: { color: "CCCCCC", size: 6, style: BorderStyle.SINGLE }
    }
  });
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

function generateSummarySection(summary, section_titles, language, isSectionEnabled, isSubsectionEnabled) {
  if (!isSectionEnabled('summary') || !isSubsectionEnabled('summary', 'description') || !summary.description?.trim()) return [];
  return [
    createSectionTitle(getSectionTitle('summary', section_titles.summary, language)),
    new Paragraph({
      children: [new TextRun({ text: summary.description, size: 22 })],
      spacing: { after: 200 },
      alignment: AlignmentType.JUSTIFIED
    })
  ];
}

function generateSkillsSection(skills, section_titles, language, selections, isSectionEnabled, isSubsectionEnabled, t) {
  if (!isSectionEnabled('skills')) return [];
  const hideProficiency = selections?.sections?.skills?.options?.hideProficiency === true;
  const result = [createSectionTitle(getSectionTitle('skills', section_titles.skills, language))];

  const addSkillCategory = (items, label, isSimple = false) => {
    if (!items?.length) return;
    const filtered = isSimple ? items.filter(s => s?.trim()) : items.filter(s => s.name && s.proficiency);
    if (!filtered.length) return;

    const text = isSimple
      ? filtered.map(s => capitalizeSkillName(s)).join(', ')
      : filtered.map(s => hideProficiency ? capitalizeSkillName(s.name) : `${capitalizeSkillName(s.name)} (${translateLevel(language, s.proficiency, 'skill')})`).join(', ');

    result.push(
      new Paragraph({
        children: [
          new TextRun({ text: label + ': ', bold: true, size: 22 }),
          new TextRun({ text, size: 22 })
        ],
        spacing: { after: 80 }
      })
    );
  };

  if (isSubsectionEnabled('skills', 'hard_skills')) addSkillCategory(skills.hard_skills, t('cvSections.hardSkills'));
  if (isSubsectionEnabled('skills', 'tools')) addSkillCategory(skills.tools, t('cvSections.tools'));
  if (isSubsectionEnabled('skills', 'soft_skills')) addSkillCategory(skills.soft_skills, t('cvSections.softSkills'), true);
  if (isSubsectionEnabled('skills', 'methodologies')) addSkillCategory(skills.methodologies, t('cvSections.methodologies'), true);

  return result;
}

function generateExperienceSection(experience, section_titles, language, selections, isSectionEnabled, t) {
  if (!isSectionEnabled('experience') || !experience?.length) return [];
  const hideDescription = selections?.sections?.experience?.options?.hideDescription === true;
  const hideTechnologies = selections?.sections?.experience?.options?.hideTechnologies === true;
  const hideDeliverables = selections?.sections?.experience?.options?.hideDeliverables === true;

  const result = [createSectionTitle(getSectionTitle('experience', section_titles.experience, language))];

  experience.forEach(exp => {
    result.push(
      new Paragraph({
        children: [
          ...(exp.title ? [new TextRun({ text: exp.title, bold: true, size: 24 })] : []),
          ...(exp.start_date || exp.end_date ? [
            new TextRun({ text: '  ', size: 24 }),
            new TextRun({
              text: `${formatDate(exp.start_date, language)} – ${formatDate(exp.end_date, language)}`,
              size: 20,
              color: "666666"
            })
          ] : [])
        ],
        spacing: { before: 150, after: 40 }
      })
    );

    if (exp.company) {
      const companyText = exp.company + (exp.department_or_client ? ` (${exp.department_or_client})` : '') + (exp.location ? ` - ${formatLocation(exp.location)}` : '');
      result.push(
        new Paragraph({
          children: [new TextRun({ text: companyText, size: 20, color: "666666" })],
          spacing: { after: 80 }
        })
      );
    }

    if (!hideDescription && exp.description?.trim()) {
      result.push(
        new Paragraph({
          children: [new TextRun({ text: exp.description, size: 22 })],
          spacing: { after: 80 },
          alignment: AlignmentType.JUSTIFIED
        })
      );
    }

    if (exp.responsibilities?.length) {
      exp.responsibilities.forEach(resp => {
        result.push(
          new Paragraph({
            children: [new TextRun({ text: `• ${resp}`, size: 22 })],
            spacing: { after: 40 },
            indent: { left: 360 }
          })
        );
      });
    }

    if (!hideDeliverables && exp.deliverables?.length) {
      result.push(
        new Paragraph({
          children: [
            new TextRun({ text: t('cvSections.deliverables') + ': ', bold: true, size: 20, color: "555555" }),
            new TextRun({ text: exp.deliverables.join(', '), size: 20, color: "555555" })
          ],
          spacing: { after: 40 }
        })
      );
    }

    if (!hideTechnologies && exp.skills_used?.length) {
      result.push(
        new Paragraph({
          children: [
            new TextRun({ text: t('cvSections.technologies') + ': ', bold: true, size: 20, color: "555555" }),
            new TextRun({ text: exp.skills_used.join(', '), size: 20, color: "555555" })
          ],
          spacing: { after: 100 }
        })
      );
    }
  });

  return result;
}

function generateEducationSection(education, section_titles, language, isSectionEnabled) {
  if (!isSectionEnabled('education') || !education?.length) return [];
  const result = [createSectionTitle(getSectionTitle('education', section_titles.education, language))];

  education.forEach(edu => {
    const parts = [];
    if (edu.institution) parts.push(new TextRun({ text: edu.institution, bold: true, size: 22 }));
    if (edu.degree || edu.field_of_study) {
      parts.push(new TextRun({ text: ' - ', size: 22 }));
      if (edu.degree) parts.push(new TextRun({ text: edu.degree, size: 22 }));
      if (edu.degree && edu.field_of_study) parts.push(new TextRun({ text: ' • ', size: 22 }));
      if (edu.field_of_study) parts.push(new TextRun({ text: edu.field_of_study, size: 22 }));
    }
    if (edu.start_date || edu.end_date) {
      const dateText = edu.start_date && edu.start_date !== edu.end_date
        ? ` (${formatDate(edu.start_date, language)} – ${formatDate(edu.end_date, language)})`
        : ` (${formatDate(edu.end_date, language)})`;
      parts.push(new TextRun({ text: dateText, size: 20, color: "666666" }));
    }

    result.push(new Paragraph({ children: parts, spacing: { after: 80 } }));
  });

  return result;
}

function generateLanguagesSection(languages, section_titles, language, isSectionEnabled) {
  if (!isSectionEnabled('languages')) return [];
  const filtered = languages.filter(lang => lang.name && lang.level);
  if (!filtered.length) return [];

  const result = [createSectionTitle(getSectionTitle('languages', section_titles.languages, language))];

  const langText = filtered.map(lang => `${lang.name}: ${translateLevel(language, lang.level, 'language')}`).join('  |  ');
  result.push(
    new Paragraph({
      children: [new TextRun({ text: langText, size: 22 })],
      spacing: { after: 100 }
    })
  );

  return result;
}

function generateProjectsSection(projects, section_titles, language, isSectionEnabled, t) {
  if (!isSectionEnabled('projects') || !projects?.length) return [];
  const result = [createSectionTitle(getSectionTitle('projects', section_titles.projects, language))];

  projects.forEach(project => {
    const titleParts = [];
    if (project.name) titleParts.push(new TextRun({ text: project.name, bold: true, size: 22 }));
    if (project.role) titleParts.push(new TextRun({ text: ` - ${project.role}`, size: 20, color: "666666" }));
    if (project.start_date || project.end_date) {
      const dateText = project.end_date
        ? ` (${formatDate(project.start_date, language)} – ${formatDate(project.end_date, language)})`
        : ` (${formatDate(project.start_date, language)})`;
      titleParts.push(new TextRun({ text: dateText, size: 20, color: "666666" }));
    }

    result.push(new Paragraph({ children: titleParts, spacing: { before: 100, after: 40 } }));

    if (project.summary?.trim()) {
      result.push(
        new Paragraph({
          children: [new TextRun({ text: project.summary, size: 22 })],
          spacing: { after: 40 },
          alignment: AlignmentType.JUSTIFIED
        })
      );
    }

    if (project.tech_stack?.length) {
      result.push(
        new Paragraph({
          children: [
            new TextRun({ text: t('cvSections.technologies') + ': ', bold: true, size: 20, color: "555555" }),
            new TextRun({ text: project.tech_stack.join(', '), size: 20, color: "555555" })
          ],
          spacing: { after: 80 }
        })
      );
    }
  });

  return result;
}

function generateExtrasSection(extras, section_titles, language, isSectionEnabled) {
  if (!isSectionEnabled('extras')) return [];
  const filtered = extras.filter(extra => extra.name && extra.summary);
  if (!filtered.length) return [];

  const result = [createSectionTitle(getSectionTitle('extras', section_titles.extras, language))];

  filtered.forEach(extra => {
    result.push(
      new Paragraph({
        children: [
          new TextRun({ text: extra.name + ': ', bold: true, size: 22 }),
          new TextRun({ text: extra.summary, size: 22 })
        ],
        spacing: { after: 80 }
      })
    );
  });

  return result;
}
