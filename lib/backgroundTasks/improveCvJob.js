import pLimit from 'p-limit';
import prisma from "@/lib/prisma";
import { readUserCvFile, writeUserCvFile } from "@/lib/cv/storage";
import { createCvVersionWithTracking } from "@/lib/cv/versioning";
import { initializeReviewState, computeCvDiff } from "@/lib/cv/changeTracking";
import { enqueueJob } from "@/lib/backgroundTasks/jobQueue";
import { registerAbortController, clearRegisteredProcess } from "@/lib/backgroundTasks/processRegistry";
import { updateBackgroundTask, updateCvFile, createCvFile } from "@/lib/events/prismaWithEvents";
import { trackCvOptimization } from "@/lib/telemetry/server";
import { refundFeatureUsage } from "@/lib/subscription/featureUsage";
import dbEmitter from "@/lib/events/dbEmitter";

// Rate limit: max 5 appels OpenAI concurrents au Stage 3
const limit = pLimit(5);

/**
 * Applique les modifications DIFF à une section du CV (experience ou projects)
 * @param {Array} originalSection - Section originale du CV
 * @param {Object} modifications - Objet {updates: [...]} avec les modifications DIFF
 * @returns {Array} - Section modifiée
 */
function applyDiffModifications(originalSection, modifications) {
  if (!modifications?.updates || !Array.isArray(modifications.updates)) {
    return originalSection;
  }

  // Créer une copie profonde de la section originale
  const modifiedSection = JSON.parse(JSON.stringify(originalSection));

  for (const update of modifications.updates) {
    const { index, changes } = update;

    // Vérifier que l'index est valide
    if (index < 0 || index >= modifiedSection.length) {
      console.warn(`[applyDiffModifications] Index ${index} hors limites (0-${modifiedSection.length - 1})`);
      continue;
    }

    const item = modifiedSection[index];

    // Appliquer les changements pour chaque champ
    for (const [field, value] of Object.entries(changes)) {
      if (typeof value === 'string') {
        // Remplacement direct (title, description, role, summary, name)
        item[field] = value;
      } else if (typeof value === 'object' && value !== null) {
        // Format DIFF avec add/remove/update
        applyFieldDiff(item, field, value);
      }
    }
  }

  return modifiedSection;
}

/**
 * Applique un diff (add/remove/update) à un champ spécifique
 * @param {Object} item - L'élément (experience ou project)
 * @param {string} field - Le nom du champ (responsibilities, deliverables, skills_used, tech_stack)
 * @param {Object} diff - Objet {add: [], remove: [], update: []}
 */
function applyFieldDiff(item, field, diff) {
  // S'assurer que le champ existe comme array
  if (!Array.isArray(item[field])) {
    item[field] = [];
  }

  // Appliquer les suppressions d'abord
  if (Array.isArray(diff.remove)) {
    for (const toRemove of diff.remove) {
      const idx = item[field].findIndex(v =>
        typeof v === 'string'
          ? v.toLowerCase() === toRemove.toLowerCase()
          : (v.name || v).toLowerCase() === toRemove.toLowerCase()
      );
      if (idx !== -1) {
        item[field].splice(idx, 1);
      }
    }
  }

  // Appliquer les mises à jour (par index)
  if (Array.isArray(diff.update)) {
    for (const upd of diff.update) {
      if (typeof upd.index === 'number' && upd.index >= 0 && upd.index < item[field].length) {
        item[field][upd.index] = upd.value;
      }
    }
  }

  // Appliquer les ajouts
  if (Array.isArray(diff.add)) {
    for (const toAdd of diff.add) {
      // Éviter les doublons
      const exists = item[field].some(v =>
        typeof v === 'string'
          ? v.toLowerCase() === toAdd.toLowerCase()
          : (v.name || v).toLowerCase() === toAdd.toLowerCase()
      );
      if (!exists) {
        item[field].push(toAdd);
      }
    }
  }
}

/**
 * Applique les modifications DIFF au summary du CV
 * @param {Object} originalSummary - Summary original du CV
 * @param {Object} modifications - Objet avec les modifications DIFF pour le summary
 * @returns {Object} - Summary modifié
 */
function applySummaryDiff(originalSummary, modifications) {
  if (!modifications) {
    return originalSummary;
  }

  // Créer une copie profonde du summary original
  const modifiedSummary = JSON.parse(JSON.stringify(originalSummary || {}));

  // Appliquer le changement de description si présent
  if (modifications.description && typeof modifications.description === 'string') {
    modifiedSummary.description = modifications.description;
  }

  return modifiedSummary;
}

/**
 * Applique un diff (add/remove/reorder) à un array de strings
 * @param {Array} originalArray - Array original
 * @param {Object} diff - Objet {add: [], remove: [], reorder: []}
 * @returns {Array} - Array modifié
 */
function applyArrayDiff(originalArray, diff) {
  let result = [...originalArray];

  // Si reorder est fourni, utiliser cet ordre comme base
  if (Array.isArray(diff.reorder) && diff.reorder.length > 0) {
    result = diff.reorder;
  } else {
    // Appliquer les suppressions d'abord
    if (Array.isArray(diff.remove)) {
      for (const toRemove of diff.remove) {
        const idx = result.findIndex(v =>
          v.toLowerCase() === toRemove.toLowerCase()
        );
        if (idx !== -1) {
          result.splice(idx, 1);
        }
      }
    }

    // Appliquer les ajouts
    if (Array.isArray(diff.add)) {
      for (const toAdd of diff.add) {
        // Éviter les doublons
        const exists = result.some(v =>
          v.toLowerCase() === toAdd.toLowerCase()
        );
        if (!exists) {
          result.push(toAdd);
        }
      }
    }
  }

  return result;
}

