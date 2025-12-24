/**
 * Gestion du tracking et review des modifications IA sur les CV
 *
 * Ce module gère :
 * - Le calcul des diffs détaillés entre versions
 * - L'état de review des modifications (pending/accepted/rejected)
 * - Le rollback partiel de modifications individuelles
 */

import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

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
    if (b === null || b === undefined) return false; // Tous deux null/undefined = identiques
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
    // Normaliser: trim + remplacer espaces multiples par un seul
    const normalizeStr = (s) => s.trim().replace(/\s+/g, ' ');
    return normalizeStr(a) !== normalizeStr(b);
  }

  // Cas arrays - comparaison plus robuste
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return true;

    // Trier et comparer pour éviter les faux positifs d'ordre
    // Note: on trie une copie pour ne pas muter les originaux
    try {
      const sortedA = JSON.stringify([...a].sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y))));
      const sortedB = JSON.stringify([...b].sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y))));
      return sortedA !== sortedB;
    } catch {
      // Fallback: comparaison directe si le tri échoue
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
 * Calculer les différences item par item dans un tableau
 * Détecte les ajouts et suppressions individuels
 *
 * @param {Array} currentArr - Tableau actuel
 * @param {Array} previousArr - Tableau précédent
 * @param {string} section - Nom de la section (ex: 'skills')
 * @param {string} field - Nom du champ (ex: 'hard_skills')
 * @param {string} basePath - Chemin de base (ex: 'skills.hard_skills')
 * @returns {Array} Array des changements par item avec changeType 'added' ou 'removed'
 */
function computeArrayItemDiff(currentArr, previousArr, section, field, basePath) {
  const changes = [];

  // Normaliser les noms pour comparaison (insensible à la casse)
  const getName = (item) => {
    if (typeof item === 'string') return item.toLowerCase().trim();
    return (item?.name || item?.label || item?.title || item?.value || '').toLowerCase().trim();
  };

  // Obtenir le nom d'affichage
  const getDisplayName = (item) => {
    if (typeof item === 'string') return item;
    return item?.name || item?.label || item?.title || item?.value || '';
  };

  const previousNames = new Set(previousArr.map(getName).filter(Boolean));
  const currentNames = new Set(currentArr.map(getName).filter(Boolean));

  // Items ajoutés (dans current mais pas dans previous)
  currentArr.forEach((item) => {
    const name = getName(item);
    if (name && !previousNames.has(name)) {
      changes.push({
        section,
        field,
        path: basePath,
        itemName: getDisplayName(item),
        changeType: 'added',
        itemValue: item,
        change: `${getDisplayName(item)} ajouté`,
        reason: 'Compétence pertinente pour le poste',
      });
    }
  });

  // Items supprimés (dans previous mais pas dans current)
  previousArr.forEach((item) => {
    const name = getName(item);
    if (name && !currentNames.has(name)) {
      changes.push({
        section,
        field,
        path: basePath,
        itemName: getDisplayName(item),
        changeType: 'removed',
        itemValue: item,
        change: `${getDisplayName(item)} supprimé`,
        reason: 'Non pertinent pour le poste ciblé',
      });
    }
  });

  return changes;
}

/**
 * Calculer les différences bullet par bullet dans un tableau de strings
 * Utilisé pour responsibilities et deliverables des expériences
 *
 * @param {Array} currentArr - Tableau actuel de strings
 * @param {Array} previousArr - Tableau précédent de strings
 * @param {string} section - Nom de la section (ex: 'experience')
 * @param {string} field - Nom du champ (ex: 'responsibilities')
 * @param {string} basePath - Chemin de base (ex: 'experience[0].responsibilities')
 * @param {number} expIndex - Index de l'expérience
 * @param {string} expTitle - Titre de l'expérience pour le contexte
 * @returns {Array} Array des changements par bullet avec changeType 'added', 'removed', ou 'modified'
 */
function computeBulletDiff(currentArr, previousArr, section, field, basePath, expIndex, expTitle) {
  const changes = [];

  // Normaliser les bullets pour comparaison (lowercase, trim, sans ponctuation finale)
  const normalizeBullet = (bullet) => {
    if (!bullet || typeof bullet !== 'string') return '';
    return bullet.toLowerCase().trim().replace(/[.,:;!?]+$/, '').trim();
  };

  // Extraire les premiers mots significatifs pour identifier un bullet (pour matching partiel)
  const getSignificantStart = (bullet) => {
    if (!bullet || typeof bullet !== 'string') return '';
    const words = bullet.toLowerCase().trim().split(/\s+/).slice(0, 5);
    return words.join(' ');
  };

  const currentNormalized = currentArr.map(normalizeBullet);
  const previousNormalized = previousArr.map(normalizeBullet);
  const previousStarts = previousArr.map(getSignificantStart);
  const currentStarts = currentArr.map(getSignificantStart);

  // Tracking pour éviter les doublons
  const matchedPrevious = new Set();
  const matchedCurrent = new Set();

  // D'abord, chercher les correspondances exactes
  currentArr.forEach((bullet, idx) => {
    const normalized = currentNormalized[idx];
    const prevIdx = previousNormalized.findIndex((p, i) => p === normalized && !matchedPrevious.has(i));
    if (prevIdx !== -1) {
      matchedPrevious.add(prevIdx);
      matchedCurrent.add(idx);
    }
  });

  // Ensuite, chercher les correspondances partielles (même début)
  currentArr.forEach((bullet, idx) => {
    if (matchedCurrent.has(idx)) return;
    const start = currentStarts[idx];
    if (!start) return;

    const prevIdx = previousStarts.findIndex((p, i) => p === start && !matchedPrevious.has(i));
    if (prevIdx !== -1) {
      // Bullet modifié - on crée un changement de type 'modified'
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

  // Bullets ajoutés (dans current mais pas matchés)
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
      change: `Nouvelle responsabilité dans "${expTitle}"`,
      reason: 'Ajout pertinent pour le poste ciblé',
    });
  });

  // Bullets supprimés (dans previous mais pas matchés)
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

  // 1. Comparer le résumé (summary.description)
  const currentSummary = currentCv.summary?.description || '';
  const previousSummary = previousCv.summary?.description || '';
  if (valuesAreDifferent(currentSummary, previousSummary)) {
    changes.push({
      section: 'summary',
      field: 'description',
      path: 'summary.description',
      change: 'Description du profil adaptée',
      reason: 'Adaptation au poste ciblé',
    });
  }

  // 2. Comparer les compétences techniques (skills.hard_skills) - ITEM PAR ITEM
  const hardSkillsChanges = computeArrayItemDiff(
    currentCv.skills?.hard_skills || [],
    previousCv.skills?.hard_skills || [],
    'skills', 'hard_skills', 'skills.hard_skills'
  );
  changes.push(...hardSkillsChanges);

  // 3. Comparer les soft skills (skills.soft_skills) - ITEM PAR ITEM
  const softSkillsChanges = computeArrayItemDiff(
    currentCv.skills?.soft_skills || [],
    previousCv.skills?.soft_skills || [],
    'skills', 'soft_skills', 'skills.soft_skills'
  );
  changes.push(...softSkillsChanges);

  // 4. Comparer les outils (skills.tools) - ITEM PAR ITEM
  const toolsChanges = computeArrayItemDiff(
    currentCv.skills?.tools || [],
    previousCv.skills?.tools || [],
    'skills', 'tools', 'skills.tools'
  );
  changes.push(...toolsChanges);

  // 5. Comparer les méthodologies (skills.methodologies) - ITEM PAR ITEM
  const methodologiesChanges = computeArrayItemDiff(
    currentCv.skills?.methodologies || [],
    previousCv.skills?.methodologies || [],
    'skills', 'methodologies', 'skills.methodologies'
  );
  changes.push(...methodologiesChanges)

  // 6. Comparer les expériences (experience) et détecter les move_to_projects
  const currentExperiences = currentCv.experience || [];
  const previousExperiences = previousCv.experience || [];
  const currentProjects = currentCv.projects || [];
  const previousProjects = previousCv.projects || [];

  // Set pour tracker les projets créés par move_to_projects (pour éviter double détection)
  const projectsFromMoveToProjects = new Set();

  // Identifier les projets nouvellement ajoutés (pour détecter move_to_projects)
  const findMatchingNewProject = (exp) => {
    // Chercher un projet ajouté qui correspond à cette expérience
    for (const proj of currentProjects) {
      // Skip si ce projet a déjà été matché avec une autre expérience
      if (projectsFromMoveToProjects.has(proj.name?.toLowerCase())) continue;

      // Vérifier si ce projet existait déjà
      const existedBefore = previousProjects.some(p =>
        p.name?.toLowerCase() === proj.name?.toLowerCase() ||
        p.summary?.toLowerCase() === proj.summary?.toLowerCase()
      );
      if (existedBefore) continue;

      // Vérifier si ce projet correspond à l'expérience
      // Match par: role = title, ou summary contient description/responsibilities
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

  // Comparer chaque expérience par titre/company pour meilleur matching
  // Utilise une comparaison plus flexible (title OU company match)
  const matchExperienceByContent = (exp, expList) => {
    // D'abord essayer un match exact (title ET company)
    let idx = expList.findIndex(e =>
      e.title?.toLowerCase() === exp.title?.toLowerCase() &&
      e.company?.toLowerCase() === exp.company?.toLowerCase()
    );
    if (idx !== -1) return idx;

    // Ensuite essayer un match par title seul (pour les projets perso sans company)
    idx = expList.findIndex(e =>
      e.title?.toLowerCase() === exp.title?.toLowerCase()
    );
    return idx;
  };

  // Détecter les expériences supprimées ou déplacées
  previousExperiences.forEach((previousExp, originalIndex) => {
    const matchedIdx = matchExperienceByContent(previousExp, currentExperiences);

    if (matchedIdx === -1) {
      // Expérience n'existe plus - vérifier si déplacée vers projets
      const matchingProject = findMatchingNewProject(previousExp);

      if (matchingProject) {
        // Expérience déplacée vers projets
        // Tracker ce projet pour ne pas le compter 2 fois
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
        // Expérience supprimée
        changes.push({
          section: 'experience',
          field: `experience[${originalIndex}]`,
          path: `experience[${originalIndex}]`,
          changeType: 'experience_removed',
          change: `Expérience "${previousExp.title || 'Sans titre'}" supprimée`,
          reason: 'Non pertinente pour le poste ciblé',
          beforeValue: previousExp,
        });
      }
    }
  });

  // Détecter les expériences ajoutées (rare mais possible)
  currentExperiences.forEach((currentExp, idx) => {
    const matchedIdx = matchExperienceByContent(currentExp, previousExperiences);
    if (matchedIdx === -1) {
      // Expérience ajoutée (rare pour adaptation)
      changes.push({
        section: 'experience',
        field: `experience[${idx}]`,
        path: `experience[${idx}]`,
        change: `Expérience "${currentExp.title || 'Sans titre'}" ajoutée`,
        reason: 'Pertinente pour le poste ciblé',
      });
    }
  });

  // Détecter les expériences modifiées (présentes dans les deux versions)
  currentExperiences.forEach((currentExp, currentIdx) => {
    const previousIdx = matchExperienceByContent(currentExp, previousExperiences);
    if (previousIdx === -1) return; // Déjà traité comme ajouté

    const previousExp = previousExperiences[previousIdx];
    if (!valuesAreDifferent(currentExp, previousExp)) return; // Pas de changement

    // Expérience modifiée - détailler les champs BULLET PAR BULLET
    const expTitle = currentExp.title || previousExp.title || `Expérience ${currentIdx + 1}`;

    // Vérifier les responsabilités - BULLET PAR BULLET
    const currentResp = currentExp.responsibilities || [];
    const previousResp = previousExp.responsibilities || [];
    if (valuesAreDifferent(currentResp, previousResp)) {
      const respChanges = computeBulletDiff(
        currentResp,
        previousResp,
        'experience',
        'responsibilities',
        `experience[${currentIdx}].responsibilities`,
        currentIdx,
        expTitle
      );
      changes.push(...respChanges);
    }

    // Vérifier les compétences utilisées - ITEM PAR ITEM
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
      // Ajouter l'index de l'expérience à chaque changement
      skillsUsedChanges.forEach(c => { c.expIndex = currentIdx; });
      changes.push(...skillsUsedChanges);
    }

    // Vérifier les livrables - BULLET PAR BULLET
    const currentDel = currentExp.deliverables || [];
    const previousDel = previousExp.deliverables || [];
    if (valuesAreDifferent(currentDel, previousDel)) {
      const delChanges = computeBulletDiff(
        currentDel,
        previousDel,
        'experience',
        'deliverables',
        `experience[${currentIdx}].deliverables`,
        currentIdx,
        expTitle
      );
      // Adapter les messages pour les deliverables
      delChanges.forEach(c => {
        if (c.changeType === 'added') c.change = `Nouveau résultat dans "${expTitle}"`;
        else if (c.changeType === 'removed') c.change = `Résultat retiré de "${expTitle}"`;
        else if (c.changeType === 'modified') c.change = `Résultat modifié dans "${expTitle}"`;
      });
      changes.push(...delChanges);
    }
  });

  // 7. Comparer l'éducation (education)
  const currentEducation = currentCv.education || [];
  const previousEducation = previousCv.education || [];
  if (valuesAreDifferent(currentEducation, previousEducation)) {
    changes.push({
      section: 'education',
      field: 'education',
      path: 'education',
      change: 'Formation adaptée',
      reason: 'Mise en avant des formations pertinentes pour le poste',
    });
  }

  // 8. Comparer les langues (languages)
  const currentLanguages = currentCv.languages || [];
  const previousLanguages = previousCv.languages || [];
  if (valuesAreDifferent(currentLanguages, previousLanguages)) {
    changes.push({
      section: 'languages',
      field: 'languages',
      path: 'languages',
      change: 'Langues adaptées',
      reason: 'Mise en avant des langues pertinentes pour le poste',
    });
  }

  // 9. Comparer les projets (projects) - exclure ceux créés par move_to_projects
  // Filtrer les projets actuels pour ne garder que ceux qui ne viennent pas de move_to_projects
  const currentProjectsFiltered = currentProjects.filter(p =>
    !projectsFromMoveToProjects.has(p.name?.toLowerCase())
  );

  // Comparer uniquement les projets qui ne sont pas issus de move_to_projects
  if (valuesAreDifferent(currentProjectsFiltered, previousProjects)) {
    changes.push({
      section: 'projects',
      field: 'projects',
      path: 'projects',
      change: 'Projets adaptés',
      reason: 'Mise en avant des projets pertinents pour le poste',
    });
  }

  // 10. Comparer le header (nom, titre, etc.)
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

    // Cas spécial: expérience supprimée (changeType: experience_removed)
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
        change: change.change || `Expérience "${expTitle}" supprimée`,
        reason: change.reason || 'Non pertinente pour le poste ciblé',
        status: 'pending',
        reviewedAt: null,
      };
    }

    // Cas spécial: expérience déplacée vers projets (changeType: move_to_projects)
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
        projectData: change.projectData,
        afterValue: change.projectData,
        beforeDisplay: `Expérience: ${expTitle}`,
        afterDisplay: `Projet: ${projectName}`,
        change: change.change || `Transféré vers Projets`,
        reason: change.reason || 'Projet personnel pertinent',
        status: 'pending',
        reviewedAt: null,
      };
    }

    // Cas spécial: changement item-level (avec itemName et changeType)
    if (change.itemName && change.changeType) {
      // Pour les bullets modifiés, on a beforeValue et afterValue
      const isModified = change.changeType === 'modified';
      return {
        id,
        section: change.section,
        field: change.field,
        path,
        itemName: change.itemName,
        changeType: change.changeType,
        itemValue: change.itemValue,
        expIndex: change.expIndex, // Index de l'expérience pour les bullets
        bulletIndex: change.bulletIndex, // Index du bullet dans le tableau
        beforeValue: isModified ? change.beforeValue : (change.changeType === 'removed' ? change.itemValue : null),
        afterValue: isModified ? change.afterValue : (change.changeType === 'added' ? change.itemValue : null),
        beforeDisplay: isModified ? change.beforeValue : (change.changeType === 'removed' ? change.itemName : ''),
        afterDisplay: isModified ? change.afterValue : (change.changeType === 'added' ? change.itemName : ''),
        change: change.change || '',
        reason: change.reason || '',
        status: 'pending',
        reviewedAt: null,
      };
    }

    // Cas standard: changement au niveau du champ entier
    const beforeValue = getValueAtPath(previousCv, path);
    const afterValue = getValueAtPath(currentCv, path);

    // Formatter pour affichage
    const { beforeDisplay, afterDisplay } = formatValueForDisplay(beforeValue, afterValue);

    return {
      id,
      section: change.section,
      field: change.field,
      path,
      changeType: change.changeType, // Préserver le changeType s'il existe
      beforeValue: beforeValue !== undefined ? beforeValue : change.beforeValue,
      afterValue: afterValue !== undefined ? afterValue : null,
      beforeDisplay,
      afterDisplay,
      change: change.change || '',
      reason: change.reason || '',
      status: 'pending', // 'pending' | 'accepted' | 'rejected'
      reviewedAt: null,
    };
  });
}

