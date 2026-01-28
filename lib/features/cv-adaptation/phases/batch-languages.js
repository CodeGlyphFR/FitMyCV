/**
 * Phase Batch Languages - Pipeline CV v2
 *
 * Adapte les langues du CV:
 * - Traduit les noms et niveaux dans la langue cible
 * - Aligne les niveaux avec les exigences de l'offre d'emploi
 *
 * Utilise le setting `model_cv_batch_languages` pour le modèle IA.
 * Crée une CvGenerationSubtask de type `batch_languages`.
 */

import { promises as fs } from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { getOpenAIClient } from '@/lib/openai-core/client';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { trackOpenAIUsage, calculateCost } from '@/lib/telemetry/openai';
import { generateCacheA, buildCachedSystemPrompt } from '../utils/cacheContext.js';
import { sanitizeForPostgres } from '../utils/sanitize.js';

const PROMPTS_DIR = path.join(process.cwd(), 'lib/features/cv-adaptation/prompts');
const SCHEMAS_DIR = path.join(process.cwd(), 'lib/features/cv-adaptation/schemas');

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
 * Extrait les exigences linguistiques de l'offre d'emploi
 */
function extractLanguageRequirements(jobOffer) {
  const requirements = [];

  // Vérifier si l'offre a des exigences linguistiques structurées
  if (jobOffer?.requirements?.languages && Array.isArray(jobOffer.requirements.languages)) {
    for (const lang of jobOffer.requirements.languages) {
      if (typeof lang === 'object' && lang.name) {
        requirements.push({
          name: lang.name,
          level: lang.level || 'non spécifié',
        });
      } else if (typeof lang === 'string') {
        requirements.push({ name: lang, level: 'non spécifié' });
      }
    }
  }

  // Chercher aussi dans le texte de l'offre
  const fullText = [
    jobOffer?.title || '',
    jobOffer?.description || '',
    ...(jobOffer?.skills?.required || []),
    ...(jobOffer?.skills?.nice_to_have || []),
  ].join(' ').toLowerCase();

  // Patterns de langues avec niveaux
  const languagePatterns = [
    { name: 'Français', patterns: ['français', 'francais', 'french'] },
    { name: 'Anglais', patterns: ['anglais', 'english'] },
    { name: 'Allemand', patterns: ['allemand', 'german', 'deutsch'] },
    { name: 'Espagnol', patterns: ['espagnol', 'spanish', 'español'] },
    { name: 'Italien', patterns: ['italien', 'italian', 'italiano'] },
    { name: 'Portugais', patterns: ['portugais', 'portuguese', 'português'] },
    { name: 'Néerlandais', patterns: ['néerlandais', 'neerlandais', 'dutch'] },
    { name: 'Chinois', patterns: ['chinois', 'chinese', 'mandarin'] },
    { name: 'Japonais', patterns: ['japonais', 'japanese'] },
    { name: 'Arabe', patterns: ['arabe', 'arabic'] },
  ];

  for (const { name, patterns } of languagePatterns) {
    // Vérifier si cette langue est déjà dans requirements
    const alreadyExists = requirements.some(r =>
      r.name.toLowerCase() === name.toLowerCase()
    );
    if (alreadyExists) continue;

    for (const pattern of patterns) {
      if (fullText.includes(pattern)) {
        // Essayer de détecter le niveau mentionné
        let level = 'non spécifié';
        const levelPatterns = [
          { level: 'Courant', patterns: ['courant', 'fluent', 'proficient'] },
          { level: 'Bilingue', patterns: ['bilingue', 'bilingual', 'native'] },
          { level: 'Intermédiaire', patterns: ['intermediaire', 'intermediate', 'conversational'] },
          { level: 'Notions', patterns: ['notions', 'basic', 'beginner'] },
        ];

        for (const lp of levelPatterns) {
          // Chercher le niveau proche de la mention de la langue
          const langIndex = fullText.indexOf(pattern);
          const context = fullText.substring(Math.max(0, langIndex - 50), langIndex + 50);
          if (lp.patterns.some(p => context.includes(p))) {
            level = lp.level;
            break;
          }
        }

        requirements.push({ name, level });
        break;
      }
    }
  }

  return requirements;
}

