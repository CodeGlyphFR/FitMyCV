/**
 * Fonctions de calcul de diff entre versions de CV
 *
 * Ce module contient toutes les fonctions pour calculer les différences
 * entre deux versions d'un CV de manière détaillée.
 */

import { v4 as uuidv4 } from 'uuid';
import { normalizeToNumber, getLevelKey } from '@/lib/constants/skillLevels';

/**
 * Générer un ID unique pour un changement
 * @returns {string} ID unique au format change_xxx
 */
export function generateChangeId() {
  return `change_${uuidv4().slice(0, 8)}`;
}

/**
 * Résoudre un chemin JSON vers sa valeur dans un objet
 * @param {Object} obj - L'objet à traverser
 * @param {string} path - Chemin JSON (ex: "summary.description", "skills.hard_skills[0].name")
 * @returns {*} La valeur au chemin spécifié, ou undefined si non trouvé
 */
export function getValueAtPath(obj, path) {
  if (!obj || !path) return undefined;

  const parts = path.split(/[.[\]]+/).filter(Boolean);
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }

  return current;
}

/**
 * Définir une valeur à un chemin JSON dans un objet
 * @param {Object} obj - L'objet à modifier (sera muté)
 * @param {string} path - Chemin JSON
 * @param {*} value - Valeur à définir
 */
export function setValueAtPath(obj, path, value) {
  if (!obj || !path) return;

  const parts = path.split(/[.[\]]+/).filter(Boolean);
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || current[part] === null) {
      // Créer un objet ou tableau intermédiaire
      current[part] = isNaN(Number(parts[i + 1])) ? {} : [];
    }
    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Comparer deux valeurs et retourner une représentation lisible
 * @param {*} before - Valeur avant
 * @param {*} after - Valeur après
 * @returns {Object} { beforeDisplay, afterDisplay }
 */
function formatValueForDisplay(before, after) {
  const formatValue = (val) => {
    if (val === undefined || val === null) return '';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) {
      // Pour les tableaux de skills, extraire les noms
      if (val.length > 0 && typeof val[0] === 'object' && val[0]?.name) {
        return val.map(s => s.name).join(', ');
      }
      return val.join(', ');
    }
    if (typeof val === 'object') {
      return JSON.stringify(val, null, 2);
    }
    return String(val);
  };

  return {
    beforeDisplay: formatValue(before),
    afterDisplay: formatValue(after),
  };
}

/**
 * Comparer deux valeurs de manière profonde
 * @param {*} a - Première valeur
 * @param {*} b - Deuxième valeur
 * @returns {boolean} true si les valeurs sont différentes
 */
function valuesAreDifferent(a, b) {
  // Cas null/undefined
  if (a === null || a === undefined) {
    if (b === null || b === undefined) return false;
    if (typeof b === 'string') return b.trim() !== '';
    if (Array.isArray(b)) return b.length > 0;
    return true;
  }
  if (b === null || b === undefined) {
    if (typeof a === 'string') return a.trim() !== '';
    if (Array.isArray(a)) return a.length > 0;
    return true;
  }

  // Cas strings - normaliser les espaces pour éviter les faux positifs
  if (typeof a === 'string' && typeof b === 'string') {
    const normalizeStr = (s) => s.trim().replace(/\s+/g, ' ');
    return normalizeStr(a) !== normalizeStr(b);
  }

  // Cas arrays - comparaison plus robuste
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return true;

    try {
      const sortedA = JSON.stringify([...a].sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y))));
      const sortedB = JSON.stringify([...b].sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y))));
      return sortedA !== sortedB;
    } catch {
      return JSON.stringify(a) !== JSON.stringify(b);
    }
  }

  // Cas objects - comparer les clés significatives
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) !== JSON.stringify(b);
  }

  // Autres cas
  return a !== b;
}

/**
 * Calculer les différences item par item dans un tableau de skills
 * Détecte les ajouts, suppressions et changements de niveau
 */