/**
 * Applique les modifications V2 à une expérience
 * @param {Object} experience - L'expérience originale
 * @param {Object} modifications - Les modifications à appliquer
 * @returns {Object} - L'expérience modifiée
 */
function applyExperienceModifications(experience, modifications) {
  const modified = JSON.parse(JSON.stringify(experience));

  if (modifications.description) {
    modified.description = modifications.description;
  }

  if (modifications.responsibilities) {
    applyFieldDiff(modified, 'responsibilities', modifications.responsibilities);
  }

  if (modifications.deliverables) {
    applyFieldDiff(modified, 'deliverables', modifications.deliverables);
  }

  if (modifications.skills_used) {
    applyFieldDiff(modified, 'skills_used', modifications.skills_used);
  }

  return modified;
}

/**
 * Applique les modifications V2 à un projet
 * @param {Object} project - Le projet original (ou null si création)
 * @param {Object} modifications - Les modifications à appliquer
 * @param {boolean} isNew - Si c'est un nouveau projet
 * @returns {Object} - Le projet modifié ou créé
 */
function applyProjectModifications(project, modifications, isNew) {
  if (isNew) {
    // Création d'un nouveau projet
    return {
      name: modifications.name || 'Nouveau projet',
      summary: modifications.summary || '',
      tech_stack: modifications.tech_stack || [],
      role: modifications.role || '',
      start_date: modifications.start_date || null,
      end_date: modifications.end_date || null,
      link: modifications.link || null,
    };
  }

  // Modification d'un projet existant
  const modified = JSON.parse(JSON.stringify(project));

  if (modifications.summary) {
    modified.summary = modifications.summary;
  }

  if (modifications.role) {
    modified.role = modifications.role;
  }

  if (modifications.tech_stack) {
    if (Array.isArray(modifications.tech_stack)) {
      modified.tech_stack = modifications.tech_stack;
    } else {
      applyFieldDiff(modified, 'tech_stack', modifications.tech_stack);
    }
  }

  return modified;
}

// Import dynamique pour éviter de charger les modules lourds au démarrage
async function getImproveCv() {
  const module = await import("@/lib/openai/improveCv");
  return module.improveCv;
}

async function getClassifySkills() {
  const module = await import("@/lib/openai/classifySkills");
  return module.classifySkills;
}

async function getPreprocessSuggestions() {
  const module = await import("@/lib/openai/preprocessSuggestions");
  return module.preprocessSuggestions;
}

async function getImproveExperience() {
  const module = await import("@/lib/openai/improveExperience");
  return module.improveExperience;
}

async function getImproveProject() {
  const module = await import("@/lib/openai/improveProject");
  return module.improveProject;
}

async function getImproveSummary() {
  const module = await import("@/lib/openai/improveSummary");
  return module.improveSummary;
}

async function getImproveLanguages() {
  const module = await import("@/lib/openai/improveLanguages");
  return module;
}

async function getImproveExtras() {
  const module = await import("@/lib/openai/improveExtras");
  return module;
}

export function scheduleImproveCvJob(jobInput) {
  enqueueJob(() => runImproveCvJob(jobInput));
}

/**
 * Pipeline V2 - 4 stages parallélisés
 * @param {Object} params - Paramètres du pipeline
 * @returns {Promise<Object>} - Résultat du pipeline
 */
