/**
 * Phase Batch Experiences - Pipeline CV v2
 *
 * Adapte individuellement chaque experience KEEP:
 * - description: contexte adapte
 * - responsibilities: reformulees avec mots-cles ATS
 * - deliverables: mis en valeur avec chiffres
 * - skills_used: filtres pour pertinence
 *
 * Champs IMMUABLES (conserves depuis l'original):
 * - title, company, location, type, start_date, end_date
 *
 * Utilise le setting `model_cv_batch_experience` pour le modele IA.
 * Cree une CvGenerationSubtask de type `batch_experience` par experience.
 * Parallelise les appels IA avec Promise.all.
 */

import { promises as fs } from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { getOpenAIClient, addTemperatureIfSupported, adjustTokensForReasoningModel } from '@/lib/openai-core/client';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { trackOpenAIUsage, calculateCost } from '@/lib/telemetry/openai';
import { extractJobResponsibilities } from '../utils/cacheContext.js';
import { sanitizeForPostgres } from '../utils/sanitize.js';

// Chemins des fichiers de prompts et schema
const PROMPTS_DIR = path.join(process.cwd(), 'lib/features/cv-adaptation/prompts');
const SCHEMAS_DIR = path.join(process.cwd(), 'lib/features/cv-adaptation/schemas');
const DEBUG_DIR = path.join(process.cwd(), 'logs/experience-debug');

/**
 * Charge un prompt depuis un fichier
 */
async function loadPrompt(filename) {
  const fullPath = path.join(PROMPTS_DIR, filename);
  const content = await fs.readFile(fullPath, 'utf-8');
  return content.trim();
}

/**
 * Charge un schema JSON depuis un fichier
 */
async function loadSchema(filename) {
  const fullPath = path.join(SCHEMAS_DIR, filename);
  const content = await fs.readFile(fullPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Remplace les variables dans un template de prompt
 */
function replaceVariables(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  }
  return result;
}

/**
 * Écrit les prompts et réponse IA dans un fichier de debug
 * @param {number} experienceIndex - Index de l'expérience
 * @param {string} systemPrompt - Prompt système envoyé
 * @param {string} userPrompt - Prompt utilisateur envoyé
 * @param {Object} response - Réponse de l'IA
 * @param {number} duration - Durée de l'appel en ms
 * @param {string} generationTimestamp - Timestamp unique de la génération
 */
async function writeDebugLog(experienceIndex, systemPrompt, userPrompt, response, duration, generationTimestamp) {
  try {
    const generationDir = path.join(DEBUG_DIR, generationTimestamp);
    await fs.mkdir(generationDir, { recursive: true });

    const filename = `experience_${experienceIndex}.md`;
    const filepath = path.join(generationDir, filename);

    const content = `# Debug Experience Batch: Experience ${experienceIndex}
Date: ${new Date().toISOString()}
Duration: ${duration}ms

## System Prompt
\`\`\`
${systemPrompt}
\`\`\`

## User Prompt
\`\`\`
${userPrompt}
\`\`\`

## AI Response
\`\`\`json
${JSON.stringify(response, null, 2)}
\`\`\`
`;

    await fs.writeFile(filepath, content, 'utf-8');
  } catch (err) {
    // Silencieux - pas de log en cas d'erreur
  }
}

/**
 * Filtre les deliverables pour ne garder que ceux contenant un chiffre
 * Regex: doit contenir au moins un chiffre (0-9)
 */
function filterDeliverablesWithNumbers(deliverables) {
  if (!Array.isArray(deliverables)) return [];
  return deliverables.filter(item => {
    if (typeof item !== 'string') return false;
    // Doit contenir au moins un chiffre
    return /\d/.test(item);
  });
}

/**
 * Calcule la duree en annees entre deux dates
 * @param {string} startDate - Date de debut (format YYYY-MM ou YYYY)
 * @param {string} endDate - Date de fin ou "present"/"Present"
 * @returns {number} - Duree en annees (1 decimale)
 */
function calculateYearsInDomain(startDate, endDate) {
  if (!startDate) return 0;

  // Parser la date de debut
  const startParts = startDate.split('-');
  const startYear = parseInt(startParts[0], 10);
  const startMonth = startParts[1] ? parseInt(startParts[1], 10) : 1;

  // Parser la date de fin (ou utiliser aujourd'hui si "present")
  let endYear, endMonth;
  if (!endDate || endDate.toLowerCase() === 'present' || endDate.toLowerCase() === 'aujourd\'hui') {
    const now = new Date();
    endYear = now.getFullYear();
    endMonth = now.getMonth() + 1;
  } else {
    const endParts = endDate.split('-');
    endYear = parseInt(endParts[0], 10);
    endMonth = endParts[1] ? parseInt(endParts[1], 10) : 12;
  }

  // Calculer la difference en mois puis convertir en annees
  const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth);
  const years = Math.max(0.1, totalMonths / 12);

  // Arrondir a 1 decimale
  return Math.round(years * 10) / 10;
}