/**
 * Appliquer un rollback partiel pour une modification rejetée
 * Restaure la valeur du champ depuis la version précédente
 *
 * @param {Object} currentCv - Contenu CV actuel (sera cloné, pas muté)
 * @param {Object} change - Le changement à rejeter (doit contenir path et beforeValue)
 * @returns {Object} Nouveau contenu CV avec la valeur restaurée
 */
export function applyPartialRollback(currentCv, change) {
  if (!currentCv || !change || !change.path) {
    throw new Error('Invalid parameters for partial rollback');
  }

  // Clone profond du CV
  const updatedCv = JSON.parse(JSON.stringify(currentCv));

  // Cas spécial: expérience supprimée (changeType: experience_removed)
  if (change.changeType === 'experience_removed') {
    // Restaurer l'expérience depuis beforeValue
    if (change.beforeValue) {
      if (!updatedCv.experience) {
        updatedCv.experience = [];
      }
      // Ajouter l'expérience à la fin (ou à sa position originale si possible)
      updatedCv.experience.push(change.beforeValue);
      console.log(`[applyPartialRollback] Restored experience: "${change.beforeValue.title}"`);
    }
    return updatedCv;
  }

  // Cas spécial: expérience déplacée vers projets (changeType: move_to_projects)
  if (change.changeType === 'move_to_projects') {
    // 1. Restaurer l'expérience depuis beforeValue
    if (change.beforeValue) {
      if (!updatedCv.experience) {
        updatedCv.experience = [];
      }
      updatedCv.experience.push(change.beforeValue);
      console.log(`[applyPartialRollback] Restored experience from project: "${change.beforeValue.title}"`);
    }

    // 2. Supprimer le projet correspondant
    if (change.projectData && updatedCv.projects) {
      const projectToRemove = change.projectData;
      updatedCv.projects = updatedCv.projects.filter(proj => {
        // Matcher par nom ou role
        const nameMatch = proj.name?.toLowerCase() === projectToRemove.name?.toLowerCase();
        const roleMatch = proj.role?.toLowerCase() === projectToRemove.role?.toLowerCase();
        const summaryMatch = proj.summary?.toLowerCase() === projectToRemove.summary?.toLowerCase();
        return !(nameMatch || (roleMatch && summaryMatch));
      });
      console.log(`[applyPartialRollback] Removed project: "${projectToRemove.name}"`);
    }
    return updatedCv;
  }

  // Cas spécial: changement item-level (avec itemName et changeType)
  if (change.itemName && change.changeType) {
    const currentArray = getValueAtPath(updatedCv, change.path) || [];

    // Normaliser les noms pour comparaison
    const getName = (item) => {
      if (typeof item === 'string') return item.toLowerCase().trim();
      return (item?.name || item?.label || item?.title || item?.value || '').toLowerCase().trim();
    };

    // Pour les bullets, on compare le texte exact ou le début
    const matchesBullet = (item, targetName) => {
      const itemText = typeof item === 'string' ? item : (item?.name || item?.value || '');
      const targetText = targetName || '';
      // Match exact ou par début (premiers 50 chars)
      return itemText.toLowerCase().trim() === targetText.toLowerCase().trim() ||
             itemText.toLowerCase().trim().startsWith(targetText.toLowerCase().trim().substring(0, 50));
    };

    if (change.changeType === 'added') {
      // Item/Bullet ajouté qu'on rejette → le supprimer du tableau
      // Pour les bullets (strings), comparer le texte; pour les skills (objets), comparer le nom
      const filtered = currentArray.filter((item) => {
        if (typeof item === 'string') {
          return !matchesBullet(item, change.afterValue || change.itemValue || change.itemName);
        }
        return getName(item) !== change.itemName.toLowerCase().trim();
      });
      setValueAtPath(updatedCv, change.path, filtered);
    } else if (change.changeType === 'removed') {
      // Item/Bullet supprimé qu'on rejette → le réajouter au tableau
      if (change.itemValue || change.beforeValue) {
        currentArray.push(change.beforeValue || change.itemValue);
        setValueAtPath(updatedCv, change.path, currentArray);
      }
    } else if (change.changeType === 'modified') {
      // Bullet modifié qu'on rejette → restaurer l'ancien texte
      // Trouver le bullet actuel et le remplacer par l'ancien
      const afterText = change.afterValue || '';
      const beforeText = change.beforeValue || '';
      const idx = currentArray.findIndex(item => {
        const text = typeof item === 'string' ? item : (item?.value || '');
        return text.toLowerCase().trim() === afterText.toLowerCase().trim();
      });
      if (idx !== -1 && beforeText) {
        currentArray[idx] = beforeText;
        setValueAtPath(updatedCv, change.path, currentArray);
      }
    }

    return updatedCv;
  }

  // Cas standard: restaurer la valeur précédente
  setValueAtPath(updatedCv, change.path, change.beforeValue);

  return updatedCv;
}