async function runPipelineV2({
  taskId,
  userId,
  workingCv,
  jobOffer,
  jobOfferContent,
  suggestions,
  missingSkillsToAdd,
  abortController,
}) {
  const stageMetrics = {};
  const allChangesMade = [];
  let improvedExperiences = [];
  let improvedProjects = [];

  // =============================================================
  // STAGE 1 & 2 : Classification skills + Preprocessing (PARALLELE)
  // =============================================================
  console.log(`[improveCvJob] Stage 1 & 2 started`, { taskId });
  const stage1_2Start = Date.now();

  // Émettre progression SSE - étape preprocess (start)
  dbEmitter.emitCvImprovementProgress(userId, {
    taskId,
    stage: 'preprocess',
    step: 'preprocess',
    status: 'running',
  });

  const hasSkillsToAdd = missingSkillsToAdd && missingSkillsToAdd.length > 0;
  const hasSuggestions = suggestions && suggestions.length > 0;

  // Lancer Stage 1 et Stage 2 en parallèle
  const [classificationResult, preprocessResult] = await Promise.all([
    // Stage 1: Classification des skills
    hasSkillsToAdd ? (async () => {
      try {
        if (abortController.signal.aborted) throw new Error('Task cancelled');
        const classifySkills = await getClassifySkills();
        const classification = await classifySkills({
          skills: missingSkillsToAdd,
          signal: abortController.signal,
          userId,
        });
        return { success: true, data: classification };
      } catch (error) {
        console.error(`[improveCvJob] Stage 1 error:`, error);
        if (error.message === 'Task cancelled') throw error;
        return { success: false, error };
      }
    })() : Promise.resolve({ success: true, data: null }),

    // Stage 2: Preprocessing des suggestions (via IA)
    hasSuggestions ? (async () => {
      try {
        if (abortController.signal.aborted) throw new Error('Task cancelled');
        const preprocessSuggestions = await getPreprocessSuggestions();
        const result = await preprocessSuggestions({
          suggestions,
          experiences: workingCv.experience || [],
          projects: workingCv.projects || [],
          languages: workingCv.languages || [],
          extras: workingCv.extras || [],
          jobOffer,
          signal: abortController.signal,
          userId,
        });
        return { success: true, data: result };
      } catch (error) {
        console.error(`[improveCvJob] Stage 2 error:`, error);
        if (error.message === 'Task cancelled') throw error;
        return { success: false, error };
      }
    })() : Promise.resolve({ success: true, data: null }),
  ]);

  stageMetrics.stage1_2 = Date.now() - stage1_2Start;
  console.log(`[improveCvJob] Stage 1 & 2 completed`, { taskId, duration: stageMetrics.stage1_2 });

  // Émettre progression SSE - preprocess terminé
  dbEmitter.emitCvImprovementProgress(userId, {
    taskId,
    stage: 'preprocess',
    step: 'preprocess',
    status: 'completed',
  });

  // Émettre progression SSE - classify_skills terminé
  if (classificationResult.success) {
    dbEmitter.emitCvImprovementProgress(userId, {
      taskId,
      stage: 'classify',
      step: 'classify_skills',
      status: 'completed',
    });
  }

  // Appliquer la classification des skills (résultat Stage 1)
  if (classificationResult.success && classificationResult.data) {
    const classification = classificationResult.data;
    const levelMap = new Map(
      missingSkillsToAdd.map(s => [s.skill.toLowerCase(), s.level])
    );

    if (!workingCv.skills) {
      workingCv.skills = {};
    }

    for (const [category, skillNames] of Object.entries(classification)) {
      if (!skillNames || skillNames.length === 0) continue;

      if (!workingCv.skills[category]) {
        workingCv.skills[category] = [];
      }

      for (const skillName of skillNames) {
        const level = levelMap.get(skillName.toLowerCase()) || 'intermediate';
        const existingIndex = workingCv.skills[category].findIndex(s => {
          const name = typeof s === 'string' ? s : (s.name || s.skill || '');
          return name.toLowerCase() === skillName.toLowerCase();
        });

        if (existingIndex === -1) {
          if (category === 'hard_skills' || category === 'tools') {
            workingCv.skills[category].push({ name: skillName, proficiency: level });
          } else {
            workingCv.skills[category].push(skillName);
          }

          allChangesMade.push({
            section: 'skills',
            field: category,
            itemName: skillName,
            changeType: 'added',
            beforeValue: null,
            afterValue: category === 'hard_skills' || category === 'tools'
              ? JSON.stringify({ name: skillName, proficiency: level })
              : skillName,
            change: `Ajout de ${skillName} (${level})`,
            reason: 'Compétence manquante sélectionnée par l\'utilisateur'
          });
        }
      }
    }
    console.log(`[improveCvJob] ${allChangesMade.length} compétences ajoutées (Stage 1)`);
  }

  // Vérifier annulation
  if (abortController.signal.aborted) {
    throw new Error('Task cancelled');
  }

  // =============================================================
  // STAGE 3 : Amélioration parallèle par expérience/projet
  // =============================================================
  if (!preprocessResult.success || !preprocessResult.data) {
    console.log(`[improveCvJob] Stage 3 skipped - no preprocessing data`);
  } else {
    console.log(`[improveCvJob] Stage 3 started`, { taskId });
    const stage3Start = Date.now();

    const { experienceImprovements, projectImprovements, newProjects, languageImprovements, extrasImprovements } = preprocessResult.data;
    const cvLanguage = workingCv.language || 'fr';

    const totalExperiences = experienceImprovements.length;
    const totalProjects = projectImprovements.length + newProjects.length;
    let completedExperiences = 0;
    let completedProjects = 0;

    // Émettre progression SSE - stage experiences (start)
    if (totalExperiences > 0) {
      dbEmitter.emitCvImprovementProgress(userId, {
        taskId,
        stage: 'experiences',
        step: 'experiences',
        status: 'running',
        current: 0,
        total: totalExperiences,
        itemType: 'experience',
      });
    }

    // Préparer toutes les tâches d'amélioration
    const experienceTasks = experienceImprovements.map(({ index, improvements }, taskIndex) =>
      limit(async () => {
        try {
          if (abortController.signal.aborted) throw new Error('Task cancelled');
          const improveExperience = await getImproveExperience();

          // On prend la première suggestion pour cette expérience (simplification)
          // Dans le futur, on pourrait fusionner plusieurs suggestions
          const suggestion = improvements[0];

          const result = await improveExperience({
            experience: workingCv.experience[index],
            suggestion,
            jobOffer,
            cvLanguage,
            signal: abortController.signal,
            userId,
          });

          // Émettre progression SSE - experience terminée
          completedExperiences++;
          dbEmitter.emitCvImprovementProgress(userId, {
            taskId,
            stage: 'experiences',
            step: 'experiences',
            status: completedExperiences === totalExperiences ? 'completed' : 'running',
            current: completedExperiences,
            total: totalExperiences,
            itemType: 'experience',
          });

          return { success: true, type: 'experience', index, data: result };
        } catch (error) {
          console.error(`[improveCvJob] Stage 3 experience[${index}] error:`, error);
          if (error.message === 'Task cancelled') throw error;
          completedExperiences++;
          return { success: false, type: 'experience', index, error };
        }
      })
    );

    // Émettre progression SSE - stage projects (start)
    if (totalProjects > 0) {
      dbEmitter.emitCvImprovementProgress(userId, {
        taskId,
        stage: 'projects',
        step: 'projects',
        status: 'running',
        current: 0,
        total: totalProjects,
        itemType: 'project',
      });
    }

    const projectTasks = projectImprovements.map(({ index, improvements }) =>
      limit(async () => {
        try {
          if (abortController.signal.aborted) throw new Error('Task cancelled');
          const improveProject = await getImproveProject();
          const suggestion = improvements[0];

          const result = await improveProject({
            project: workingCv.projects[index],
            suggestion,
            jobOffer,
            cvLanguage,
            signal: abortController.signal,
            userId,
          });

          // Émettre progression SSE - project terminé
          completedProjects++;
          dbEmitter.emitCvImprovementProgress(userId, {
            taskId,
            stage: 'projects',
            step: 'projects',
            status: completedProjects === totalProjects ? 'completed' : 'running',
            current: completedProjects,
            total: totalProjects,
            itemType: 'project',
          });

          return { success: true, type: 'project', index, data: result };
        } catch (error) {
          console.error(`[improveCvJob] Stage 3 project[${index}] error:`, error);
          if (error.message === 'Task cancelled') throw error;
          completedProjects++;
          return { success: false, type: 'project', index, error };
        }
      })
    );

    const newProjectTasks = newProjects.map(({ suggestion }, idx) =>
      limit(async () => {
        try {
          if (abortController.signal.aborted) throw new Error('Task cancelled');
          const improveProject = await getImproveProject();

          const result = await improveProject({
            project: null, // Création
            suggestion,
            jobOffer,
            cvLanguage,
            signal: abortController.signal,
            userId,
          });

          // Émettre progression SSE - new project terminé
          completedProjects++;
          dbEmitter.emitCvImprovementProgress(userId, {
            taskId,
            stage: 'projects',
            step: 'projects',
            status: completedProjects === totalProjects ? 'completed' : 'running',
            current: completedProjects,
            total: totalProjects,
            itemType: 'project',
          });

          return { success: true, type: 'newProject', index: idx, data: result };
        } catch (error) {
          console.error(`[improveCvJob] Stage 3 newProject[${idx}] error:`, error);
          if (error.message === 'Task cancelled') throw error;
          completedProjects++;
          return { success: false, type: 'newProject', index: idx, error };
        }
      })
    );

    // Tâche d'optimisation des langues (parallèle avec les autres)
    // On exécute si : il y a des langues ET (suggestions spécifiques OU optimisation auto possible)
    const hasLanguages = workingCv.languages && workingCv.languages.length > 0;
    const hasLanguageSuggestions = languageImprovements && languageImprovements.length > 0;
    const languageTask = (hasLanguages || hasLanguageSuggestions) ? limit(async () => {
      try {
        if (abortController.signal.aborted) throw new Error('Task cancelled');
        const { improveLanguages } = await getImproveLanguages();

        // Extraire toutes les suggestions de languageImprovements
        const allLanguageSuggestions = hasLanguageSuggestions
          ? languageImprovements.flatMap(li => li.improvements || [])
          : [];

        const result = await improveLanguages({
          languages: workingCv.languages || [],
          suggestions: allLanguageSuggestions, // Passer toutes les suggestions
          jobOffer,
          cvLanguage,
          signal: abortController.signal,
          userId,
        });

        return { success: true, type: 'languages', data: result };
      } catch (error) {
        console.error(`[improveCvJob] Stage 3 languages error:`, error);
        if (error.message === 'Task cancelled') throw error;
        return { success: false, type: 'languages', error };
      }
    }) : null;

    // Tâches d'amélioration des extras (certifications, hobbies, etc.)
    const extrasTasks = (extrasImprovements && extrasImprovements.length > 0)
      ? extrasImprovements.map(({ index, improvements }) =>
          limit(async () => {
            try {
              if (abortController.signal.aborted) throw new Error('Task cancelled');
              const { improveExtras } = await getImproveExtras();

              // Prendre la première suggestion pour cet extra
              const suggestion = improvements[0];

              const result = await improveExtras({
                extras: workingCv.extras || [],
                suggestion,
                targetIndex: index, // null si ajout, index si modification
                jobOffer,
                cvLanguage,
                signal: abortController.signal,
                userId,
              });

              return { success: true, type: 'extras', index, data: result };
            } catch (error) {
              console.error(`[improveCvJob] Stage 3 extras[${index}] error:`, error);
              if (error.message === 'Task cancelled') throw error;
              return { success: false, type: 'extras', index, error };
            }
          })
        )
      : [];

    // Exécuter toutes les tâches en parallèle (avec rate limiting)
    const stage3Results = await Promise.all([
      ...experienceTasks,
      ...projectTasks,
      ...newProjectTasks,
      ...(languageTask ? [languageTask] : []),
      ...extrasTasks,
    ]);

    stageMetrics.stage3 = Date.now() - stage3Start;
    const successCount = stage3Results.filter(r => r.success).length;
    const failureCount = stage3Results.filter(r => !r.success).length;
    console.log(`[improveCvJob] Stage 3 completed`, { taskId, duration: stageMetrics.stage3, successCount, failureCount });

    // Appliquer les résultats
    for (const result of stage3Results) {
      if (!result.success) continue;

      if (result.type === 'experience') {
        const modified = applyExperienceModifications(
          workingCv.experience[result.index],
          result.data.modifications
        );
        workingCv.experience[result.index] = modified;
        improvedExperiences.push({
          index: result.index,
          modifications: result.data.modifications,
          reasoning: result.data.reasoning,
        });

        // Tracker les changements
        for (const [field, changes] of Object.entries(result.data.modifications)) {
          if (changes.add) {
            for (const item of changes.add) {
              allChangesMade.push({
                section: 'experience',
                field,
                path: `experience[${result.index}].${field}`,
                expIndex: result.index,
                changeType: 'added',
                itemName: item,
                afterValue: item,
                change: `Ajout: ${item}`,
                reason: result.data.reasoning || 'Amélioration suggérée',
              });
            }
          }
        }
      } else if (result.type === 'project') {
        const modified = applyProjectModifications(
          workingCv.projects[result.index],
          result.data.modifications,
          result.data.isNew
        );
        workingCv.projects[result.index] = modified;
        improvedProjects.push({
          index: result.index,
          modifications: result.data.modifications,
          reasoning: result.data.reasoning,
        });
      } else if (result.type === 'newProject' && result.data.isNew) {
        const newProject = applyProjectModifications(null, result.data.modifications, true);
        if (!workingCv.projects) workingCv.projects = [];
        workingCv.projects.push(newProject);
        improvedProjects.push({
          index: workingCv.projects.length - 1,
          modifications: result.data.modifications,
          reasoning: result.data.reasoning,
          isNew: true,
        });

        allChangesMade.push({
          section: 'projects',
          field: 'project',
          changeType: 'added',
          itemName: newProject.name,
          afterValue: JSON.stringify(newProject),
          change: `Nouveau projet: ${newProject.name}`,
          reason: result.data.reasoning || 'Projet créé à partir des suggestions',
        });
      } else if (result.type === 'languages' && result.data.hasChanges) {
        // Appliquer les modifications de langues
        const { applyLanguageModifications } = await getImproveLanguages();
        const originalLanguages = JSON.stringify(workingCv.languages);
        workingCv.languages = applyLanguageModifications(
          workingCv.languages,
          result.data.modifications
        );

        // Tracker les changements de langues
        if (result.data.modifications.reorder) {
          allChangesMade.push({
            section: 'languages',
            field: 'order',
            path: 'languages',
            changeType: 'reordered',
            beforeValue: originalLanguages,
            afterValue: JSON.stringify(workingCv.languages),
            change: 'Langues réordonnées selon pertinence',
            reason: result.data.reasoning?.changes || 'Optimisation pour l\'offre',
          });
        }
        if (result.data.modifications.levelChanges?.length) {
          for (const levelChange of result.data.modifications.levelChanges) {
            allChangesMade.push({
              section: 'languages',
              field: 'level',
              path: `languages[${levelChange.languageIndex}].level`,
              changeType: 'modified',
              beforeValue: levelChange.oldLevel,
              afterValue: levelChange.newLevel,
              change: `Niveau adapté: ${levelChange.oldLevel} → ${levelChange.newLevel}`,
              reason: result.data.reasoning?.changes || 'Alignement avec l\'offre',
            });
          }
        }
        // Tracker les ajouts de certifications
        if (result.data.modifications.certificationChanges?.length) {
          for (const certChange of result.data.modifications.certificationChanges) {
            const langName = workingCv.languages[certChange.languageIndex]?.name || `Langue ${certChange.languageIndex}`;
            allChangesMade.push({
              section: 'languages',
              field: 'certification',
              path: `languages[${certChange.languageIndex}].certification`,
              changeType: 'added',
              beforeValue: null,
              afterValue: certChange.certification,
              change: `Certification ajoutée: ${certChange.certification} (${langName})`,
              reason: result.data.reasoning?.userSuggestions || result.data.reasoning?.changes || 'Certification ajoutée selon contexte utilisateur',
            });
          }
        }
        // Tracker les nouvelles langues
        if (result.data.modifications.newLanguages?.length) {
          for (const newLang of result.data.modifications.newLanguages) {
            allChangesMade.push({
              section: 'languages',
              field: 'language',
              changeType: 'added',
              beforeValue: null,
              afterValue: JSON.stringify(newLang),
              itemName: newLang.name,
              change: `Nouvelle langue: ${newLang.name} (${newLang.level})`,
              reason: result.data.reasoning?.userSuggestions || result.data.reasoning?.changes || 'Langue ajoutée selon contexte utilisateur',
            });
          }
        }
      } else if (result.type === 'extras' && result.data.hasChanges) {
        // Appliquer les modifications d'extras
        const { applyExtrasModifications } = await getImproveExtras();

        if (!workingCv.extras) {
          workingCv.extras = [];
        }

        workingCv.extras = applyExtrasModifications(workingCv.extras, result.data);

        // Tracker les changements d'extras
        if (result.data.action === 'add' && result.data.newExtra) {
          allChangesMade.push({
            section: 'extras',
            field: 'extra',
            changeType: 'added',
            itemName: result.data.newExtra.name,
            afterValue: JSON.stringify(result.data.newExtra),
            change: `Nouvel extra: ${result.data.newExtra.name}`,
            reason: result.data.reasoning || 'Extra ajouté à partir des suggestions',
          });
        } else if (result.data.action === 'update' && result.data.modifications) {
          allChangesMade.push({
            section: 'extras',
            field: 'extra',
            path: `extras[${result.data.targetIndex}]`,
            changeType: 'modified',
            afterValue: JSON.stringify(result.data.modifications),
            change: `Extra modifié: ${result.data.modifications.name || 'index ' + result.data.targetIndex}`,
            reason: result.data.reasoning || 'Extra modifié à partir des suggestions',
          });
        }
      }
    }
  }

  // Vérifier annulation
  if (abortController.signal.aborted) {
    throw new Error('Task cancelled');
  }

  // =============================================================
  // STAGE 4 : Amélioration du summary + fusion
  // =============================================================
  console.log(`[improveCvJob] Stage 4 started`, { taskId });
  const stage4Start = Date.now();

  // Émettre progression SSE - stage summary (start)
  dbEmitter.emitCvImprovementProgress(userId, {
    taskId,
    stage: 'summary',
    step: 'summary',
    status: 'running',
  });

  // Améliorer le summary si des modifications ont été apportées
  if (improvedExperiences.length > 0 || improvedProjects.length > 0) {
    try {
      const improveSummary = await getImproveSummary();
      const summaryResult = await improveSummary({
        summary: workingCv.summary || {},
        improvedExperiences,
        improvedProjects,
        jobOffer,
        cvLanguage: workingCv.language || 'fr',
        signal: abortController.signal,
        userId,
      });

      if (summaryResult.modifications && Object.keys(summaryResult.modifications).length > 0) {
        workingCv.summary = applySummaryDiff(workingCv.summary || {}, summaryResult.modifications);

        for (const [field, value] of Object.entries(summaryResult.modifications)) {
          if (typeof value === 'string') {
            allChangesMade.push({
              section: 'summary',
              field,
              changeType: 'modified',
              afterValue: value,
              change: `Summary ${field} mis à jour`,
              reason: summaryResult.reasoning || 'Alignement avec les améliorations',
            });
          }
        }
      }
    } catch (summaryError) {
      console.error(`[improveCvJob] Stage 4 summary error:`, summaryError);
      // Ne pas bloquer le pipeline si le summary échoue
    }
  }

  stageMetrics.stage4 = Date.now() - stage4Start;
  console.log(`[improveCvJob] Stage 4 completed`, { taskId, duration: stageMetrics.stage4 });

  // Émettre progression SSE - summary terminé
  dbEmitter.emitCvImprovementProgress(userId, {
    taskId,
    stage: 'summary',
    step: 'summary',
    status: 'completed',
  });

  // Émettre progression SSE - finalize
  dbEmitter.emitCvImprovementProgress(userId, {
    taskId,
    stage: 'finalize',
    step: 'finalize',
    status: 'completed',
  });

  return {
    workingCv,
    allChangesMade,
    stageMetrics,
    improvedExperiences,
    improvedProjects,
  };
}