/**
 * Applique les modifications de l'IA sur l'experience originale
 *
 * Nouveau format v3 - L'IA retourne UNIQUEMENT les modifications:
 * - description: { value, reason } ou null
 * - responsibilities: { value, reason } ou null
 * - deliverables: { value, reason } ou null
 * - skill_changes: [{ before, after, reason }] - uniquement modified/removed
 *
 * On reconstruit skills_used a partir de l'original + skill_changes
 *
 * @param {Object} adaptedExperience - Modifications retournees par l'IA
 * @param {Object} originalExperience - Experience originale (source)
 */
function sanitizeAdaptedExperience(adaptedExperience, originalExperience) {
  if (!adaptedExperience) return adaptedExperience;

  // Champs immuables: conserves depuis l'original
  const immutableFields = {
    title: originalExperience?.title,
    company: originalExperience?.company,
    location: originalExperience?.location,
    type: originalExperience?.type,
    start_date: originalExperience?.start_date,
    end_date: originalExperience?.end_date,
  };

  // Extraire les valeurs des objets { value, reason } ou utiliser l'original si null
  const description = adaptedExperience.description?.value ?? originalExperience?.description;
  const responsibilities = adaptedExperience.responsibilities?.value ?? originalExperience?.responsibilities;
  const deliverables = adaptedExperience.deliverables?.value ?? originalExperience?.deliverables;

  // Reconstruire skills_used a partir de l'original + skill_changes
  const originalSkills = originalExperience?.skills_used || [];
  const skillChanges = adaptedExperience.skill_changes || [];

  // Creer un map des changements: before -> after
  const changesMap = new Map();
  for (const change of skillChanges) {
    changesMap.set(change.before, change.after);
  }

  // Appliquer les changements
  const skills_used = originalSkills
    .map(skill => {
      if (changesMap.has(skill)) {
        const newValue = changesMap.get(skill);
        return newValue; // null si supprime, nouveau nom si modifie
      }
      return skill; // conserve tel quel
    })
    .filter(skill => skill !== null); // retirer les skills supprimes

  return {
    ...immutableFields,
    description,
    responsibilities,
    deliverables: filterDeliverablesWithNumbers(deliverables || []),
    skills_used,
    domain: adaptedExperience.domain,
    years_in_domain: adaptedExperience.years_in_domain,
    // Conserver skill_changes pour le systeme de review
    skill_changes: skillChanges,
    // Conserver les raisons pour le systeme de review
    _description_reason: adaptedExperience.description?.reason || null,
    _responsibilities_reason: adaptedExperience.responsibilities?.reason || null,
    _deliverables_reason: adaptedExperience.deliverables?.reason || null,
  };
}


/**
 * Adapte une seule experience
 *
 * @param {Object} params
 * @param {Object} params.experience - Experience a adapter
 * @param {number} params.experienceIndex - Index de l'experience
 * @param {string} params.sourceLanguage - Langue source du CV
 * @param {string} params.targetLanguage - Langue cible
 * @param {string} params.interfaceLanguage - Langue de l'interface (pour les raisons)
 * @param {string} params.jobResponsibilities - Responsabilites de l'offre formatees
 * @param {string} params.model - Modele IA a utiliser
 * @param {Object} params.systemPrompt - Prompt systeme (avec cache prefix)
 * @param {Object} params.userPromptTemplate - Template du prompt utilisateur
 * @param {Object} params.schema - Schema JSON
 * @param {string} params.offerId - ID de l'offre
 * @param {string} params.userId - ID utilisateur
 * @param {AbortSignal} params.signal - Signal d'annulation
 * @returns {Promise<Object>}
 */
