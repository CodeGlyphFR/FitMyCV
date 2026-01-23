/**
 * Section-specific diff functions for CV comparison
 * Handles experience, education, languages, projects, extras sections
 */

import { valuesAreDifferent } from './utils.js';
import { computeArrayItemDiff } from './arrays.js';

/**
 * Compare experiences and detect changes, additions, removals, and moves to projects
 */
export function compareExperiences(currentCv, previousCv) {
  const changes = [];
  const currentExperiences = currentCv.experience || [];
  const previousExperiences = previousCv.experience || [];
  const currentProjects = currentCv.projects || [];
  const previousProjects = previousCv.projects || [];

  const projectsFromMoveToProjects = new Set();

  const findMatchingNewProject = (exp) => {
    for (const proj of currentProjects) {
      if (projectsFromMoveToProjects.has(proj.name?.toLowerCase())) continue;

      const existedBefore = previousProjects.some(p =>
        p.name?.toLowerCase() === proj.name?.toLowerCase() ||
        p.summary?.toLowerCase() === proj.summary?.toLowerCase()
      );
      if (existedBefore) continue;

      const roleMatch = proj.role?.toLowerCase() === exp.title?.toLowerCase();
      const nameMatch = proj.name?.toLowerCase() === exp.title?.toLowerCase() ||
                       proj.name?.toLowerCase() === exp.company?.toLowerCase();
      const summaryMatch = exp.description && proj.summary?.toLowerCase().includes(exp.description.toLowerCase().substring(0, 50));
      const techMatch = exp.skills_used && proj.tech_stack &&
                       exp.skills_used.some(s => proj.tech_stack.includes(s));

      if (roleMatch || nameMatch || summaryMatch || techMatch) {
        return proj;
      }
    }
    return null;
  };

  const matchExperienceByContent = (exp, expList) => {
    const expTitle = exp.title?.toLowerCase()?.trim() || '';
    const expCompany = exp.company?.toLowerCase()?.trim() || '';
    const expStartDate = exp.start_date?.toLowerCase()?.trim() || '';

    let idx = expList.findIndex(e =>
      e.title?.toLowerCase()?.trim() === expTitle &&
      e.company?.toLowerCase()?.trim() === expCompany
    );
    if (idx !== -1) return idx;

    if (expCompany && expStartDate) {
      idx = expList.findIndex(e =>
        e.company?.toLowerCase()?.trim() === expCompany &&
        e.start_date?.toLowerCase()?.trim() === expStartDate
      );
      if (idx !== -1) return idx;
    }

    if (expCompany) {
      const companiesMatching = expList.filter(e =>
        e.company?.toLowerCase()?.trim() === expCompany
      );
      if (companiesMatching.length === 1) {
        idx = expList.findIndex(e =>
          e.company?.toLowerCase()?.trim() === expCompany
        );
        if (idx !== -1) return idx;
      }
    }

    idx = expList.findIndex(e =>
      e.title?.toLowerCase()?.trim() === expTitle
    );
    return idx;
  };

  // Expériences supprimées ou déplacées
  previousExperiences.forEach((previousExp, originalIndex) => {
    const matchedIdx = matchExperienceByContent(previousExp, currentExperiences);

    if (matchedIdx === -1) {
      const matchingProject = findMatchingNewProject(previousExp);

      if (matchingProject) {
        projectsFromMoveToProjects.add(matchingProject.name?.toLowerCase());

        changes.push({
          section: 'experience',
          field: `experience[${originalIndex}]`,
          path: `experience[${originalIndex}]`,
          changeType: 'move_to_projects',
          change: `Expérience "${previousExp.title || 'Sans titre'}" transférée vers Projets`,
          reason: 'Projet personnel pertinent pour le poste',
          beforeValue: previousExp,
          projectData: matchingProject,
        });
      } else {
        changes.push({
          section: 'experience',
          field: `experience[${originalIndex}]`,
          path: `experience[${originalIndex}]`,
          changeType: 'experience_removed',
          change: `Expérience « ${previousExp.title || 'Sans titre'} » supprimée`,
          reason: 'Non pertinente pour le poste ciblé',
          beforeValue: previousExp,
        });
      }
    }
  });

  // Expériences ajoutées
  currentExperiences.forEach((currentExp, idx) => {
    const matchedIdx = matchExperienceByContent(currentExp, previousExperiences);
    if (matchedIdx === -1) {
      changes.push({
        section: 'experience',
        field: `experience[${idx}]`,
        path: `experience[${idx}]`,
        changeType: 'experience_added',
        change: `Expérience "${currentExp.title || 'Sans titre'}" ajoutée`,
        reason: 'Pertinente pour le poste ciblé',
        afterValue: currentExp,
      });
    }
  });

  // Expériences modifiées
  currentExperiences.forEach((currentExp, currentIdx) => {
    const previousIdx = matchExperienceByContent(currentExp, previousExperiences);
    if (previousIdx === -1) return;

    const previousExp = previousExperiences[previousIdx];
    if (!valuesAreDifferent(currentExp, previousExp)) return;

    const expTitle = currentExp.title || previousExp.title || `Expérience ${currentIdx + 1}`;

    // Titre
    if (valuesAreDifferent(currentExp.title, previousExp.title)) {
      changes.push({
        section: 'experience',
        field: 'title',
        path: `experience[${currentIdx}].title`,
        expIndex: currentIdx,
        changeType: 'modified',
        beforeValue: previousExp.title,
        afterValue: currentExp.title,
        itemName: `Titre: ${previousExp.title || 'N/A'} → ${currentExp.title || 'N/A'}`,
        change: `Titre modifié dans "${expTitle}"`,
        reason: 'Adaptation au poste ciblé',
      });
    }

    // Description
    if (valuesAreDifferent(currentExp.description, previousExp.description)) {
      changes.push({
        section: 'experience',
        field: 'description',
        path: `experience[${currentIdx}].description`,
        expIndex: currentIdx,
        changeType: 'modified',
        beforeValue: previousExp.description,
        afterValue: currentExp.description,
        itemName: 'Description',
        change: `Description modifiée dans "${expTitle}"`,
        reason: 'Adaptation au poste ciblé',
      });
    }

    // Responsabilités
    const currentResp = currentExp.responsibilities || [];
    const previousResp = previousExp.responsibilities || [];
    if (valuesAreDifferent(currentResp, previousResp)) {
      changes.push({
        section: 'experience',
        field: 'responsibilities',
        path: `experience[${currentIdx}].responsibilities`,
        expIndex: currentIdx,
        changeType: 'modified',
        itemName: 'Responsabilités',
        beforeValue: previousResp,
        afterValue: currentResp,
        beforeDisplay: previousResp.length > 0
          ? previousResp.map(r => `• ${r}`).join('\n')
          : '',
        afterDisplay: currentResp.length > 0
          ? currentResp.map(r => `• ${r}`).join('\n')
          : '',
        change: `Responsabilités modifiées dans "${expTitle}"`,
        reason: 'Adaptation au poste ciblé',
      });
    }

    // Skills utilisés
    const currentSkillsUsed = currentExp.skills_used || [];
    const previousSkillsUsed = previousExp.skills_used || [];
    if (valuesAreDifferent(currentSkillsUsed, previousSkillsUsed)) {
      const skillsUsedChanges = computeArrayItemDiff(
        currentSkillsUsed,
        previousSkillsUsed,
        'experience',
        'skills_used',
        `experience[${currentIdx}].skills_used`
      );
      skillsUsedChanges.forEach(c => { c.expIndex = currentIdx; });
      changes.push(...skillsUsedChanges);
    }

    // Livrables
    const currentDel = currentExp.deliverables || [];
    const previousDel = previousExp.deliverables || [];
    if (valuesAreDifferent(currentDel, previousDel)) {
      changes.push({
        section: 'experience',
        field: 'deliverables',
        path: `experience[${currentIdx}].deliverables`,
        expIndex: currentIdx,
        changeType: 'modified',
        itemName: 'Résultats',
        beforeValue: previousDel,
        afterValue: currentDel,
        beforeDisplay: previousDel.length > 0
          ? previousDel.map(d => `• ${d}`).join('\n')
          : '',
        afterDisplay: currentDel.length > 0
          ? currentDel.map(d => `• ${d}`).join('\n')
          : '',
        change: `Résultats modifiés dans "${expTitle}"`,
        reason: 'Adaptation au poste ciblé',
      });
    }
  });

  return { changes, projectsFromMoveToProjects };
}