/**
 * Mettre à jour le statut d'un changement dans pendingChanges
 *
 * @param {Array} pendingChanges - Array des changements
 * @param {string} changeId - ID du changement à mettre à jour
 * @param {string} status - Nouveau statut ('accepted' | 'rejected')
 * @returns {Array} Array mis à jour
 */
export function updateChangeStatus(pendingChanges, changeId, status) {
  if (!pendingChanges || !Array.isArray(pendingChanges)) {
    return [];
  }

  return pendingChanges.map((change) => {
    if (change.id === changeId) {
      return {
        ...change,
        status,
        reviewedAt: new Date().toISOString(),
      };
    }
    return change;
  });
}

/**
 * Vérifier si tous les changements ont été reviewés
 *
 * @param {Array} pendingChanges - Array des changements
 * @returns {boolean} true si tous les changements sont accepted ou rejected
 */
export function allChangesReviewed(pendingChanges) {
  if (!pendingChanges || !Array.isArray(pendingChanges) || pendingChanges.length === 0) {
    return true;
  }

  return pendingChanges.every((change) => change.status !== 'pending');
}

/**
 * Calculer la progression de review
 *
 * @param {Array} pendingChanges - Array des changements
 * @returns {Object} { total, reviewed, pending, percentComplete }
 */