async function adaptSingleExperience({
  experience,
  experienceIndex,
  sourceLanguage,
  targetLanguage,
  interfaceLanguage,
  jobResponsibilities,
  model,
  systemPrompt,
  userPromptTemplate,
  schema,
  offerId,
  userId,
  signal,
  generationTimestamp,
}) {
  const startTime = Date.now();

  // Creer la subtask
  const subtask = await prisma.cvGenerationSubtask.create({
    data: {
      offerId,
      type: 'batch_experience',
      itemIndex: experienceIndex,
      status: 'running',
      input: {
        originalTitle: experience?.title || 'N/A',
        company: experience?.company || 'N/A',
      },
      startedAt: new Date(),
    },
  });

  try {
    // Pre-calculer years_in_domain pour aider l'IA
    const calculatedYears = calculateYearsInDomain(experience.start_date, experience.end_date);

    // Filtrer les champs de l'experience pour n'envoyer que le necessaire a l'IA
    const experienceForAI = {
      title: experience.title,
      description: experience.description,
      responsibilities: experience.responsibilities,
      deliverables: experience.deliverables,
      skills_used: experience.skills_used,
      _classificationReason: experience._classificationReason,
      _calculated_years: calculatedYears,
    };

    // Preparer le prompt utilisateur avec toutes les variables
    const userPrompt = replaceVariables(userPromptTemplate, {
      experienceJson: JSON.stringify(experienceForAI, null, 2),
      sourceLanguage,
      targetLanguage,
      interfaceLanguage,
      jobResponsibilities,
    });

    // Appeler OpenAI
    const client = getOpenAIClient();

    let requestOptions = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: schema,
      },
    };

    // Ajouter temperature uniquement si le modèle le supporte (pas o1/o3/o4/gpt-5)
    requestOptions = addTemperatureIfSupported(requestOptions, 0.3);
    // Ajuster max_completion_tokens pour les modèles de raisonnement
    requestOptions = adjustTokensForReasoningModel(requestOptions, 1500, 16000);

    const fetchOptions = signal ? { signal } : {};
    const response = await client.chat.completions.create(requestOptions, fetchOptions);

    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    const duration = Date.now() - startTime;

    // Parser la reponse
    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    // Parser et sanitizer la reponse (filtre les deliverables sans chiffres + champs immuables)
    const rawExperience = JSON.parse(content);
    const adaptedExperience = sanitizeAdaptedExperience(rawExperience, experience);

    // Écrire le fichier de debug
    await writeDebugLog(experienceIndex, systemPrompt, userPrompt, rawExperience, duration, generationTimestamp);

    // DEBUG: Log des skill_changes retournées par l'IA
    console.log(`[batch-experiences] Experience ${experienceIndex} skill_changes:`, {
      hasSkillChanges: !!adaptedExperience.skill_changes,
      count: adaptedExperience.skill_changes?.length || 0,
      skill_changes: adaptedExperience.skill_changes,
    });

    // Tracker l'usage
    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;
    const cachedTokens = response.usage?.prompt_tokens_details?.cached_tokens || 0;

    // Calculer le coût estimé
    const estimatedCost = await calculateCost({
      model,
      promptTokens,
      completionTokens,
      cachedTokens,
    });

    if (userId) {
      await trackOpenAIUsage({
        userId,
        featureName: 'cv_adaptation_experience',
        model,
        promptTokens,
        completionTokens,
        cachedTokens,
        duration,
      });
    }

    // Nettoyer et mettre a jour la subtask
    const sanitizedOutput = sanitizeForPostgres(adaptedExperience);
    await prisma.cvGenerationSubtask.update({
      where: { id: subtask.id },
      data: {
        status: 'completed',
        output: sanitizedOutput,
        modifications: sanitizedOutput.skill_changes, // Nouveau format: skill_changes
        modelUsed: model,
        promptTokens,
        cachedTokens,
        completionTokens,
        estimatedCost,
        durationMs: duration,
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      experienceIndex,
      adaptedExperience,
      skill_changes: adaptedExperience.skill_changes || [],
      subtaskId: subtask.id,
      duration,
      tokens: { prompt: promptTokens, completion: completionTokens, cached: cachedTokens },
      estimatedCost,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    await prisma.cvGenerationSubtask.update({
      where: { id: subtask.id },
      data: {
        status: 'failed',
        error: error.message,
        durationMs: duration,
        completedAt: new Date(),
      },
    });

    return {
      success: false,
      experienceIndex,
      error: error.message,
      subtaskId: subtask.id,
      duration,
    };
  }
}

/**
 * Execute le batch d'adaptation des experiences
 *
 * @param {Object} params
 * @param {string} params.offerId - ID de la CvGenerationOffer
 * @param {Array} params.experiences - Experiences KEEP a adapter
 * @param {Object} params.jobOffer - Offre d'emploi
 * @param {string} params.sourceLanguage - Langue source du CV (fr, en, es, de)
 * @param {string} params.targetLanguage - Langue cible (fr, en, es, de)
 * @param {string} params.userInterfaceLanguage - Langue de l'interface (pour les raisons)
 * @param {string} params.userId - ID utilisateur
 * @param {AbortSignal} params.signal - Signal d'annulation
 * @returns {Promise<Object>}
 */
export async function executeBatchExperiences({
  offerId,
  experiences,
  jobOffer,
  sourceLanguage = 'francais',
  targetLanguage = 'francais',
  userInterfaceLanguage = 'fr',
  userId,
  signal = null,
}) {
  const startTime = Date.now();

  // Filter out any undefined/null experiences
  const validExperiences = (experiences || []).filter(exp => exp && typeof exp === 'object');

  if (validExperiences.length === 0) {
    console.log('[batch-experiences] No experiences to adapt');
    return {
      success: true,
      adaptedExperiences: [],
      stats: { total: 0, succeeded: 0, failed: 0 },
      duration: 0,
    };
  }

  console.log(`[batch-experiences] Adapting ${validExperiences.length} experience(s)...`);

  // Générer le timestamp de génération pour les logs
  const generationTimestamp = new Date().toISOString().replace(/[:.]/g, '-').split('Z')[0];

  try {
    // Charger le modele, prompts et schema
    const model = await getAiModelSetting('model_cv_batch_experience');
    const systemPrompt = await loadPrompt('batch-experience-system.md');
    const userPromptTemplate = await loadPrompt('batch-experience-user.md');
    const schema = await loadSchema('batchExperienceSchema.json');

    // Extraire les responsabilites de l'offre pour le user prompt
    const jobResponsibilities = extractJobResponsibilities(jobOffer);

    // Convertir la langue interface en nom complet pour le prompt
    const interfaceLanguageMap = { fr: 'francais', en: 'anglais', de: 'allemand', es: 'espagnol' };
    const interfaceLanguage = interfaceLanguageMap[userInterfaceLanguage] || 'francais';

    // Strategie d'execution:
    // 1. Executer la premiere experience pour etablir le cache OpenAI
    // 2. Executer les autres en parallele (beneficient du cache)
    let results = [];

    if (validExperiences.length === 1) {
      // Une seule experience - execution simple
      const result = await adaptSingleExperience({
        experience: validExperiences[0],
        experienceIndex: 0,
        sourceLanguage,
        targetLanguage,
        interfaceLanguage,
        jobResponsibilities,
        model,
        systemPrompt,
        userPromptTemplate,
        schema,
        offerId,
        userId,
        signal,
        generationTimestamp,
      });
      results = [result];
    } else {
      // Plusieurs experiences - strategie cache-first
      // Etape 1: Executer la premiere pour etablir le cache
      const firstResult = await adaptSingleExperience({
        experience: validExperiences[0],
        experienceIndex: 0,
        sourceLanguage,
        targetLanguage,
        interfaceLanguage,
        jobResponsibilities,
        model,
        systemPrompt,
        userPromptTemplate,
        schema,
        offerId,
        userId,
        signal,
        generationTimestamp,
      });

      // Délai pour laisser le cache OpenAI se propager
      await new Promise(resolve => setTimeout(resolve, 500));

      // Etape 2: Executer les autres en parallele (beneficient du cache)
      const remainingResults = await Promise.all(
        validExperiences.slice(1).map((experience, index) =>
          adaptSingleExperience({
            experience,
            experienceIndex: index + 1, // +1 car on a skip la premiere
            sourceLanguage,
            targetLanguage,
            interfaceLanguage,
            jobResponsibilities,
            model,
            systemPrompt,
            userPromptTemplate,
            schema,
            offerId,
            userId,
            signal,
            generationTimestamp,
          })
        )
      );

      results = [firstResult, ...remainingResults];
    }

    const duration = Date.now() - startTime;

    // Compiler les resultats
    const succeeded = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    // Construire le tableau des experiences adaptees (dans l'ordre)
    const adaptedExperiences = results
      .filter(r => r.success)
      .sort((a, b) => a.experienceIndex - b.experienceIndex)
      .map(r => r.adaptedExperience);

    // Collecter les skill_changes par index d'experience
    const skillChanges = {};
    for (const r of results.filter(r => r.success)) {
      if (r.skill_changes && r.skill_changes.length > 0) {
        skillChanges[r.experienceIndex] = {
          skill_changes: r.skill_changes,
        };
      }
    }

    // Calculer les tokens totaux
    const totalTokens = {
      prompt: succeeded.reduce((sum, r) => sum + (r.tokens?.prompt || 0), 0),
      completion: succeeded.reduce((sum, r) => sum + (r.tokens?.completion || 0), 0),
    };

    console.log(`[batch-experiences] Completed in ${duration}ms:`, {
      total: experiences.length,
      succeeded: succeeded.length,
      failed: failed.length,
      totalTokens,
    });

    return {
      success: failed.length === 0,
      adaptedExperiences,
      skillChanges,
      results,
      stats: {
        total: experiences.length,
        succeeded: succeeded.length,
        failed: failed.length,
      },
      tokens: totalTokens,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[batch-experiences] Failed after ${duration}ms:`, error.message);

    return {
      success: false,
      error: error.message,
      adaptedExperiences: [],
      stats: { total: experiences.length, succeeded: 0, failed: experiences.length },
      duration,
    };
  }
}