/**
 * Compare education entries
 */
export function compareEducation(currentCv, previousCv) {
  const changes = [];
  const currentEducation = currentCv.education || [];
  const previousEducation = previousCv.education || [];

  const getEducationKey = (edu) => {
    if (!edu) return '';
    const degree = (edu.degree || edu.title || '').toLowerCase().trim();
    const institution = (edu.institution || edu.school || '').toLowerCase().trim();
    return `${degree}|${institution}`;
  };

  const getEducationDisplayName = (edu) => {
    if (!edu) return '';
    const degree = edu.degree || edu.title || '';
    const institution = edu.institution || edu.school || '';
    return institution ? `${degree} - ${institution}` : degree;
  };

  const previousEduKeys = new Set(previousEducation.map(getEducationKey).filter(Boolean));
  const currentEduKeys = new Set(currentEducation.map(getEducationKey).filter(Boolean));

  currentEducation.forEach((edu) => {
    const key = getEducationKey(edu);
    if (key && !previousEduKeys.has(key)) {
      changes.push({
        section: 'education',
        field: 'education',
        path: 'education',
        itemName: getEducationDisplayName(edu),
        changeType: 'added',
        itemValue: edu,
        change: `${getEducationDisplayName(edu)} ajouté`,
        reason: 'Formation pertinente pour le poste',
      });
    }
  });

  previousEducation.forEach((edu) => {
    const key = getEducationKey(edu);
    if (key && !currentEduKeys.has(key)) {
      changes.push({
        section: 'education',
        field: 'education',
        path: 'education',
        itemName: getEducationDisplayName(edu),
        changeType: 'removed',
        itemValue: edu,
        change: `« ${getEducationDisplayName(edu)} » supprimé`,
        reason: 'Non pertinent pour le poste ciblé',
      });
    }
  });

  return changes;
}

