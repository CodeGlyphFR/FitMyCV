import { NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  BorderStyle,
  AlignmentType,
  Tab,
  TabStopType,
  TabStopPosition
} from "docx";
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
import { CommonErrors, CvErrors } from "@/lib/api/apiErrors";

const translations = {
  fr: { ...frUi, ...frErrors, ...frAuth, ...frCv, ...frEnums, ...frSubscription, ...frTasks, ...frOnboarding, ...frAccount },
  en: { ...enUi, ...enErrors, ...enAuth, ...enCv, ...enEnums, ...enSubscription, ...enTasks, ...enOnboarding, ...enAccount },
  es: { ...esUi, ...esErrors, ...esAuth, ...esCv, ...esEnums, ...esSubscription, ...esTasks, ...esOnboarding, ...esAccount },
  de: { ...deUi, ...deErrors, ...deAuth, ...deCv, ...deEnums, ...deSubscription, ...deTasks, ...deOnboarding, ...deAccount },
};

/**
 * Sanitize filename for HTTP Content-Disposition header
 */
function sanitizeFilenameForHeader(filename) {
  const asciiSafe = filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_');

  const encoded = encodeURIComponent(filename).replace(/'/g, '%27');

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

// Translate skill/language levels
function translateLevel(language, level, type = 'skill') {
  if (!level) return '';

  const path = type === 'skill' ? `skillLevels.${level}` : `languageLevels.${level}`;
  const translated = getTranslation(language, path);

  return translated === path ? level : translated;
}

// Get section title
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
  const isFrenchDefault = defaultTitlesFr[sectionKey]?.includes(trimmedTitle);
  const isEnglishDefault = defaultTitlesEn[sectionKey]?.includes(trimmedTitle);

  if (isFrenchDefault || isEnglishDefault) {
    return t(`cvSections.${sectionKey}`);
  }

  return customTitle;
}

export async function POST(request) {
  console.log('[Word Export] Request received');
  const startTime = Date.now();

  let creditTransactionId = null;
  let creditUsed = false;
  let userId = null;

  try {
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

    if (typeof filename === 'object' && filename !== null) {
      filename = filename.file || filename.name || filename.filename || String(filename);
    }

    filename = String(filename || '');

    if (!filename || filename === 'undefined') {
      return CvErrors.missingFilename();
    }

    const usageResult = await incrementFeatureCounter(session.user.id, 'export_cv', {});
    if (!usageResult.success) {
      return NextResponse.json({
        error: usageResult.error,
        actionRequired: usageResult.actionRequired,
        redirectUrl: usageResult.redirectUrl
      }, { status: 403 });
    }
    creditTransactionId = usageResult.transactionId;
    creditUsed = usageResult.usedCredit;

    let cvData;
    let cvLanguage;
    try {
      const cvResult = await readUserCvFileWithMeta(session.user.id, filename);
      cvData = cvResult.content;
      cvLanguage = cvResult.language || language || cvData?.language || 'fr';
      console.log('[Word Export] CV loaded successfully for user:', session.user.id);
    } catch (error) {
      console.error('[Word Export] Error loading CV:', error);
      if (creditUsed && creditTransactionId) {
        try {
          await refundCredit(session.user.id, creditTransactionId, 'CV introuvable lors de l\'export');
        } catch (refundError) {
          console.error('[Word Export] Erreur lors du remboursement:', refundError);
        }
      }
      return CvErrors.notFound();
    }

    // Générer le document Word
    console.log('[Word Export] Generating DOCX...');
    const doc = generateWordDocument(cvData, cvLanguage, selections, sectionsOrder);
    const docxBuffer = await Packer.toBuffer(doc);
    console.log('[Word Export] DOCX generated, buffer size:', docxBuffer.length);

    // Tracking
    const duration = Date.now() - startTime;
    try {
      await trackCvExport({
        userId: session.user.id,
        deviceId: null,
        language,
        duration,
        status: 'success',
        format: 'word'
      });
    } catch (trackError) {
      console.error('[Word Export] Erreur tracking télémétrie:', trackError);
    }

    const wordFilename = customFilename || filename.replace('.json', '');
    const { asciiSafe, encoded } = sanitizeFilenameForHeader(wordFilename);

    return new NextResponse(docxBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${asciiSafe}.docx"; filename*=UTF-8''${encoded}.docx`
      }
    });

  } catch (error) {
    console.error("Erreur lors de la génération Word:", error);
    console.error("Stack trace:", error.stack);

    if (creditUsed && creditTransactionId && userId) {
      try {
        await refundCredit(userId, creditTransactionId, `Échec export Word: ${error.message}`);
      } catch (refundError) {
        console.error('[Word Export] Erreur lors du remboursement:', refundError);
      }
    }

    const duration = Date.now() - startTime;
    try {
      const session = await auth();
      if (session?.user?.id) {
        await trackCvExport({
          userId: session.user.id,
          deviceId: null,
          language: 'fr',
          duration,
          status: 'error',
          error: error.message,
          format: 'word'
        });
      }
    } catch (trackError) {
      console.error('[Word Export] Erreur tracking télémétrie:', trackError);
    }

    return NextResponse.json(
      { error: "Erreur lors de la génération du fichier Word" },
      { status: 500 }
    );
  }
}

