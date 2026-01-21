/**
 * Fonctions de calcul de diff entre versions de CV
 *
 * Ce module contient toutes les fonctions pour calculer les différences
 * entre deux versions d'un CV de manière détaillée.
 */

// Import utilities
import {
  generateChangeId,
  getValueAtPath,
  setValueAtPath,
  formatValueForDisplay,
  valuesAreDifferent
} from './utils.js';

// Import array comparison functions
import { computeArrayItemDiff, computeBulletDiff } from './arrays.js';

// Import section comparison functions
import {
  compareExperiences,
  compareEducation,
  compareLanguages,
  compareExtras,
  compareProjects
} from './sections.js';

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
  const { changes: experienceChanges, projectsFromMoveToProjects } = compareExperiences(currentCv, previousCv);
  changes.push(...experienceChanges);

  // 7. Comparer l'éducation
  const educationChanges = compareEducation(currentCv, previousCv);
  changes.push(...educationChanges);

  // 8. Comparer les langues
  const languagesChanges = compareLanguages(currentCv, previousCv);
  changes.push(...languagesChanges);

  // 9. Comparer les extras
  const extrasChanges = compareExtras(currentCv, previousCv);
  changes.push(...extrasChanges);

  // 10. Comparer les projets
  const projectsChanges = compareProjects(currentCv, previousCv, projectsFromMoveToProjects);
  changes.push(...projectsChanges);

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

// Re-export utilities for external use
export {
  generateChangeId,
  getValueAtPath,
  setValueAtPath,
  formatValueForDisplay,
  valuesAreDifferent,
  computeArrayItemDiff,
  computeBulletDiff
};