/**
 * Pipeline Legacy (V1) - pour rétrocompatibilité
 */
async function runLegacyPipeline({
  taskId,
  userId,
  workingCv,
  jobOfferContent,
  suggestions,
  missingSkillsToAdd,
  abortController,
}) {
  const allChangesMade = [];

  // ÉTAPE 1 : Ajouter les skills manquants
  const hasSkillsToAdd = missingSkillsToAdd && missingSkillsToAdd.length > 0;
  const hasSuggestions = suggestions && suggestions.length > 0;

  if (hasSkillsToAdd) {
    console.log(`[improveCvJob] Legacy: Ajout de ${missingSkillsToAdd.length} compétences manquantes...`);

    if (abortController.signal.aborted) throw new Error('Task cancelled');

    const classifySkills = await getClassifySkills();
    const classification = await classifySkills({
      skills: missingSkillsToAdd,
      signal: abortController.signal,
      userId,
    });

    const levelMap = new Map(
      missingSkillsToAdd.map(s => [s.skill.toLowerCase(), s.level])
    );

    if (!workingCv.skills) {
      workingCv.skills = {};
    }

    for (const [category, skillNames] of Object.entries(classification)) {
      if (!skillNames || skillNames.length === 0) continue;

      if (!workingCv.skills[category]) {
        workingCv.skills[category] = [];
      }

      for (const skillName of skillNames) {
        const level = levelMap.get(skillName.toLowerCase()) || 'intermediate';
        const existingIndex = workingCv.skills[category].findIndex(s => {
          const name = typeof s === 'string' ? s : (s.name || s.skill || '');
          return name.toLowerCase() === skillName.toLowerCase();
        });

        if (existingIndex === -1) {
          if (category === 'hard_skills' || category === 'tools') {
            workingCv.skills[category].push({ name: skillName, proficiency: level });
          } else {
            workingCv.skills[category].push(skillName);
          }

          allChangesMade.push({
            section: 'skills',
            field: category,
            itemName: skillName,
            changeType: 'added',
            beforeValue: null,
            afterValue: category === 'hard_skills' || category === 'tools'
              ? JSON.stringify({ name: skillName, proficiency: level })
              : skillName,
            change: `Ajout de ${skillName} (${level})`,
            reason: 'Compétence manquante sélectionnée par l\'utilisateur'
          });
        }
      }
    }
    console.log(`[improveCvJob] Legacy: ${allChangesMade.length} compétences ajoutées`);
  }

  // ÉTAPE 2 : Appeler OpenAI pour les suggestions
  let result = { reasoning: null, modifications: {}, changesMade: [] };

  if (hasSuggestions) {
    if (abortController.signal.aborted) throw new Error('Task cancelled');

    const cvLanguage = workingCv.language || 'fr';
    const improveCv = await getImproveCv();
    result = await improveCv({
      summary: workingCv.summary || {},
      experience: workingCv.experience || [],
      projects: workingCv.projects || [],
      jobOfferContent,
      suggestions,
      cvLanguage,
      signal: abortController.signal,
      userId,
    });

    console.log(`[improveCvJob] Legacy: Amélioration terminée - ${result.changesMade?.length || 0} modifications`);
  }

  // Appliquer les modifications DIFF
  const modifications = result.modifications || {};

  if (modifications.experience) {
    workingCv.experience = applyDiffModifications(workingCv.experience || [], modifications.experience);
  }

  if (modifications.projects) {
    workingCv.projects = applyDiffModifications(workingCv.projects || [], modifications.projects);
  }

  if (modifications.summary) {
    workingCv.summary = applySummaryDiff(workingCv.summary || {}, modifications.summary);
  }

  return {
    workingCv,
    allChangesMade: [...allChangesMade, ...(result.changesMade || [])],
  };
}

