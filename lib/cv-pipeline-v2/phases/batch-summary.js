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
import { trackOpenAIUsage } from '@/lib/telemetry/openai';

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
    const systemPrompt = await loadPrompt('batch-summary-system.md');
    const userPromptTemplate = await loadPrompt('batch-summary-user.md');
    const schema = await loadSchema('batchSummarySchema.json');

    const jobOfferInfo = extractJobOfferInfo(jobOffer);

    const userPrompt = replaceVariables(userPromptTemplate, {
      experiencesJson: prepareExperiencesSummary(adaptedExperiences),
      projectsJson: prepareProjectsSummary(adaptedProjects),
      skillsJson: prepareSkillsSummary(adaptedSkills),
      extrasJson: prepareExtrasSummary(adaptedExtras),
      currentSummaryJson: currentSummary ? JSON.stringify(currentSummary, null, 2) : 'null',
      jobTitle: jobOfferInfo.jobTitle,
      jobDescription: jobOfferInfo.jobDescription,
      requiredSkills: jobOfferInfo.requiredSkills,
      niceToHaveSkills: jobOfferInfo.niceToHaveSkills,
      targetLanguage,
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
      max_completion_tokens: 1500,
    };

    const fetchOptions = signal ? { signal } : {};
    const response = await client.chat.completions.create(requestOptions, fetchOptions);

    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    const duration = Date.now() - startTime;

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    const result = JSON.parse(content);

    // FORCE headline = titre de l'offre (pas besoin de l'IA pour ca)
    // Le titre est dans jobOffer.content.title (le modele Prisma stocke le JSON dans content)
    const jobTitle = jobOffer?.content?.title || jobOffer?.title || '';
    console.log(`[batch-summary] Forcing headline from jobOffer: "${jobTitle}"`);
    result.headline = jobTitle || result.headline || '';

    // Validation post-traitement
    // Verifier que years_experience est raisonnable (0-50 ans)
    if (result.years_experience < 0 || result.years_experience > 50) {
      console.warn(`[batch-summary] WARNING: Unusual years_experience: ${result.years_experience}`);
      result.years_experience = Math.max(0, Math.min(50, result.years_experience));
    }

    // Limiter le nombre de domains et key_strengths
    result.domains = result.domains || [];
    result.key_strengths = result.key_strengths || [];
    if (result.domains.length > 5) {
      console.warn(`[batch-summary] Trimming domains from ${result.domains.length} to 5`);
      result.domains = result.domains.slice(0, 5);
    }
    if (result.key_strengths.length > 5) {
      console.warn(`[batch-summary] Trimming key_strengths from ${result.key_strengths.length} to 5`);
      result.key_strengths = result.key_strengths.slice(0, 5);
    }

    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;

    if (userId) {
      await trackOpenAIUsage({
        userId,
        featureName: 'cv_pipeline_v2_batch_summary',
        model,
        promptTokens,
        completionTokens,
        duration,
      });
    }

    await prisma.cvGenerationSubtask.update({
      where: { id: subtask.id },
      data: {
        status: 'completed',
        output: result,
        modifications: result.modifications,
        modelUsed: model,
        promptTokens,
        completionTokens,
        durationMs: duration,
        completedAt: new Date(),
      },
    });

    // Log des modifications (format array: [{field, action, before, after, reason}])
    const mods = result.modifications || [];
    console.log(`[batch-summary] Completed in ${duration}ms:`, {
      headline: (result.headline || '').substring(0, 50) + '...',
      years_experience: result.years_experience,
      domains: (result.domains || []).length,
      key_strengths: (result.key_strengths || []).length,
      totalModifications: mods.length,
    });

    return {
      success: true,
      adaptedSummary: {
        headline: result.headline,
        description: result.description,
        years_experience: result.years_experience,
        domains: result.domains,
        key_strengths: result.key_strengths,
      },
      modifications: result.modifications,
      subtaskId: subtask.id,
      tokens: { prompt: promptTokens, completion: completionTokens },
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