/**
 * Execute le batch d'adaptation des langues
 *
 * @param {Object} params
 * @param {string} params.offerId - ID de la CvGenerationOffer
 * @param {Array} params.languages - Langues du CV source
 * @param {Object} params.jobOffer - Offre d'emploi
 * @param {string} params.sourceLanguage - Langue source du CV
 * @param {string} params.targetLanguage - Langue cible
 * @param {string} params.userId - ID utilisateur
 * @param {AbortSignal} params.signal - Signal d'annulation
 * @returns {Promise<Object>}
 */
export async function executeBatchLanguages({
  offerId,
  languages = [],
  jobOffer,
  sourceLanguage = 'francais',
  targetLanguage = 'francais',
  userId,
  signal = null,
}) {
  const startTime = Date.now();

  // Si pas de langues, retourner directement
  if (!languages || languages.length === 0) {
    console.log('[batch-languages] No languages to adapt');
    return {
      success: true,
      adaptedLanguages: [],
      language_modifications: [],
      duration: 0,
    };
  }

  console.log(`[batch-languages] Adapting ${languages.length} language(s)...`);

  // Extraire les exigences linguistiques de l'offre
  const languageRequirements = extractLanguageRequirements(jobOffer);
  console.log(`[batch-languages] Found ${languageRequirements.length} language requirement(s) in job offer`);

  // Créer la subtask
  const subtask = await prisma.cvGenerationSubtask.create({
    data: {
      offerId,
      type: 'batch_languages',
      status: 'running',
      input: {
        languagesCount: languages.length,
        languageNames: languages.map(l => l.name),
        requirements: languageRequirements,
      },
      startedAt: new Date(),
    },
  });

  try {
    const model = await getAiModelSetting('model_cv_batch_languages');
    const systemPromptInstructions = await loadPrompt('batch-languages-system.md');
    const userPromptTemplate = await loadPrompt('batch-languages-user.md');
    const schema = await loadSchema('batchLanguagesSchema.json');

    // Générer le Cache A (Job Offer) et construire le system prompt
    const cacheA = generateCacheA(jobOffer);
    const systemPrompt = buildCachedSystemPrompt(cacheA, systemPromptInstructions);

    // Variables du prompt utilisateur
    const userPrompt = replaceVariables(userPromptTemplate, {
      languagesJson: JSON.stringify(languages, null, 2),
      languageRequirementsJson: JSON.stringify(languageRequirements, null, 2),
      sourceLanguage,
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
      temperature: 0.2,
      max_completion_tokens: 800,
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
        featureName: 'cv_adaptation_languages',
        model,
        promptTokens,
        completionTokens,
        cachedTokens,
        duration,
      });
    }

    // Sanitize output for PostgreSQL (remove \u0000 characters)
    const sanitizedResult = sanitizeForPostgres(result);

    await prisma.cvGenerationSubtask.update({
      where: { id: subtask.id },
      data: {
        status: 'completed',
        output: sanitizedResult,
        modifications: sanitizedResult.language_modifications,
        modelUsed: model,
        promptTokens,
        cachedTokens,
        completionTokens,
        estimatedCost,
        durationMs: duration,
        completedAt: new Date(),
      },
    });

    // Log des modifications
    const mods = result.language_modifications || [];
    const modifiedCount = mods.filter(m => m.action === 'modified').length;
    console.log(`[batch-languages] Completed in ${duration}ms:`, {
      total: languages.length,
      modifications: mods.length,
      modified: modifiedCount,
    });

    return {
      success: true,
      adaptedLanguages: sanitizedResult.languages,
      language_modifications: sanitizedResult.language_modifications,
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

    console.error(`[batch-languages] Failed after ${duration}ms:`, error.message);

    return {
      success: false,
      error: error.message,
      adaptedLanguages: languages, // Retourner les langues originales en cas d'échec
      language_modifications: [],
      subtaskId: subtask.id,
      duration,
    };
  }
}
