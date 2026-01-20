/**
 * Pipeline d'amélioration CV - 4 stages parallélisés
 *
 * Ce module contient la logique du pipeline pour l'amélioration des CV.
 * Extrait de improveCvJob.js pour améliorer la maintenabilité.
 */

import pLimit from 'p-limit';
import {
  applySummaryDiff,
  applyExperienceModifications,
  applyProjectModifications
} from '@/lib/cv-core/modifications';
import dbEmitter from '@/lib/events/dbEmitter';

// Rate limit: max 5 appels OpenAI concurrents au Stage 3
const limit = pLimit(5);

// Import dynamique pour éviter de charger les modules lourds au démarrage
async function getClassifySkills() {
  const module = await import('./stages/stage1-classify-skills.js');
  return module.classifySkills;
}

async function getPreprocessSuggestions() {
  const module = await import('./stages/stage2-preprocess.js');
  return module.preprocessSuggestions;
}

async function getImproveExperience() {
  const module = await import('./stages/stage3-improve/improveExperience.js');
  return module.improveExperience;
}

async function getImproveProject() {
  const module = await import('./stages/stage3-improve/improveProject.js');
  return module.improveProject;
}

async function getImproveSummary() {
  const module = await import('./stages/stage4-summary/improveSummary.js');
  return module.improveSummary;
}

async function getImproveLanguages() {
  const module = await import('./stages/stage3-improve/improveLanguages.js');
  return module;
}

async function getImproveExtras() {
  const module = await import('./stages/stage3-improve/improveExtras.js');
  return module;
}

/**
 * Pipeline d'amélioration - 4 stages parallélisés
 * @param {Object} params - Paramètres du pipeline
 * @returns {Promise<Object>} - Résultat du pipeline
 */
export async function runImprovementPipeline({
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
    const hasLanguages = workingCv.languages && workingCv.languages.length > 0;
    const hasLanguageSuggestions = languageImprovements && languageImprovements.length > 0;
    const languageTask = (hasLanguages || hasLanguageSuggestions) ? limit(async () => {
      try {
        if (abortController.signal.aborted) throw new Error('Task cancelled');
        const { improveLanguages } = await getImproveLanguages();

        const allLanguageSuggestions = hasLanguageSuggestions
          ? languageImprovements.flatMap(li => li.improvements || [])
          : [];

        const result = await improveLanguages({
          languages: workingCv.languages || [],
          suggestions: allLanguageSuggestions,
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

    // Tâches d'amélioration des extras
    const extrasTasks = (extrasImprovements && extrasImprovements.length > 0)
      ? extrasImprovements.map(({ index, improvements }) =>
          limit(async () => {
            try {
              if (abortController.signal.aborted) throw new Error('Task cancelled');
              const { improveExtras } = await getImproveExtras();
              const suggestion = improvements[0];

              const result = await improveExtras({
                extras: workingCv.extras || [],
                suggestion,
                targetIndex: index,
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