function computeArrayItemDiff(currentArr, previousArr, section, field, basePath) {
  const changes = [];

  const getName = (item) => {
    if (typeof item === 'string') return item.toLowerCase().trim();
    return (item?.name || item?.label || item?.title || item?.value || '').toLowerCase().trim();
  };

  const getDisplayName = (item) => {
    if (typeof item === 'string') return item;
    return item?.name || item?.label || item?.title || item?.value || '';
  };

  const getProficiency = (item) => {
    if (typeof item === 'string') return null;
    const raw = item?.proficiency ?? item?.level ?? null;
    return normalizeToNumber(raw);
  };

  const previousMap = new Map();
  previousArr.forEach(item => {
    const name = getName(item);
    if (name) previousMap.set(name, item);
  });

  const currentMap = new Map();
  currentArr.forEach(item => {
    const name = getName(item);
    if (name) currentMap.set(name, item);
  });

  // Items ajoutés
  currentArr.forEach((item) => {
    const name = getName(item);
    if (name && !previousMap.has(name)) {
      changes.push({
        section,
        field,
        path: basePath,
        itemName: getDisplayName(item),
        changeType: 'added',
        itemValue: item,
        afterValue: typeof item === 'string' ? item : getDisplayName(item),
        change: `${getDisplayName(item)} ajouté`,
        reason: 'Compétence pertinente pour le poste',
      });
    }
  });

  // Items supprimés
  previousArr.forEach((item) => {
    const name = getName(item);
    if (name && !currentMap.has(name)) {
      changes.push({
        section,
        field,
        path: basePath,
        itemName: getDisplayName(item),
        changeType: 'removed',
        itemValue: item,
        beforeValue: typeof item === 'string' ? item : getDisplayName(item),
        change: `« ${getDisplayName(item)} » supprimé`,
        reason: 'Non pertinent pour le poste ciblé',
      });
    }
  });

  // Items avec niveau modifié
  currentArr.forEach((currentItem) => {
    const name = getName(currentItem);
    if (name && previousMap.has(name)) {
      const previousItem = previousMap.get(name);
      const currentProficiency = getProficiency(currentItem);
      const previousProficiency = getProficiency(previousItem);

      if (currentProficiency !== null && previousProficiency !== null && currentProficiency !== previousProficiency) {
        const beforeKey = getLevelKey(previousProficiency) || String(previousProficiency);
        const afterKey = getLevelKey(currentProficiency) || String(currentProficiency);
        changes.push({
          section,
          field,
          path: basePath,
          itemName: getDisplayName(currentItem),
          changeType: 'level_adjusted',
          beforeValue: previousProficiency,
          afterValue: currentProficiency,
          itemValue: currentItem,
          change: `${getDisplayName(currentItem)}: ${beforeKey} → ${afterKey}`,
          reason: 'Niveau ajusté selon l\'expérience',
        });
      }
    }
  });

  return changes;
}

/**
 * Calculer les différences bullet par bullet dans un tableau de strings
 * Utilisé pour responsibilities et deliverables des expériences
 */