export function getReviewProgress(pendingChanges) {
  if (!pendingChanges || !Array.isArray(pendingChanges)) {
    return { total: 0, reviewed: 0, pending: 0, percentComplete: 100 };
  }

  const total = pendingChanges.length;
  const reviewed = pendingChanges.filter((c) => c.status !== 'pending').length;
  const pending = total - reviewed;
  const percentComplete = total > 0 ? Math.round((reviewed / total) * 100) : 100;

  return { total, reviewed, pending, percentComplete };
}

/**
 * Nettoyer l'état de review après que tous les changements ont été traités
 *
 * @param {string} cvFileId - ID du CvFile
 * @returns {Promise<void>}
 */
export async function clearReviewState(cvFileId) {
  await prisma.cvFile.update({
    where: { id: cvFileId },
    data: {
      pendingChanges: null,
      pendingSourceVersion: null,
    },
  });
}

/**
 * Initialiser l'état de review après une modification IA
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} filename - Nom du fichier CV
 * @param {Array} changesMade - Changements de l'IA
 * @param {number} sourceVersion - Version à comparer
 * @returns {Promise<Array>} Les changements détaillés initialisés
 */
export async function initializeReviewState(userId, filename, changesMade, sourceVersion) {
  console.log(`[initializeReviewState] Starting for ${filename}, sourceVersion=${sourceVersion}, changesMade=${changesMade?.length || 0}`);

  const cvFile = await prisma.cvFile.findUnique({
    where: { userId_filename: { userId, filename } },
    select: { id: true, content: true },
  });

  if (!cvFile) {
    throw new Error(`CV not found: ${filename}`);
  }

  console.log(`[initializeReviewState] CvFile found: ${cvFile.id}`);

  // Récupérer le contenu de la version source
  const sourceVersionRecord = await prisma.cvVersion.findFirst({
    where: {
      cvFileId: cvFile.id,
      version: sourceVersion,
    },
    select: { content: true },
  });

  console.log(`[initializeReviewState] Source version ${sourceVersion} found: ${!!sourceVersionRecord}`);

  const previousContent = sourceVersionRecord?.content || {};

  // Calculer les diffs détaillés
  const detailedChanges = computeDetailedChanges(
    cvFile.content,
    previousContent,
    changesMade
  );

  console.log(`[initializeReviewState] Computed ${detailedChanges.length} detailed changes`);

  // Sauvegarder l'état de review
  await prisma.cvFile.update({
    where: { id: cvFile.id },
    data: {
      pendingChanges: detailedChanges,
      pendingSourceVersion: sourceVersion,
    },
  });

  console.log(`[initializeReviewState] Review state saved to DB`);

  return detailedChanges;
}