function generateWordDocument(cvData, language = 'fr', selections = null, sectionsOrder = null) {
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

  // Tri des expériences
  const sortedExperience = rawExperience
    .map((item, index) => ({ ...item, _originalIndex: index }))
    .sort((a, b) => {
      const dateA = a.end_date === "present" ? "9999-99" : (a.end_date || a.start_date || "");
      const dateB = b.end_date === "present" ? "9999-99" : (b.end_date || b.start_date || "");
      return dateB.localeCompare(dateA);
    });
  const experience = filterItems(sortedExperience, 'experience');

  // Tri des formations
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

  // Construire les sections du document
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

  // Générer les sections dans l'ordre
  const sectionGenerators = {
    summary: () => {
      if (!isSectionEnabled('summary') || !isSubsectionEnabled('summary', 'description') || !summary.description?.trim()) return [];
      return [
        createSectionTitle(getSectionTitle('summary', section_titles.summary, language)),
        new Paragraph({
          children: [new TextRun({ text: summary.description, size: 22 })],
          spacing: { after: 200 },
          alignment: AlignmentType.JUSTIFIED
        })
      ];
    },

    skills: () => {
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
    },

    experience: () => {
      if (!isSectionEnabled('experience') || !experience?.length) return [];
      const hideDescription = selections?.sections?.experience?.options?.hideDescription === true;
      const hideTechnologies = selections?.sections?.experience?.options?.hideTechnologies === true;
      const hideDeliverables = selections?.sections?.experience?.options?.hideDeliverables === true;

      const result = [createSectionTitle(getSectionTitle('experience', section_titles.experience, language))];

      experience.forEach(exp => {
        // Titre et dates
        const titleParts = [];
        if (exp.title) titleParts.push(new TextRun({ text: exp.title, bold: true, size: 24 }));

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

        // Entreprise
        if (exp.company) {
          const companyText = exp.company + (exp.department_or_client ? ` (${exp.department_or_client})` : '') + (exp.location ? ` - ${formatLocation(exp.location)}` : '');
          result.push(
            new Paragraph({
              children: [new TextRun({ text: companyText, size: 20, color: "666666" })],
              spacing: { after: 80 }
            })
          );
        }

        // Description
        if (!hideDescription && exp.description?.trim()) {
          result.push(
            new Paragraph({
              children: [new TextRun({ text: exp.description, size: 22 })],
              spacing: { after: 80 },
              alignment: AlignmentType.JUSTIFIED
            })
          );
        }

        // Responsabilités
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

        // Livrables
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

        // Technologies
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
    },

    education: () => {
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
    },

    languages: () => {
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
    },

    projects: () => {
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
    },

    extras: () => {
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
  };

  // Générer les sections dans l'ordre
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
