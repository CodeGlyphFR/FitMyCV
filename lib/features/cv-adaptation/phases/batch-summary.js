/**
 * Phase Batch Summary - Pipeline CV v2
 *
 * Genere un summary professionnel adapte a l'offre d'emploi:
 * - description: Resume professionnel "Who I am" (2-3 phrases)
 *
 * Utilise le setting `model_cv_batch_summary` pour le modele IA.
 * Cree une CvGenerationSubtask de type `batch_summary`.
 * Execute APRES toutes les autres phases batch (besoin du contexte complet).
 */

import { promises as fs } from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { getOpenAIClient, addTemperatureIfSupported, adjustTokensForReasoningModel, addReasoningEffortIfSupported } from '@/lib/openai-core/client';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { trackOpenAIUsage, calculateCost } from '@/lib/telemetry/openai';
import { generateCacheB, buildCachedSystemPrompt } from '../utils/cacheContext.js';
import { sanitizeForPostgres } from '../utils/sanitize.js';

const PROMPTS_DIR = path.join(process.cwd(), 'lib/features/cv-adaptation/prompts');
const SCHEMAS_DIR = path.join(process.cwd(), 'lib/features/cv-adaptation/schemas');
const DEBUG_DIR = path.join(process.cwd(), 'logs/summary-debug');

async function loadPrompt(filename) {
  const fullPath = path.join(PROMPTS_DIR, filename);
  const content = await fs.readFile(fullPath, 'utf-8');
  return content.trim();
}