export async function runImproveCvJob({
  taskId,
  user,
  cvFile,
  jobOfferContent,
  jobOfferUrl,
  currentScore,
  suggestions,
  missingSkillsToAdd = [],
  replaceExisting = false,
  deviceId,
  pipelineVersion, // Nouveau: 2 pour V2, undefined pour legacy
}) {
  const userId = user.id;
  const startTime = Date.now();

  console.log(`[improveCvJob] starting job ${taskId} for user ${userId}, CV: ${cvFile}, version: ${pipelineVersion || 'legacy'}`);

  const abortController = new AbortController();
  registerAbortController(taskId, abortController);

  let shouldStop = false;
  abortController.signal.addEventListener('abort', () => {
    console.log(`[improveCvJob] Signal abort reçu pour ${taskId}`);
    shouldStop = true;
  });

  try {
    const record = await prisma.backgroundTask.findUnique({ where: { id: taskId } });
    if (!record || record.status === 'cancelled') {
      console.log(`[improveCvJob] Tâche ${taskId} déjà annulée`);
      await updateCvFile(userId, cvFile, { optimiseStatus: 'idle', optimiseUpdatedAt: new Date() }).catch(() => {});
      clearRegisteredProcess(taskId);
      return;
    }
  } catch (error) {
    console.warn(`Impossible de vérifier la tâche ${taskId} avant démarrage`, error);
  }

  if (shouldStop) {
    await updateCvFile(userId, cvFile, { optimiseStatus: 'idle', optimiseUpdatedAt: new Date() }).catch(() => {});
    clearRegisteredProcess(taskId);
    return;
  }

  await updateBackgroundTask(taskId, userId, {
    status: 'running',
    error: null,
    deviceId,
  });

  await updateCvFile(userId, cvFile, { optimiseStatus: 'inprogress' }).catch(err =>
    console.error(`[improveCvJob] Impossible de mettre à jour le status du CV:`, err)
  );

  if (shouldStop || abortController.signal.aborted) {
    await updateBackgroundTask(taskId, userId, { status: 'cancelled', result: null, error: null });
    await updateCvFile(userId, cvFile, { optimiseStatus: 'idle', optimiseUpdatedAt: new Date() }).catch(() => {});
    clearRegisteredProcess(taskId);
    return;
  }

  // Lire le CV
  let cvContent;
  try {
    cvContent = await readUserCvFile(userId, cvFile);
    console.log(`[improveCvJob] CV lu avec succès, taille: ${cvContent.length} caractères`);
  } catch (error) {
    console.error(`[improveCvJob] Impossible de lire le CV ${cvFile}:`, error);
    await updateBackgroundTask(taskId, userId, { status: 'failed', result: null, error: `CV '${cvFile}' introuvable` });
    await updateCvFile(userId, cvFile, { optimiseStatus: 'failed' }).catch(() => {});
    clearRegisteredProcess(taskId);
    return;
  }

  try {
    const originalCv = JSON.parse(cvContent);
    let workingCv = JSON.parse(cvContent);
    let allChangesMade = [];
    let stageMetrics = {};

    // Détecter le format du payload et router vers le bon pipeline
    // V2 est maintenant la valeur par défaut (sauf si explicitement pipelineVersion=1)
    const isV2 = pipelineVersion !== 1;

    if (isV2) {
      console.log(`[improveCvJob] Using Pipeline V2 (4 stages)`);

      // Parser le jobOffer si c'est une string
      let jobOffer = null;
      if (jobOfferContent) {
        try {
          jobOffer = typeof jobOfferContent === 'string' ? JSON.parse(jobOfferContent) : jobOfferContent;
        } catch {
          jobOffer = { content: jobOfferContent }; // Fallback si pas JSON
        }
      }

      const pipelineResult = await runPipelineV2({
        taskId,
        userId,
        workingCv,
        jobOffer,
        jobOfferContent,
        suggestions,
        missingSkillsToAdd,
        abortController,
      });

      workingCv = pipelineResult.workingCv;
      allChangesMade = pipelineResult.allChangesMade;
      stageMetrics = pipelineResult.stageMetrics;
    } else {
      console.log(`[improveCvJob] Using Legacy Pipeline (V1)`);

      const legacyResult = await runLegacyPipeline({
        taskId,
        userId,
        workingCv,
        jobOfferContent,
        suggestions,
        missingSkillsToAdd,
        abortController,
      });

      workingCv = legacyResult.workingCv;
      allChangesMade = legacyResult.allChangesMade;
    }

    // Vérifier annulation avant sauvegarde
    const taskCheck = await prisma.backgroundTask.findUnique({
      where: { id: taskId },
      select: { status: true }
    });

    if (!taskCheck || taskCheck.status === 'cancelled') {
      console.log(`[improveCvJob] Tâche ${taskId} annulée avant sauvegarde - abandon`);
      await updateCvFile(userId, cvFile, { optimiseStatus: 'idle', optimiseUpdatedAt: new Date() }).catch(() => {});
      clearRegisteredProcess(taskId);
      return;
    }

    // Déterminer le nom de fichier
    let improvedFilename;
    if (replaceExisting) {
      improvedFilename = cvFile;
    } else {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      improvedFilename = `improved_${timestamp}.json`;
    }

    const improvedCv = workingCv;

    // Calculer les différences programmatiques
    const programmaticChanges = computeCvDiff(improvedCv, originalCv);
    console.log(`[improveCvJob] computeCvDiff a détecté ${programmaticChanges.length} changement(s)`);

    let changesMade;
    if (programmaticChanges.length > 0) {
      changesMade = programmaticChanges;
    } else if (allChangesMade.length > 0) {
      changesMade = allChangesMade;
    } else {
      changesMade = [{
        section: "cv",
        field: "content",
        change: "CV optimisé pour l'offre d'emploi",
        reason: "Amélioration automatique basée sur les sélections"
      }];
    }

    const modifiedSectionNames = [...new Set(changesMade.map(c => c.section))];

    improvedCv.meta = {
      ...improvedCv.meta,
      improved_from: cvFile,
      improved_at: new Date().toISOString(),
      score_before: currentScore,
      changes_count: changesMade.length,
      changes_made: changesMade,
      modified_sections: modifiedSectionNames,
      pipeline_version: isV2 ? 2 : 1,
      stage_metrics: stageMetrics,
    };

    // Sauvegarde
    let createdVersion = null;

    if (replaceExisting) {
      try {
        createdVersion = await createCvVersionWithTracking(userId, cvFile, 'Avant optimisation IA', 'optimization');
        console.log(`[improveCvJob] Version ${createdVersion} créée pour ${cvFile} avant optimisation`);
      } catch (versionError) {
        console.warn(`[improveCvJob] Impossible de créer une version:`, versionError.message);
      }
    }

    await writeUserCvFile(userId, improvedFilename, JSON.stringify(improvedCv, null, 2));
    console.log(`[improveCvJob] CV sauvegardé: ${improvedFilename}`);

    const cvRecord = await prisma.cvFile.findUnique({
      where: { userId_filename: { userId, filename: cvFile } }
    });

    if (replaceExisting) {
      await updateCvFile(userId, improvedFilename, {
        optimiseStatus: 'idle',
        optimiseUpdatedAt: new Date(),
        updatedAt: new Date(),
        scoreBefore: currentScore || null,
      });
    } else {
      await createCvFile({
        userId,
        filename: improvedFilename,
        sourceType: cvRecord?.sourceType || 'link',
        sourceValue: cvRecord?.sourceValue || jobOfferUrl,
        createdBy: 'improve-cv',
        matchScore: null,
        matchScoreUpdatedAt: null,
        scoreBreakdown: null,
        improvementSuggestions: null,
        missingSkills: null,
        matchingSkills: null,
        jobOfferId: cvRecord?.jobOfferId || null,
        optimiseStatus: 'idle',
        optimiseUpdatedAt: new Date(),
        scoreBefore: currentScore || null,
      });
    }

    if (replaceExisting && createdVersion !== null && changesMade.length > 0) {
      try {
        await initializeReviewState(userId, improvedFilename, changesMade, createdVersion - 1);
        console.log(`[improveCvJob] État de review initialisé pour ${improvedFilename}`);
      } catch (reviewError) {
        console.warn(`[improveCvJob] Impossible d'initialiser l'état de review:`, reviewError.message);
      }
    }

    // Vérifier avant completion
    const taskBeforeCompletion = await prisma.backgroundTask.findUnique({
      where: { id: taskId },
      select: { status: true }
    });

    if (!taskBeforeCompletion || taskBeforeCompletion.status === 'cancelled') {
      console.log(`[improveCvJob] Tâche ${taskId} annulée avant completion - abandon`);
      await updateCvFile(userId, cvFile, { optimiseStatus: 'idle', optimiseUpdatedAt: new Date() }).catch(() => {});
      clearRegisteredProcess(taskId);
      return;
    }

    clearRegisteredProcess(taskId);

    const changesCount = changesMade.length;
    const successMessage = replaceExisting
      ? `CV remplacé avec ${changesCount} amélioration${changesCount > 1 ? 's' : ''}`
      : `CV amélioré avec ${changesCount} modification${changesCount > 1 ? 's' : ''}`;

    const duration = Date.now() - startTime;
    try {
      await trackCvOptimization({
        userId,
        deviceId: deviceId || null,
        changesCount,
        sectionsModified: modifiedSectionNames,
        duration,
        status: 'success',
      });
    } catch (trackError) {
      console.error('[improveCvJob] Erreur tracking télémétrie:', trackError);
    }

    await updateBackgroundTask(taskId, userId, {
      status: 'completed',
      result: JSON.stringify({
        improvedFile: improvedFilename,
        changesMade: changesMade,
        changesCount,
        replaced: replaceExisting,
        pipelineVersion: isV2 ? 2 : 1,
        stageMetrics,
      }),
      error: null,
      successMessage
    });

    // Émettre événement SSE cv_improvement:completed
    dbEmitter.emitCvImprovementCompleted(userId, {
      taskId,
      changesCount,
      pipelineVersion: isV2 ? 2 : 1,
      stageMetrics,
    });

    await updateCvFile(userId, improvedFilename, {
      scoreBreakdown: null,
      improvementSuggestions: null,
      missingSkills: null,
      matchingSkills: null,
      matchScore: null,
      matchScoreUpdatedAt: null,
    });
    console.log(`[improveCvJob] ✅ Données d'analyse et score supprimés pour forcer recalcul du score`);

    console.log(`[improveCvJob] ✅ Amélioration terminée: ${improvedFilename} (Pipeline ${isV2 ? 'V2' : 'Legacy'})`);

  } catch (error) {
    clearRegisteredProcess(taskId);

    if (error.message === 'Task cancelled' || abortController.signal.aborted) {
      console.log(`[improveCvJob] Tâche ${taskId} annulée`);
      await refundFeatureUsage(taskId);
      await updateBackgroundTask(taskId, userId, { status: 'cancelled', result: null, error: null });
      await updateCvFile(userId, cvFile, { optimiseStatus: 'idle', optimiseUpdatedAt: new Date() }).catch(() => {});

      // Émettre événement SSE cv_improvement:failed (cancelled)
      dbEmitter.emitCvImprovementFailed(userId, {
        taskId,
        error: 'Task cancelled',
      });
      return;
    }

    console.error(`[improveCvJob] Erreur pour la tâche ${taskId}:`, error);
    console.error(`[improveCvJob] Stack trace:`, error.stack);

    const isQuotaExceeded = error.message && /insufficient_quota|exceeded your current quota/i.test(error.message);
    const errorMessage = isQuotaExceeded
      ? "Quota OpenAI dépassé. Vérifiez votre facturation."
      : (error.message || 'Échec lors de l\'amélioration du CV');

    const duration = Date.now() - startTime;
    try {
      await trackCvOptimization({
        userId,
        deviceId: deviceId || null,
        changesCount: 0,
        sectionsModified: [],
        duration,
        status: 'error',
        error: errorMessage,
      });
    } catch (trackError) {
      console.error('[improveCvJob] Erreur tracking télémétrie:', trackError);
    }

    await refundFeatureUsage(taskId);
    await updateBackgroundTask(taskId, userId, { status: 'failed', result: null, error: errorMessage });
    await updateCvFile(userId, cvFile, { optimiseStatus: 'failed' }).catch(() => {});

    // Émettre événement SSE cv_improvement:failed
    dbEmitter.emitCvImprovementFailed(userId, {
      taskId,
      error: errorMessage,
    });
  }
}