/**
 * Compare languages
 */
export function compareLanguages(currentCv, previousCv) {
  const changes = [];
  const currentLanguages = currentCv.languages || [];
  const previousLanguages = previousCv.languages || [];

  const getLanguageName = (lang) => {
    if (typeof lang === 'string') return lang.toLowerCase().trim();
    return (lang?.name || '').toLowerCase().trim();
  };

  const previousLangNames = new Set(previousLanguages.map(getLanguageName).filter(Boolean));
  const currentLangNames = new Set(currentLanguages.map(getLanguageName).filter(Boolean));

  currentLanguages.forEach((lang) => {
    const name = getLanguageName(lang);
    const displayName = typeof lang === 'string' ? lang : lang?.name || '';
    if (name && !previousLangNames.has(name)) {
      changes.push({
        section: 'languages',
        field: 'languages',
        path: 'languages',
        itemName: displayName,
        changeType: 'added',
        itemValue: lang,
        change: `${displayName} ajouté`,
        reason: 'Langue pertinente pour le poste',
      });
    }
  });

  previousLanguages.forEach((lang) => {
    const name = getLanguageName(lang);
    const displayName = typeof lang === 'string' ? lang : lang?.name || '';
    if (name && !currentLangNames.has(name)) {
      changes.push({
        section: 'languages',
        field: 'languages',
        path: 'languages',
        itemName: displayName,
        changeType: 'removed',
        itemValue: lang,
        change: `« ${displayName} » supprimé`,
        reason: 'Non pertinent pour le poste ciblé',
      });
    }
  });

  // Langues modifiées
  currentLanguages.forEach((currentLang) => {
    const name = getLanguageName(currentLang);
    const displayName = typeof currentLang === 'string' ? currentLang : currentLang?.name || '';

    const previousLang = previousLanguages.find(p => getLanguageName(p) === name);
    if (previousLang && valuesAreDifferent(currentLang, previousLang)) {
      const currentLevel = typeof currentLang === 'object' ? currentLang.level || currentLang.proficiency : null;
      const previousLevel = typeof previousLang === 'object' ? previousLang.level || previousLang.proficiency : null;

      changes.push({
        section: 'languages',
        field: 'languages',
        path: 'languages',
        itemName: displayName,
        changeType: 'modified',
        beforeValue: previousLang,
        afterValue: currentLang,
        change: `Niveau de ${displayName} modifié${previousLevel && currentLevel ? `: ${previousLevel} → ${currentLevel}` : ''}`,
        reason: 'Adaptation au niveau requis pour le poste',
      });
    }
  });

  return changes;
}

