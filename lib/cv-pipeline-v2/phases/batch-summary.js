/**
 * Phase Batch Summary - Pipeline CV v2
 *
 * Genere un summary professionnel adapte a l'offre d'emploi:
 * - headline: Titre accrocheur
 * - description: "Who I am" authentique (NFR3)
 * - years_experience: Calcule depuis les experiences
 * - domains: Domaines d'expertise
 * - key_strengths: Points forts cles
 *
 * Utilise le setting `model_cv_batch_summary` pour le modele IA.
 * Cree une CvGenerationSubtask de type `batch_summary`.
 * Execute APRES toutes les autres phases batch (besoin du contexte complet).
 */

import { promises as fs } from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { getOpenAIClient } from '@/lib/openai/client';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { trackOpenAIUsage, calculateCost } from '@/lib/telemetry/openai';
import { generateCacheB, buildCachedSystemPrompt } from '../utils/cacheContext.js';
import { sanitizeForPostgres } from '../utils/sanitize.js';

const PROMPTS_DIR = path.join(process.cwd(), 'lib/cv-pipeline-v2/prompts');
const SCHEMAS_DIR = path.join(process.cwd(), 'lib/cv-pipeline-v2/schemas');

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
 * Prepare un resume des experiences pour le contexte
 */
function prepareExperiencesSummary(experiences) {
  if (!experiences || experiences.length === 0) return '[]';

  return JSON.stringify(
    experiences.map(exp => ({
      title: exp.title,
      company: exp.company,
      start_date: exp.start_date,
      end_date: exp.end_date,
      skills_used: exp.skills_used || [],
      responsibilities: (exp.responsibilities || []).slice(0, 3),
    })),
    null,
    2
  );
}

/**
 * Prepare un resume des projets pour le contexte
 */
function prepareProjectsSummary(projects) {
  if (!projects || projects.length === 0) return '[]';

  return JSON.stringify(
    projects.map(proj => ({
      name: proj.name,
      tech_stack: proj.tech_stack || [],
      summary: proj.summary || '',
    })),
    null,
    2
  );
}

/**
 * Prepare un resume des skills pour le contexte
 */
function prepareSkillsSummary(skills) {
  if (!skills) return '{}';

  return JSON.stringify(
    {
      hard_skills: (skills.hard_skills || []).map(s => s.name || s),
      soft_skills: skills.soft_skills || [],
      tools: (skills.tools || []).map(t => t.name || t),
      methodologies: skills.methodologies || [],
    },
    null,
    2
  );
}

/**
 * Prepare un resume des extras pour le contexte
 */
function prepareExtrasSummary(extras) {
  if (!extras || extras.length === 0) return '[]';

  return JSON.stringify(
    extras.map(extra => ({
      name: extra.name,
      summary: extra.summary || '',
    })),
    null,
    2
  );
}

/**
 * Extrait les infos de l'offre pour le summary
 */
function extractJobOfferInfo(jobOffer) {
  const skills = jobOffer.skills || {};
  const required = skills.required || [];
  const niceToHave = skills.nice_to_have || [];

  return {
    jobTitle: jobOffer.title || 'Non specifie',
    jobDescription: jobOffer.description || 'Non specifie',
    requiredSkills: required.length > 0 ? required.join(', ') : 'Non specifie',
    niceToHaveSkills: niceToHave.length > 0 ? niceToHave.join(', ') : 'Non specifie',
  };
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
 * @param {string} params.targetLanguage - Langue cible
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
  userId,
  signal = null,
}) {
  const startTime = Date.now();

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

    // Job offer et experiences/projects sont dans le system prompt via cache
    const userPrompt = replaceVariables(userPromptTemplate, {
      targetLanguage,
      experiencesByDomain: domainAggregation.domainsSummary || 'Non disponible',
      currentTitles: expDurations.currentTitles.join(' et ') || 'Non spécifié',
      totalYears: expDurations.totalYears.toString(),
      experiencesJson: JSON.stringify(adaptedExperiences, null, 2),
      skillsJson: prepareSkillsSummary(adaptedSkills),
    });

    const client = getOpenAIClient();

    const requestOptions = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: schema,
      },
      temperature: 0.3, // Un peu plus de creativite pour le summary
    };

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

    // Validation post-traitement
    // Limiter le nombre de domains (2-3 max)
    result.domains = result.domains || [];
    if (result.domains.length > 3) {
      console.warn(`[batch-summary] Trimming domains from ${result.domains.length} to 3`);
      result.domains = result.domains.slice(0, 3);
    }

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
        featureName: 'cv_pipeline_v2_batch_summary',
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
        modifications: sanitizedResult.modifications,
        modelUsed: model,
        promptTokens,
        cachedTokens,
        completionTokens,
        estimatedCost,
        durationMs: duration,
        completedAt: new Date(),
      },
    });

    // Log des modifications (format array: [{field, action, before, after, reason}])
    const mods = result.modifications || [];
    console.log(`[batch-summary] Completed in ${duration}ms:`, {
      description: (result.description || '').substring(0, 50) + '...',
      domainsCount: (result.domains || []).length,
      totalModifications: mods.length,
    });

    return {
      success: true,
      adaptedSummary: {
        description: result.description,
        domains: result.domains,
      },
      modifications: result.modifications,
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