/**
 * Récupérer l'état de review actuel d'un CV
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} filename - Nom du fichier CV
 * @returns {Promise<Object|null>} { pendingChanges, pendingSourceVersion, progress }
 */
export async function getReviewState(userId, filename) {
  const cvFile = await prisma.cvFile.findUnique({
    where: { userId_filename: { userId, filename } },
    select: {
      pendingChanges: true,
      pendingSourceVersion: true,
    },
  });

  if (!cvFile || !cvFile.pendingChanges) {
    return null;
  }

  const pendingChanges = cvFile.pendingChanges;
  const progress = getReviewProgress(pendingChanges);

  return {
    pendingChanges,
    pendingSourceVersion: cvFile.pendingSourceVersion,
    progress,
  };
}

/**
 * Traiter une action de review (accept ou reject)
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} filename - Nom du fichier CV
 * @param {string} changeId - ID du changement
 * @param {string} action - 'accept' | 'reject'
 * @returns {Promise<Object>} { success, updatedChanges, cvUpdated, allReviewed }
 */
export async function processReviewAction(userId, filename, changeId, action) {
  if (!['accept', 'reject'].includes(action)) {
    throw new Error(`Invalid action: ${action}. Must be 'accept' or 'reject'`);
  }

  const cvFile = await prisma.cvFile.findUnique({
    where: { userId_filename: { userId, filename } },
    select: {
      id: true,
      content: true,
      pendingChanges: true,
      pendingSourceVersion: true,
    },
  });

  if (!cvFile || !cvFile.pendingChanges) {
    throw new Error(`No pending changes for CV: ${filename}`);
  }

  const pendingChanges = cvFile.pendingChanges;
  const change = pendingChanges.find((c) => c.id === changeId);

  if (!change) {
    throw new Error(`Change not found: ${changeId}`);
  }

  let updatedCv = cvFile.content;
  let cvUpdated = false;

  // Si reject, appliquer le rollback partiel
  if (action === 'reject') {
    updatedCv = applyPartialRollback(cvFile.content, change);
    cvUpdated = true;
  }

  // Mettre à jour le statut
  const updatedChanges = updateChangeStatus(pendingChanges, changeId, action === 'accept' ? 'accepted' : 'rejected');
  const allReviewed = allChangesReviewed(updatedChanges);

  // Mettre à jour la base de données
  const updateData = {
    pendingChanges: allReviewed ? null : updatedChanges,
    pendingSourceVersion: allReviewed ? null : cvFile.pendingSourceVersion,
  };

  if (cvUpdated) {
    updateData.content = updatedCv;
  }

  await prisma.cvFile.update({
    where: { id: cvFile.id },
    data: updateData,
  });

  return {
    success: true,
    updatedChanges: allReviewed ? [] : updatedChanges,
    cvUpdated,
    allReviewed,
    progress: getReviewProgress(allReviewed ? [] : updatedChanges),
  };
}