/**
 * Compare extras
 */
export function compareExtras(currentCv, previousCv) {
  const changes = [];
  const currentExtras = currentCv.extras || [];
  const previousExtras = previousCv.extras || [];

  const getExtraName = (extra) => {
    if (typeof extra === 'string') return extra.toLowerCase().trim();
    return (extra?.name || extra?.title || '').toLowerCase().trim();
  };

  const previousExtraNames = new Set(previousExtras.map(getExtraName).filter(Boolean));
  const currentExtraNames = new Set(currentExtras.map(getExtraName).filter(Boolean));

  currentExtras.forEach((extra) => {
    const name = getExtraName(extra);
    const displayName = typeof extra === 'string' ? extra : extra?.name || extra?.title || '';
    if (name && !previousExtraNames.has(name)) {
      changes.push({
        section: 'extras',
        field: 'extras',
        path: 'extras',
        itemName: displayName,
        changeType: 'added',
        itemValue: extra,
        change: `${displayName} ajouté`,
        reason: 'Pertinent pour le poste ciblé',
      });
    }
  });

  previousExtras.forEach((extra) => {
    const name = getExtraName(extra);
    const displayName = typeof extra === 'string' ? extra : extra?.name || extra?.title || '';
    if (name && !currentExtraNames.has(name)) {
      changes.push({
        section: 'extras',
        field: 'extras',
        path: 'extras',
        itemName: displayName,
        changeType: 'removed',
        itemValue: extra,
        beforeValue: extra,  // Pour que Extras.jsx puisse lire .summary
        change: `« ${displayName} » supprimé`,
        reason: 'Non pertinent pour le poste ciblé',
      });
    }
  });

  return changes;
}

/**
 * Compare projects
 */
export function compareProjects(currentCv, previousCv, projectsFromMoveToProjects) {
  const changes = [];
  const currentProjects = currentCv.projects || [];
  const previousProjects = previousCv.projects || [];

  const currentProjectsFiltered = currentProjects.filter(p =>
    !projectsFromMoveToProjects.has(p.name?.toLowerCase())
  );

  const getProjectKey = (proj) => {
    if (!proj) return '';
    return (proj.name || proj.title || '').toLowerCase().trim();
  };

  const getProjectDisplayName = (proj) => {
    if (!proj) return '';
    return proj.name || proj.title || '';
  };

  const previousProjectKeys = new Set(previousProjects.map(getProjectKey).filter(Boolean));
  const currentProjectKeys = new Set(currentProjectsFiltered.map(getProjectKey).filter(Boolean));

  currentProjectsFiltered.forEach((proj, idx) => {
    const key = getProjectKey(proj);
    if (key && !previousProjectKeys.has(key)) {
      const realIdx = currentProjects.findIndex(p => getProjectKey(p) === key);
      changes.push({
        section: 'projects',
        field: 'projects',
        path: `projects[${realIdx !== -1 ? realIdx : idx}]`,
        itemName: getProjectDisplayName(proj),
        changeType: 'added',
        itemValue: proj,
        afterValue: proj,
        beforeValue: null,
        change: `Projet "${getProjectDisplayName(proj)}" ajouté`,
        reason: 'Projet pertinent pour le poste',
      });
    }
  });

  previousProjects.forEach((proj) => {
    const key = getProjectKey(proj);
    if (key && !currentProjectKeys.has(key)) {
      changes.push({
        section: 'projects',
        field: 'projects',
        path: 'projects',
        itemName: getProjectDisplayName(proj),
        changeType: 'removed',
        itemValue: proj,
        beforeValue: proj,  // Pour cohérence avec extras et pour le rollback
        change: `Projet « ${getProjectDisplayName(proj)} » supprimé`,
        reason: 'Non pertinent pour le poste ciblé',
      });
    }
  });

  return changes;
}