async function loadSchema(filename) {
  const fullPath = path.join(SCHEMAS_DIR, filename);
  const content = await fs.readFile(fullPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Écrit les prompts et réponse IA dans un fichier de debug
 * @param {string} systemPrompt - Prompt système envoyé
 * @param {string} userPrompt - Prompt utilisateur envoyé
 * @param {Object} response - Réponse de l'IA
 * @param {number} duration - Durée de l'appel en ms
 * @param {string} generationTimestamp - Timestamp unique de la génération
 */
async function writeDebugLog(systemPrompt, userPrompt, response, duration, generationTimestamp) {
  try {
    const generationDir = path.join(DEBUG_DIR, generationTimestamp);
    await fs.mkdir(generationDir, { recursive: true });

    const filename = 'summary.md';
    const filepath = path.join(generationDir, filename);

    const content = `# Debug Summary Batch
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

function replaceVariables(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  }
  return result;
}

/**
 * Calcule la duree en mois entre deux dates
 */
function calculateDurationMonths(startDate, endDate) {
  if (!startDate) return 0;

  const start = new Date(startDate);
  const end = endDate && endDate !== 'present' && endDate !== ''
    ? new Date(endDate)
    : new Date();

  if (isNaN(start.getTime())) return 0;
  if (isNaN(end.getTime())) return 0;

  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return Math.max(0, months);
}

/**
 * Calcule les durees de chaque experience (uniquement les vraies experiences pro)
 */
function calculateExperienceDurations(experiences) {
  if (!experiences || experiences.length === 0) {
    return { durations: [], totalYears: 0, currentTitles: [] };
  }

  // Filtrer uniquement les vraies experiences professionnelles (avec company renseignee)
  const proExperiences = experiences.filter(exp => exp.company && exp.company.trim() !== '');

  // Calculer la duree de chaque experience
  const durations = proExperiences.map(exp => {
    const months = calculateDurationMonths(exp.start_date, exp.end_date);
    const years = Math.round(months / 12 * 10) / 10; // Arrondi à 1 décimale
    const isCurrent = !exp.end_date || exp.end_date === 'present' || exp.end_date === '';

    return {
      title: exp.title || 'Non spécifié',
      company: exp.company || '',
      months,
      years,
      isCurrent,
    };
  });

  // Trier par duree decroissante
  const sortedByDuration = [...durations].sort((a, b) => b.months - a.months);

  // Calculer le total des annees depuis la 1ere experience pro
  const firstExp = proExperiences.reduce((earliest, exp) => {
    if (!exp.start_date) return earliest;
    const date = new Date(exp.start_date);
    return !earliest || date < earliest ? date : earliest;
  }, null);

  const totalYears = firstExp
    ? Math.round((new Date() - firstExp) / (1000 * 60 * 60 * 24 * 365))
    : 0;

  // Titres des experiences actuelles (dedupliques)
  const currentTitles = [...new Set(durations.filter(d => d.isCurrent).map(d => d.title))];

  return {
    durations: sortedByDuration.map(d => `${d.title} (${d.company}): ${d.years} an${d.years > 1 ? 's' : ''}${d.isCurrent ? ' - en cours' : ''}`),
    totalYears,
    currentTitles,
  };
}

/**
 * Agrege les experiences par domaine et calcule le total d'annees par domaine
 * Utilise les champs domain et years_in_domain fournis par le batch experience
 */
function aggregateExperiencesByDomain(experiences) {
  if (!experiences || experiences.length === 0) {
    return { domainsSummary: '', domainsDetails: [] };
  }

  // Regrouper par domaine
  const domainMap = new Map();

  for (const exp of experiences) {
    const domain = exp.domain || 'Autre';
    const years = exp.years_in_domain || 0;

    if (!domainMap.has(domain)) {
      domainMap.set(domain, { totalYears: 0, experiences: [] });
    }

    const domainData = domainMap.get(domain);
    domainData.totalYears += years;
    domainData.experiences.push({
      title: exp.title,
      company: exp.company,
      years,
    });
  }

  // Trier par nombre d'annees decroissant
  const sortedDomains = [...domainMap.entries()]
    .sort((a, b) => b[1].totalYears - a[1].totalYears);

  // Construire le resume textuel
  const domainsSummary = sortedDomains
    .map(([domain, data]) => {
      const roundedYears = Math.round(data.totalYears * 10) / 10;
      return `- ${domain}: ${roundedYears} an${roundedYears > 1 ? 's' : ''}`;
    })
    .join('\n');

  // Details pour le JSON
  const domainsDetails = sortedDomains.map(([domain, data]) => ({
    domain,
    totalYears: Math.round(data.totalYears * 10) / 10,
    experienceCount: data.experiences.length,
  }));

  return { domainsSummary, domainsDetails };
}

/**
 * Extrait les TOP 5 deliverables avec chiffres pour le summary
 * Priorise les deliverables avec des pourcentages ou chiffres concrets
 * @param {Array} experiences - Experiences adaptees
 * @returns {string} - Liste des top deliverables formatee
 */
function extractTopDeliverables(experiences) {
  if (!experiences || experiences.length === 0) return 'Aucune realisation chiffree disponible';

  const allDeliverables = [];

  for (const exp of experiences) {
    const deliverables = exp.deliverables || [];
    for (const d of deliverables) {
      // Score basé sur la présence de chiffres
      const hasPercent = /%/.test(d);
      const hasNumber = /\d+/.test(d);
      const score = (hasPercent ? 2 : 0) + (hasNumber ? 1 : 0);

      allDeliverables.push({
        text: d,
        context: exp.title || 'Poste',
        score,
      });
    }
  }

  // Trier par score décroissant et prendre les 5 premiers
  const topDeliverables = allDeliverables
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (topDeliverables.length === 0) return 'Aucune realisation chiffree disponible';

  return topDeliverables
    .map(d => `- ${d.text} (${d.context})`)
    .join('\n');
}

/**
 * Extrait les skills pertinents qui matchent l'offre d'emploi
 * @param {Object} adaptedSkills - Skills adaptes du candidat
 * @param {Object} jobOffer - Offre d'emploi
 * @returns {string} - Liste des skills matchant formatee
 */
function extractTopSkills(adaptedSkills, jobOffer) {
  if (!adaptedSkills) return 'Non disponible';

  const jobSkills = jobOffer?.skills || {};
  const required = (jobSkills.required || []).map(s => s.toLowerCase());
  const niceToHave = (jobSkills.nice_to_have || []).map(s => s.toLowerCase());
  const allJobSkills = [...required, ...niceToHave];

  // Collecter tous les skills du candidat
  const candidateSkills = [];

  // Hard skills
  const hardSkills = adaptedSkills.hard_skills || [];
  for (const s of hardSkills) {
    const name = typeof s === 'string' ? s : s.name;
    if (name) candidateSkills.push({ name, type: 'hard_skill' });
  }

  // Tools
  const tools = adaptedSkills.tools || [];
  for (const t of tools) {
    const name = typeof t === 'string' ? t : t.name;
    if (name) candidateSkills.push({ name, type: 'tool' });
  }

  // Soft skills
  const softSkills = adaptedSkills.soft_skills || [];
  for (const s of softSkills) {
    if (s) candidateSkills.push({ name: s, type: 'soft_skill' });
  }

  // Methodologies
  const methodologies = adaptedSkills.methodologies || [];
  for (const m of methodologies) {
    if (m) candidateSkills.push({ name: m, type: 'methodology' });
  }

  // Filtrer et scorer les skills qui matchent
  const matchingSkills = candidateSkills
    .map(skill => {
      const nameLower = skill.name.toLowerCase();
      const isRequired = required.some(r => nameLower.includes(r) || r.includes(nameLower));
      const isNiceToHave = niceToHave.some(n => nameLower.includes(n) || n.includes(nameLower));
      return {
        ...skill,
        score: isRequired ? 2 : (isNiceToHave ? 1 : 0),
      };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  if (matchingSkills.length === 0) {
    // Fallback: retourner les hard skills principaux
    const fallback = candidateSkills
      .filter(s => s.type === 'hard_skill' || s.type === 'tool')
      .slice(0, 5)
      .map(s => s.name);
    return fallback.length > 0 ? fallback.join(', ') : 'Non disponible';
  }

  return matchingSkills.map(s => s.name).join(', ');
}

/**
 * Extrait les mots-cles requis de l'offre d'emploi
 * @param {Object} jobOffer - Offre d'emploi
 * @returns {string} - Liste des mots-cles formatee
 */
function extractJobKeywords(jobOffer) {
  if (!jobOffer) return 'Non specifie';

  const skills = jobOffer.skills || {};
  const required = skills.required || [];
  const niceToHave = skills.nice_to_have || [];

  // Prioriser les required, puis nice_to_have
  const keywords = [...required.slice(0, 6), ...niceToHave.slice(0, 3)];

  return keywords.length > 0 ? keywords.join(', ') : 'Non specifie';
}


/**
 * Execute le batch de generation du summary
 *
 * @param {Object} params
 * @param {string} params.offerId - ID de la CvGenerationOffer
 * @param {Object} params.currentSummary - Summary actuel du CV (peut etre null)
 * @param {Array} params.adaptedExperiences - Experiences deja adaptees
 * @param {Array} params.adaptedProjects - Projets deja adaptes
 * @param {Object} params.adaptedSkills - Skills deja adaptes
 * @param {Array} params.adaptedExtras - Extras deja adaptes
 * @param {Object} params.jobOffer - Offre d'emploi
 * @param {string} params.targetLanguage - Langue cible pour le resume
 * @param {string} params.interfaceLanguage - Langue pour la reason (defaut: francais)
 * @param {string} params.userId - ID utilisateur
 * @param {AbortSignal} params.signal - Signal d'annulation
 * @returns {Promise<Object>}
 */
export async function executeBatchSummary({
  offerId,
  currentSummary = null,
  adaptedExperiences = [],
  adaptedProjects = [],
  adaptedSkills = {},
  adaptedExtras = [],
  jobOffer,
  targetLanguage = 'francais',
  interfaceLanguage = 'francais',
  userId,
  signal = null,
}) {
  const startTime = Date.now();
  const generationTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  console.log(`[batch-summary] Generating summary for offer ${offerId}`);

  // Creer la subtask
  const subtask = await prisma.cvGenerationSubtask.create({
    data: {
      offerId,
      type: 'batch_summary',
      status: 'running',
      input: {
        hasCurrentSummary: !!currentSummary,
        experiencesCount: adaptedExperiences.length,
        projectsCount: adaptedProjects.length,
        extrasCount: adaptedExtras.length,
      },
      startedAt: new Date(),
    },
  });

  try {
    const model = await getAiModelSetting('model_cv_batch_summary');
    const systemPromptInstructions = await loadPrompt('batch-summary-system.md');
    const userPromptTemplate = await loadPrompt('batch-summary-user.md');
    const schema = await loadSchema('batchSummarySchema.json');

    // Generer le Cache B (Job Offer + Experiences + Projects adaptes) et construire le system prompt
    const cacheB = generateCacheB(jobOffer, adaptedExperiences, adaptedProjects);
    const systemPrompt = buildCachedSystemPrompt(cacheB, systemPromptInstructions);

    // Calculer les durees des experiences (uniquement pro)
    const expDurations = calculateExperienceDurations(adaptedExperiences);
    console.log(`[batch-summary] Experience durations:`, expDurations);

    // Agreger les experiences par domaine (utilise domain et years_in_domain du batch experience)
    const domainAggregation = aggregateExperiencesByDomain(adaptedExperiences);
    console.log(`[batch-summary] Domain aggregation:`, domainAggregation.domainsDetails);

    // Extraire les top deliverables avec chiffres
    const topDeliverables = extractTopDeliverables(adaptedExperiences);

    // Extraire les skills pertinents qui matchent l'offre
    const topSkills = extractTopSkills(adaptedSkills, jobOffer);

    // Extraire les mots-cles de l'offre pour l'optimisation ATS
    const jobKeywords = extractJobKeywords(jobOffer);

    // Titre du poste vise
    const jobTitle = jobOffer?.title || 'Non specifie';

    // Job offer et experiences/projects sont dans le system prompt via cache
    const userPrompt = replaceVariables(userPromptTemplate, {
      targetLanguage,
      interfaceLanguage,
      experiencesByDomain: domainAggregation.domainsSummary || 'Non disponible',
      currentTitles: expDurations.currentTitles.join(' et ') || 'Non specifie',
      totalYears: expDurations.totalYears.toString(),
      topDeliverables,
      topSkills,
      jobTitle,
      jobKeywords,
    });

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
    // Ajuster max_completion_tokens pour les modèles de raisonnement (réduit à 8000)
    requestOptions = adjustTokensForReasoningModel(requestOptions, 800, 8000);
    // Ajouter reasoning_effort='low' pour favoriser la vitesse sur les modèles de raisonnement
    requestOptions = addReasoningEffortIfSupported(requestOptions, 'low');

    const fetchOptions = signal ? { signal } : {};
    const response = await client.chat.completions.create(requestOptions, fetchOptions);

    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    const duration = Date.now() - startTime;

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) {
      throw new Error('No content in OpenAI response');
    }

    // Nettoyer les caractères null qui ne peuvent pas être stockés en PostgreSQL
    const content = rawContent.replace(/\u0000/g, '');

    const result = JSON.parse(content);

    // Écrire le fichier de debug
    await writeDebugLog(systemPrompt, userPrompt, result, duration, generationTimestamp);

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
        featureName: 'cv_adaptation_summary',
        model,
        promptTokens,
        completionTokens,
        cachedTokens,
        duration,
      });
    }

    // Nettoyer le resultat pour supprimer les caracteres \u0000 non supportes par PostgreSQL
    const sanitizedResult = sanitizeForPostgres(result);

    await prisma.cvGenerationSubtask.update({
      where: { id: subtask.id },
      data: {
        status: 'completed',
        output: sanitizedResult,
        modelUsed: model,
        promptTokens,
        cachedTokens,
        completionTokens,
        estimatedCost,
        durationMs: duration,
        completedAt: new Date(),
      },
    });

    console.log(`[batch-summary] Completed in ${duration}ms:`, {
      description: (result.description || '').substring(0, 50) + '...',
      reason: result.reason || '',
    });

    return {
      success: true,
      adaptedSummary: {
        description: result.description,
      },
      reason: result.reason,
      subtaskId: subtask.id,
      tokens: { prompt: promptTokens, completion: completionTokens, cached: cachedTokens },
      estimatedCost,
      duration,
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

    console.error(`[batch-summary] Failed after ${duration}ms:`, error.message);

    return {
      success: false,
      error: error.message,
      adaptedSummary: currentSummary, // Retourner le summary original en cas d'echec
      subtaskId: subtask.id,
      duration,
    };
  }
}