function computeBulletDiff(currentArr, previousArr, section, field, basePath, expIndex, expTitle) {
  const changes = [];

  const normalizeBullet = (bullet) => {
    if (!bullet || typeof bullet !== 'string') return '';
    return bullet.toLowerCase().trim().replace(/[.,:;!?]+$/, '').trim();
  };

  const getSignificantStart = (bullet) => {
    if (!bullet || typeof bullet !== 'string') return '';
    const words = bullet.toLowerCase().trim().split(/\s+/).slice(0, 5);
    return words.join(' ');
  };

  const currentNormalized = currentArr.map(normalizeBullet);
  const previousNormalized = previousArr.map(normalizeBullet);
  const previousStarts = previousArr.map(getSignificantStart);
  const currentStarts = currentArr.map(getSignificantStart);

  const matchedPrevious = new Set();
  const matchedCurrent = new Set();

  // Correspondances exactes
  currentArr.forEach((bullet, idx) => {
    const normalized = currentNormalized[idx];
    const prevIdx = previousNormalized.findIndex((p, i) => p === normalized && !matchedPrevious.has(i));
    if (prevIdx !== -1) {
      matchedPrevious.add(prevIdx);
      matchedCurrent.add(idx);
    }
  });

  // Correspondances partielles
  currentArr.forEach((bullet, idx) => {
    if (matchedCurrent.has(idx)) return;
    const start = currentStarts[idx];
    if (!start) return;

    const prevIdx = previousStarts.findIndex((p, i) => p === start && !matchedPrevious.has(i));
    if (prevIdx !== -1) {
      changes.push({
        section,
        field,
        path: basePath,
        expIndex,
        bulletIndex: idx,
        itemName: bullet.substring(0, 50) + (bullet.length > 50 ? '...' : ''),
        changeType: 'modified',
        beforeValue: previousArr[prevIdx],
        afterValue: bullet,
        change: `Responsabilité modifiée dans "${expTitle}"`,
        reason: 'Reformulation pour le poste ciblé',
      });
      matchedPrevious.add(prevIdx);
      matchedCurrent.add(idx);
    }
  });

  // Bullets ajoutés
  currentArr.forEach((bullet, idx) => {
    if (matchedCurrent.has(idx)) return;
    changes.push({
      section,
      field,
      path: basePath,
      expIndex,
      bulletIndex: idx,
      itemName: bullet.substring(0, 50) + (bullet.length > 50 ? '...' : ''),
      changeType: 'added',
      itemValue: bullet,
      afterValue: bullet,
      change: `Nouvelle responsabilité dans "${expTitle}"`,
      reason: 'Ajout pertinent pour le poste ciblé',
    });
  });

  // Bullets supprimés
  previousArr.forEach((bullet, idx) => {
    if (matchedPrevious.has(idx)) return;
    changes.push({
      section,
      field,
      path: basePath,
      expIndex,
      bulletIndex: idx,
      itemName: bullet.substring(0, 50) + (bullet.length > 50 ? '...' : ''),
      changeType: 'removed',
      itemValue: bullet,
      beforeValue: bullet,
      change: `Responsabilité retirée de "${expTitle}"`,
      reason: 'Non pertinente pour le poste ciblé',
    });
  });

  return changes;
}

/**
 * Calculer les différences entre deux CVs de manière programmatique
 * Génère un tableau de changements similaire à celui retourné par l'IA
 *
 * @param {Object} currentCv - Contenu CV actuel (après adaptation)
 * @param {Object} previousCv - Contenu CV précédent (source de référence)
 * @returns {Array} Array des changements détectés avec section, field, path, change, reason
 */
export function computeCvDiff(currentCv, previousCv) {
  const changes = [];

  if (!currentCv || !previousCv) {
    return changes;
  }

  // 1. Comparer le résumé
  const currentSummary = currentCv.summary?.description || '';
  const previousSummary = previousCv.summary?.description || '';
  if (valuesAreDifferent(currentSummary, previousSummary)) {
    changes.push({
      section: 'summary',
      field: 'description',
      path: 'summary.description',
      changeType: 'modified',
      beforeValue: previousSummary,
      afterValue: currentSummary,
      change: 'Description du profil adaptée',
      reason: 'Adaptation au poste ciblé',
    });
  }

  // 2. Comparer les compétences techniques
  const hardSkillsChanges = computeArrayItemDiff(
    currentCv.skills?.hard_skills || [],
    previousCv.skills?.hard_skills || [],
    'skills', 'hard_skills', 'skills.hard_skills'
  );
  changes.push(...hardSkillsChanges);

  // 3. Comparer les soft skills
  const softSkillsChanges = computeArrayItemDiff(
    currentCv.skills?.soft_skills || [],
    previousCv.skills?.soft_skills || [],
    'skills', 'soft_skills', 'skills.soft_skills'
  );
  changes.push(...softSkillsChanges);

  // 4. Comparer les outils
  const toolsChanges = computeArrayItemDiff(
    currentCv.skills?.tools || [],
    previousCv.skills?.tools || [],
    'skills', 'tools', 'skills.tools'
  );
  changes.push(...toolsChanges);

  // 5. Comparer les méthodologies
  const methodologiesChanges = computeArrayItemDiff(
    currentCv.skills?.methodologies || [],
    previousCv.skills?.methodologies || [],
    'skills', 'methodologies', 'skills.methodologies'
  );
  changes.push(...methodologiesChanges);

  // 6. Comparer les expériences
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

  // 7. Comparer l'éducation
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

  // 8. Comparer les langues
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

  // 9. Comparer les extras
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
        change: `« ${displayName} » supprimé`,
        reason: 'Non pertinent pour le poste ciblé',
      });
    }
  });

  // 10. Comparer les projets
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
        change: `Projet « ${getProjectDisplayName(proj)} » supprimé`,
        reason: 'Non pertinent pour le poste ciblé',
      });
    }
  });

  // 11. Comparer le header
  const currentHeader = currentCv.header || {};
  const previousHeader = previousCv.header || {};

  if (valuesAreDifferent(currentHeader.current_title, previousHeader.current_title)) {
    changes.push({
      section: 'header',
      field: 'current_title',
      path: 'header.current_title',
      change: 'Titre de poste adapté',
      reason: 'Alignement avec le poste ciblé',
    });
  }

  return changes;
}