/**
 * Traiter plusieurs actions de review en batch (une seule opération DB)
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} filename - Nom du fichier CV
 * @param {string[]} changeIds - IDs des changements à traiter
 * @param {string} action - 'accept' | 'reject'
 * @returns {Promise<Object>} { success, updatedChanges, cvUpdated, allReviewed, processedCount }
 */
export async function processBatchReviewAction(userId, filename, changeIds, action) {
  if (!['accept', 'reject'].includes(action)) {
    throw new Error(`Invalid action: ${action}. Must be 'accept' or 'reject'`);
  }

  if (!changeIds || !Array.isArray(changeIds) || changeIds.length === 0) {
    throw new Error('No change IDs provided');
  }

  const cvFile = await prisma.cvFile.findUnique({
    where: { userId_filename: { userId, filename } },
    select: {
      id: true,
      content: true,
      pendingChanges: true,
      pendingSourceVersion: true,
    },
  });

  if (!cvFile || !cvFile.pendingChanges) {
    throw new Error(`No pending changes for CV: ${filename}`);
  }

  let pendingChanges = [...cvFile.pendingChanges];
  let updatedCv = JSON.parse(JSON.stringify(cvFile.content)); // Deep clone
  let cvUpdated = false;
  let processedCount = 0;

  // Traiter tous les changements
  for (const changeId of changeIds) {
    const change = pendingChanges.find((c) => c.id === changeId);
    if (!change) {
      console.warn(`[processBatchReviewAction] Change not found: ${changeId}, skipping`);
      continue;
    }

    // Si reject, appliquer le rollback partiel
    if (action === 'reject') {
      try {
        updatedCv = applyPartialRollback(updatedCv, change);
        cvUpdated = true;
      } catch (error) {
        console.error(`[processBatchReviewAction] Rollback failed for ${changeId}:`, error);
        // Continuer avec les autres changements
      }
    }

    // Mettre à jour le statut
    pendingChanges = updateChangeStatus(
      pendingChanges,
      changeId,
      action === 'accept' ? 'accepted' : 'rejected'
    );
    processedCount++;
  }

  const allReviewed = allChangesReviewed(pendingChanges);

  // Une seule mise à jour de la base de données
  const updateData = {
    pendingChanges: allReviewed ? null : pendingChanges,
    pendingSourceVersion: allReviewed ? null : cvFile.pendingSourceVersion,
  };

  if (cvUpdated) {
    updateData.content = updatedCv;
  }

  await prisma.cvFile.update({
    where: { id: cvFile.id },
    data: updateData,
  });

  console.log(`[processBatchReviewAction] Processed ${processedCount}/${changeIds.length} changes for ${filename}`);

  return {
    success: true,
    updatedChanges: allReviewed ? [] : pendingChanges,
    cvUpdated,
    allReviewed,
    processedCount,
    progress: getReviewProgress(allReviewed ? [] : pendingChanges),
  };
}