/**
 * Calculer les diffs détaillés entre le CV actuel et une version précédente
 * Enrichit les changes_made avec les valeurs before/after
 *
 * @param {Object} currentCv - Contenu CV actuel
 * @param {Object} previousCv - Contenu CV précédent (version de référence)
 * @param {Array} changesMade - Array des changements provenant de l'IA
 * @returns {Array} Array enrichi avec id, beforeValue, afterValue, status
 */
export function computeDetailedChanges(currentCv, previousCv, changesMade = []) {
  if (!changesMade || changesMade.length === 0) {
    return [];
  }

  return changesMade.map((change) => {
    const id = change.id || generateChangeId();
    const path = change.path || `${change.section}.${change.field}`;

    // Cas spécial: expérience supprimée
    if (change.changeType === 'experience_removed') {
      const expTitle = change.beforeValue?.title || 'Sans titre';
      return {
        id,
        section: change.section,
        field: change.field,
        path,
        changeType: change.changeType,
        beforeValue: change.beforeValue,
        afterValue: null,
        beforeDisplay: `${expTitle} (${change.beforeValue?.company || 'N/A'})`,
        afterDisplay: '',
        change: change.change || `Expérience « ${expTitle} » supprimée`,
        reason: change.reason || 'Non pertinente pour le poste ciblé',
        status: 'pending',
        reviewedAt: null,
      };
    }

    // Cas spécial: expérience déplacée vers projets
    if (change.changeType === 'move_to_projects') {
      const expTitle = change.beforeValue?.title || 'Sans titre';
      const projectName = change.projectData?.name || expTitle;
      return {
        id,
        section: change.section,
        field: change.field,
        path,
        changeType: change.changeType,
        beforeValue: change.beforeValue,
        afterValue: null,
        projectData: change.projectData,
        beforeDisplay: `Expérience: ${expTitle}`,
        afterDisplay: `Projet: ${projectName}`,
        change: change.change || `Expérience "${expTitle}" transférée vers Projets`,
        reason: change.reason || 'Projet personnel pertinent pour le poste',
        status: 'pending',
        reviewedAt: null,
      };
    }

    // Obtenir les valeurs before/after depuis le CV si non fournies
    let beforeValue = change.beforeValue;
    let afterValue = change.afterValue;

    if (beforeValue === undefined) {
      beforeValue = getValueAtPath(previousCv, path);
    }
    if (afterValue === undefined) {
      afterValue = getValueAtPath(currentCv, path);
    }

    // Formatter pour l'affichage
    const { beforeDisplay, afterDisplay } = formatValueForDisplay(beforeValue, afterValue);

    return {
      id,
      section: change.section,
      field: change.field,
      path,
      itemName: change.itemName,
      expIndex: change.expIndex,
      bulletIndex: change.bulletIndex,
      itemValue: change.itemValue,
      changeType: change.changeType || 'modified',
      beforeValue,
      afterValue,
      beforeDisplay: change.beforeDisplay || beforeDisplay,
      afterDisplay: change.afterDisplay || afterDisplay,
      change: change.change || '',
      reason: change.reason || '',
      status: change.status || 'pending',
      reviewedAt: null,
    };
  });
}
