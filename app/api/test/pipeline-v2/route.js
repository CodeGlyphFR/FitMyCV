/**
 * GET /api/test/pipeline-v2
 * Route de test pour analyser les résultats du pipeline CV v2.
 *
 * VERSION TEST STANDALONE - Appelle OpenAI directement sans tracking DB.
 *
 * Query params:
 * - cvId: ID du CV à utiliser (optionnel, défaut: CV Tech & Produit)
 * - jobOfferUrl: URL de l'offre d'emploi (optionnel, défaut: Expert LLM Indeed)
 * - preset: Preset prédéfini (tech-ia, csm-architect, meca-aero)
 * - stopAfter: Arrêter après cette phase (classify, experiences, projects, extras, skills, summary)
 *              Par défaut: classify (pour économiser les tokens)
 * - purgeCache: true pour purger les caches (job offer + OpenAI prompt cache)
 *
 * Exemples:
 * - /api/test/pipeline-v2?stopAfter=classify                    # Test classification seule
 * - /api/test/pipeline-v2?preset=tech-ia&stopAfter=classify     # Classification avec preset
 * - /api/test/pipeline-v2?preset=meca-aero&stopAfter=experiences # Classification + experiences
 * - /api/test/pipeline-v2?stopAfter=summary                     # Tout sauf recomposition
 * - /api/test/pipeline-v2?purgeCache=true&stopAfter=experiences # Purge cache avant test
 */

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { getOrExtractJobOfferFromUrl, extractJobOfferFromUrl } from '@/lib/openai/generateCv';
import { getOpenAIClient } from '@/lib/openai/client';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { applyClassification, classifyCore } from '@/lib/cv-pipeline-v2/phases/classify.js';
import { detectJobOfferLanguage } from '@/lib/cv-pipeline-v2/utils/language.js';

// Chemins des fichiers de prompts et schemas
const PROMPTS_DIR = path.join(process.cwd(), 'lib/cv-pipeline-v2/prompts');
const SCHEMAS_DIR = path.join(process.cwd(), 'lib/cv-pipeline-v2/schemas');

// Cache des résultats intermédiaires pour le développement
const CACHE_DIR = '/tmp/pipeline-v2-cache';

/**
 * Sauvegarde les résultats intermédiaires en cache
 */
async function saveIntermediateCache(preset, data) {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const cachePath = path.join(CACHE_DIR, `${preset}-intermediate.json`);
    await fs.writeFile(cachePath, JSON.stringify(data, null, 2));
    console.log(`[test-pipeline-v2] Cache saved: ${cachePath}`);
  } catch (err) {
    console.error('[test-pipeline-v2] Cache save error:', err.message);
  }
}

/**
 * Charge les résultats intermédiaires depuis le cache
 */
async function loadIntermediateCache(preset) {
  try {
    const cachePath = path.join(CACHE_DIR, `${preset}-intermediate.json`);
    const content = await fs.readFile(cachePath, 'utf-8');
    console.log(`[test-pipeline-v2] Cache loaded: ${cachePath}`);
    return JSON.parse(content);
  } catch (err) {
    console.log(`[test-pipeline-v2] No cache found for preset: ${preset}`);
    return null;
  }
}

// Pricing OpenAI par modèle ($ per 1M tokens) - Janvier 2025
const MODEL_PRICING = {
  // GPT-4.1 (gpt-4.1-2025-04-14)
  'gpt-4.1-2025-04-14': { input: 2.00, cached: 0.50, output: 8.00 },
  'gpt-4.1': { input: 2.00, cached: 0.50, output: 8.00 },
  // GPT-4.1 Mini (gpt-4.1-mini-2025-04-14)
  'gpt-4.1-mini-2025-04-14': { input: 0.40, cached: 0.10, output: 1.60 },
  'gpt-4.1-mini': { input: 0.40, cached: 0.10, output: 1.60 },
  // GPT-4.1 Nano
  'gpt-4.1-nano-2025-04-14': { input: 0.10, cached: 0.025, output: 0.40 },
  'gpt-4.1-nano': { input: 0.10, cached: 0.025, output: 0.40 },
  // GPT-4o (legacy)
  'gpt-4o-2024-11-20': { input: 2.50, cached: 1.25, output: 10.00 },
  'gpt-4o': { input: 2.50, cached: 1.25, output: 10.00 },
  // GPT-4o Mini (legacy)
  'gpt-4o-mini': { input: 0.15, cached: 0.075, output: 0.60 },
  'gpt-4o-mini-2024-07-18': { input: 0.15, cached: 0.075, output: 0.60 },
  // Default fallback
  'default': { input: 2.00, cached: 0.50, output: 8.00 },
};

/**
 * Extrait les métriques détaillées d'une réponse OpenAI
 */
function extractMetrics(response, model, durationMs) {
  const usage = response.usage || {};
  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;
  const cachedTokens = usage.prompt_tokens_details?.cached_tokens || 0;
  const uncachedInputTokens = promptTokens - cachedTokens;

  // Calculer le coût
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['default'];
  const inputCost = (uncachedInputTokens / 1_000_000) * pricing.input;
  const cachedCost = (cachedTokens / 1_000_000) * pricing.cached;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  const totalCost = inputCost + cachedCost + outputCost;

  return {
    model,
    durationMs,
    durationFormatted: `${(durationMs / 1000).toFixed(2)}s`,
    tokens: {
      input: promptTokens,
      cached: cachedTokens,
      output: completionTokens,
      total: promptTokens + completionTokens,
    },
    cost: {
      input: `$${inputCost.toFixed(6)}`,
      cached: `$${cachedCost.toFixed(6)}`,
      output: `$${outputCost.toFixed(6)}`,
      total: `$${totalCost.toFixed(6)}`,
      totalCents: Math.round(totalCost * 100 * 1000) / 1000, // Pour faciliter les additions
    },
  };
}

// Cache buster global pour invalider le cache OpenAI
let CACHE_BUSTER = null;

/**
 * Charge un prompt depuis un fichier
 * Si CACHE_BUSTER est défini, ajoute un commentaire unique au début pour invalider le cache OpenAI
 */
async function loadPrompt(filename) {
  const fullPath = path.join(PROMPTS_DIR, filename);
  const content = await fs.readFile(fullPath, 'utf-8');
  const trimmed = content.trim();

  // Si cache buster actif, ajouter un commentaire au début pour invalider le cache
  if (CACHE_BUSTER) {
    return `<!-- cache-buster: ${CACHE_BUSTER} -->\n\n${trimmed}`;
  }
  return trimmed;
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
 * Applique le filtre des deliverables sur une expérience adaptée
 */
function sanitizeAdaptedExperience(experience) {
  if (!experience) return experience;
  return {
    ...experience,
    deliverables: filterDeliverablesWithNumbers(experience.deliverables || []),
  };
}

/**
 * Execute la classification en mode test (sans DB)
 * Utilise classifyCore du backend pour garantir la coherence
 */
async function executeClassificationTest({ sourceCv, jobOffer }) {
  const result = await classifyCore({ sourceCv, jobOffer });

  return {
    classification: result.classification,
    metrics: extractMetrics(result.response, result.model, result.duration),
  };
}

/**
 * Extrait les informations cles de l'offre d'emploi pour le prompt
 */
function extractJobOfferInfo(jobOffer) {
  const skills = jobOffer.skills || {};
  const required = skills.required || [];
  const niceToHave = skills.nice_to_have || [];

  const keywords = new Set();
  if (jobOffer.title) keywords.add(jobOffer.title);
  required.forEach(s => keywords.add(s));
  niceToHave.forEach(s => keywords.add(s));
  if (jobOffer.responsibilities) {
    jobOffer.responsibilities.forEach(r => {
      r.split(/\s+/).filter(w => w.length > 4).slice(0, 3).forEach(w => keywords.add(w));
    });
  }

  return {
    jobTitle: jobOffer.title || 'Non specifie',
    requiredSkills: required.length > 0 ? required.join(', ') : 'Non specifie',
    niceToHaveSkills: niceToHave.length > 0 ? niceToHave.join(', ') : 'Non specifie',
    keywords: Array.from(keywords).slice(0, 20).join(', '),
  };
}

/**
 * Execute le batch experiences en mode test (sans DB)
 */
async function executeExperiencesTest({ experiences, jobOffer, targetLanguage }) {
  const validExperiences = (experiences || []).filter(exp => exp && typeof exp === 'object');
  if (validExperiences.length === 0) {
    return {
      adaptedExperiences: [],
      metrics: { model: 'N/A', durationMs: 0, durationFormatted: '0.00s', tokens: { input: 0, cached: 0, output: 0, total: 0 }, cost: { input: '$0', cached: '$0', output: '$0', total: '$0', totalCents: 0 } },
    };
  }

  const startTime = Date.now();
  const model = await getAiModelSetting('model_cv_batch_experience');
  const systemPrompt = await loadPrompt('batch-experience-system.md');
  const userPromptTemplate = await loadPrompt('batch-experience-user.md');
  const schema = await loadSchema('batchExperienceSchema.json');
  const jobOfferInfo = extractJobOfferInfo(jobOffer);
  const client = getOpenAIClient();

  const results = await Promise.all(
    validExperiences.map(async (experience, index) => {
      const itemStart = Date.now();
      const userPrompt = replaceVariables(userPromptTemplate, {
        experienceIndex: String(index),
        experienceJson: JSON.stringify(experience, null, 2),
        jobTitle: jobOfferInfo.jobTitle,
        requiredSkills: jobOfferInfo.requiredSkills,
        niceToHaveSkills: jobOfferInfo.niceToHaveSkills,
        keywords: jobOfferInfo.keywords,
        targetLanguage,
      });

      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_schema', json_schema: schema },
        temperature: 0.3,
        max_completion_tokens: 1500,
      });

      const content = response.choices?.[0]?.message?.content;
      const usage = response.usage || {};

      return {
        index,
        adapted: JSON.parse(content),
        tokens: {
          input: usage.prompt_tokens || 0,
          cached: usage.prompt_tokens_details?.cached_tokens || 0,
          output: usage.completion_tokens || 0,
        },
        durationMs: Date.now() - itemStart,
      };
    })
  );

  const durationMs = Date.now() - startTime;

  // Agréger les tokens
  const aggregatedTokens = results.reduce((sum, r) => ({
    input: sum.input + r.tokens.input,
    cached: sum.cached + r.tokens.cached,
    output: sum.output + r.tokens.output,
  }), { input: 0, cached: 0, output: 0 });

  // Calculer le coût agrégé
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['default'];
  const uncachedInput = aggregatedTokens.input - aggregatedTokens.cached;
  const inputCost = (uncachedInput / 1_000_000) * pricing.input;
  const cachedCost = (aggregatedTokens.cached / 1_000_000) * pricing.cached;
  const outputCost = (aggregatedTokens.output / 1_000_000) * pricing.output;
  const totalCost = inputCost + cachedCost + outputCost;

  return {
    // Applique le filtre des deliverables (supprime ceux sans chiffres)
    adaptedExperiences: results.sort((a, b) => a.index - b.index).map(r => sanitizeAdaptedExperience(r.adapted)),
    itemsDetails: results.map(r => ({
      index: r.index,
      tokens: r.tokens,
      durationMs: r.durationMs,
    })),
    metrics: {
      model,
      itemCount: validExperiences.length,
      durationMs,
      durationFormatted: `${(durationMs / 1000).toFixed(2)}s`,
      tokens: {
        input: aggregatedTokens.input,
        cached: aggregatedTokens.cached,
        output: aggregatedTokens.output,
        total: aggregatedTokens.input + aggregatedTokens.output,
      },
      cost: {
        input: `$${inputCost.toFixed(6)}`,
        cached: `$${cachedCost.toFixed(6)}`,
        output: `$${outputCost.toFixed(6)}`,
        total: `$${totalCost.toFixed(6)}`,
        totalCents: Math.round(totalCost * 100 * 1000) / 1000,
      },
    },
  };
}

/**
 * Execute le batch projects en mode test (sans DB)
 */
async function executeProjectsTest({ projects, jobOffer, targetLanguage }) {
  const validProjects = (projects || []).filter(p => p && typeof p === 'object');
  if (validProjects.length === 0) {
    return {
      adaptedProjects: [],
      metrics: { model: 'N/A', durationMs: 0, durationFormatted: '0.00s', tokens: { input: 0, cached: 0, output: 0, total: 0 }, cost: { input: '$0', cached: '$0', output: '$0', total: '$0', totalCents: 0 } },
    };
  }

  const startTime = Date.now();
  const model = await getAiModelSetting('model_cv_batch_projects');
  const systemPrompt = await loadPrompt('batch-project-system.md');
  const userPromptTemplate = await loadPrompt('batch-project-user.md');
  const schema = await loadSchema('batchProjectSchema.json');
  const jobOfferInfo = extractJobOfferInfo(jobOffer);
  const client = getOpenAIClient();

  const results = await Promise.all(
    validProjects.map(async (project, index) => {
      const userPrompt = replaceVariables(userPromptTemplate, {
        projectIndex: String(index),
        projectJson: JSON.stringify(project, null, 2),
        jobTitle: jobOfferInfo.jobTitle,
        requiredSkills: jobOfferInfo.requiredSkills,
        niceToHaveSkills: jobOfferInfo.niceToHaveSkills,
        keywords: jobOfferInfo.keywords,
        targetLanguage,
      });

      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_schema', json_schema: schema },
        temperature: 0.3,
        max_completion_tokens: 1500,
      });

      const content = response.choices?.[0]?.message?.content;
      const usage = response.usage || {};
      return {
        index,
        adapted: JSON.parse(content),
        tokens: {
          input: usage.prompt_tokens || 0,
          cached: usage.prompt_tokens_details?.cached_tokens || 0,
          output: usage.completion_tokens || 0,
        },
      };
    })
  );

  const durationMs = Date.now() - startTime;
  const aggregatedTokens = results.reduce((sum, r) => ({
    input: sum.input + r.tokens.input,
    cached: sum.cached + r.tokens.cached,
    output: sum.output + r.tokens.output,
  }), { input: 0, cached: 0, output: 0 });

  const pricing = MODEL_PRICING[model] || MODEL_PRICING['default'];
  const uncachedInput = aggregatedTokens.input - aggregatedTokens.cached;
  const inputCost = (uncachedInput / 1_000_000) * pricing.input;
  const cachedCost = (aggregatedTokens.cached / 1_000_000) * pricing.cached;
  const outputCost = (aggregatedTokens.output / 1_000_000) * pricing.output;
  const totalCost = inputCost + cachedCost + outputCost;

  return {
    // Applique le filtre des deliverables (supprime ceux sans chiffres)
    adaptedProjects: results.sort((a, b) => a.index - b.index).map(r => sanitizeAdaptedExperience(r.adapted)),
    metrics: {
      model,
      itemCount: validProjects.length,
      durationMs,
      durationFormatted: `${(durationMs / 1000).toFixed(2)}s`,
      tokens: { input: aggregatedTokens.input, cached: aggregatedTokens.cached, output: aggregatedTokens.output, total: aggregatedTokens.input + aggregatedTokens.output },
      cost: { input: `$${inputCost.toFixed(6)}`, cached: `$${cachedCost.toFixed(6)}`, output: `$${outputCost.toFixed(6)}`, total: `$${totalCost.toFixed(6)}`, totalCents: Math.round(totalCost * 100 * 1000) / 1000 },
    },
  };
}

/**
 * Execute le batch extras en mode test (sans DB)
 */
async function executeExtrasTest({ extras, jobOffer, targetLanguage }) {
  const validExtras = (extras || []).filter(e => e && typeof e === 'object');
  if (validExtras.length === 0) {
    return {
      adaptedExtras: [],
      metrics: { model: 'N/A', durationMs: 0, durationFormatted: '0.00s', tokens: { input: 0, cached: 0, output: 0, total: 0 }, cost: { input: '$0', cached: '$0', output: '$0', total: '$0', totalCents: 0 } },
    };
  }

  const startTime = Date.now();
  const model = await getAiModelSetting('model_cv_batch_extras');
  const systemPrompt = await loadPrompt('batch-extras-system.md');
  const userPromptTemplate = await loadPrompt('batch-extras-user.md');
  const schema = await loadSchema('batchExtrasSchema.json');
  const client = getOpenAIClient();

  const userPrompt = replaceVariables(userPromptTemplate, {
    extrasJson: JSON.stringify(validExtras, null, 2),
    jobOfferJson: JSON.stringify(jobOffer, null, 2),
    targetLanguage,
  });

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_schema', json_schema: schema },
    temperature: 0.3,
    max_completion_tokens: 2000,
  });

  const content = response.choices?.[0]?.message?.content;
  const result = JSON.parse(content);
  const durationMs = Date.now() - startTime;

  return {
    adaptedExtras: result.extras || result,
    modifications: result.modifications,
    metrics: extractMetrics(response, model, durationMs),
  };
}

/**
 * Execute le batch skills en mode test (sans DB)
 */
async function executeSkillsTest({ skills, adaptedExperiences, adaptedProjects, jobOffer, targetLanguage }) {
  const startTime = Date.now();
  const model = await getAiModelSetting('model_cv_batch_skills');
  const systemPrompt = await loadPrompt('batch-skills-system.md');
  const userPromptTemplate = await loadPrompt('batch-skills-user.md');
  const schema = await loadSchema('batchSkillsSchema.json');
  const client = getOpenAIClient();

  // Extraire les infos de l'offre
  const jobSkills = jobOffer.skills || {};
  const required = jobSkills.required || [];
  const niceToHave = jobSkills.nice_to_have || [];

  // Créer un résumé des expériences adaptées
  const experiencesSummary = (adaptedExperiences || []).map(exp => ({
    title: exp.title,
    company: exp.company,
    skills_used: exp.skills_used,
  }));

  // Créer un résumé des projets adaptés
  const projectsSummary = (adaptedProjects || []).map(proj => ({
    name: proj.name,
    tech_stack: proj.tech_stack,
  }));

  const userPrompt = replaceVariables(userPromptTemplate, {
    hardSkillsJson: JSON.stringify(skills?.hard_skills || [], null, 2),
    softSkillsJson: JSON.stringify(skills?.soft_skills || [], null, 2),
    toolsJson: JSON.stringify(skills?.tools || [], null, 2),
    methodologiesJson: JSON.stringify(skills?.methodologies || [], null, 2),
    experiencesSummary: JSON.stringify(experiencesSummary, null, 2),
    projectsSummary: JSON.stringify(projectsSummary, null, 2),
    jobTitle: jobOffer.title || 'Non spécifié',
    requiredSkills: required.length > 0 ? required.join(', ') : 'Non spécifié',
    niceToHaveSkills: niceToHave.length > 0 ? niceToHave.join(', ') : 'Non spécifié',
    targetLanguage,
  });

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_schema', json_schema: schema },
    temperature: 0.2,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No content in skills response');
  }
  const result = JSON.parse(content);
  const durationMs = Date.now() - startTime;

  return {
    skills: result,
    modifications: result.modifications,
    metrics: extractMetrics(response, model, durationMs),
  };
}

/**
 * Execute le batch summary en mode test (sans DB)
 */
async function executeSummaryTest({ sourceSummary, adaptedExperiences, adaptedProjects, adaptedSkills, adaptedExtras, jobOffer, targetLanguage }) {
  const startTime = Date.now();
  const model = await getAiModelSetting('model_cv_batch_summary');
  const systemPrompt = await loadPrompt('batch-summary-system.md');
  const userPromptTemplate = await loadPrompt('batch-summary-user.md');
  const schema = await loadSchema('batchSummarySchema.json');
  const client = getOpenAIClient();

  const userPrompt = replaceVariables(userPromptTemplate, {
    sourceSummaryJson: JSON.stringify(sourceSummary || {}, null, 2),
    adaptedExperiencesJson: JSON.stringify(adaptedExperiences || [], null, 2),
    adaptedProjectsJson: JSON.stringify(adaptedProjects || [], null, 2),
    adaptedSkillsJson: JSON.stringify(adaptedSkills || {}, null, 2),
    adaptedExtrasJson: JSON.stringify(adaptedExtras || [], null, 2),
    jobOfferJson: JSON.stringify(jobOffer, null, 2),
    targetLanguage,
  });

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_schema', json_schema: schema },
    temperature: 0.4,
    max_completion_tokens: 1500,
  });

  const content = response.choices?.[0]?.message?.content;
  const result = JSON.parse(content);
  const durationMs = Date.now() - startTime;

  return {
    summary: result.summary || result,
    modifications: result.modifications,
    metrics: extractMetrics(response, model, durationMs),
  };
}

// Configuration par défaut
const DEFAULT_USER_ID = 'cmit5hjl50002u22jbpezo875';
const DEFAULT_CV_ID = 'cmjg1b6vc000ju2t6e29vgn80';
const DEFAULT_JOB_OFFER_URL = 'https://fr.indeed.com/viewjob?jk=23f22ad8e53792ec';

// Presets de test disponibles
const TEST_PRESETS = {
  'tech-ia': {
    cvId: 'cmjg1b6vc000ju2t6e29vgn80',
    cvName: 'Tech & Produit end-to-end | IA, SaaS, Électronique',
    jobOfferUrl: 'https://fr.indeed.com/viewjob?jk=23f22ad8e53792ec',
    jobOfferName: 'Expert LLM & Agentic AI @ AOSIS',
  },
  'csm-architect': {
    cvId: 'cmiykij8r002du2okqmizvzx6',
    cvName: 'Customer Success Manager',
    jobOfferUrl: 'https://www.welcometothejungle.com/fr/companies/inqom/jobs/head-of-customer-architect',
    jobOfferName: 'Head of Customer Architect @ Inqom',
  },
  'meca-aero': {
    cvId: 'cmj8fmsuf003nu2hdij6p28q3',
    cvName: 'Ingénieur mécanique – Aéronautique',
    jobOfferUrl: 'https://fr.indeed.com/viewjob?jk=91ecb1f61970a3d5',
    jobOfferName: 'Ingénieur(e) Mécanique',
  },
};

// Phases disponibles dans l'ordre
const PHASES = ['classify', 'experiences', 'projects', 'extras', 'skills', 'summary'];

/**
 * Vérifie si une phase doit être exécutée
 */
function shouldExecutePhase(phase, stopAfter) {
  const stopIndex = PHASES.indexOf(stopAfter);
  const phaseIndex = PHASES.indexOf(phase);
  return phaseIndex <= stopIndex;
}

/**
 * Test mode: Extract job offer only (no pipeline)
 * Usage: /api/test/pipeline-v2?testMode=extract-job&url=<indeed-url>
 */
async function testJobOfferExtraction(searchParams) {
  const url = searchParams.get('url');
  if (!url) {
    return NextResponse.json({
      error: 'Missing url parameter',
      usage: '/api/test/pipeline-v2?testMode=extract-job&url=<job-offer-url>',
      example: '/api/test/pipeline-v2?testMode=extract-job&url=https://fr.indeed.com/viewjob?jk=063fd1c39027c5ec',
    }, { status: 400 });
  }

  console.log('[test-extract-job] Testing job offer extraction for:', url);
  const startTime = Date.now();

  try {
    // Import htmlToMarkdown functions for debugging
    const { extractJobOfferContent } = await import('@/lib/utils/htmlToMarkdown.js');
    const { fetchHtmlWithFallback } = await import('@/lib/openai/generateCv.js');

    // Step 1: Fetch HTML
    console.log('[test-extract-job] Step 1: Fetching HTML...');
    const html = await fetchHtmlWithFallback(url);
    console.log(`[test-extract-job] HTML fetched: ${html.length} chars`);

    // Step 2: Extract content with htmlToMarkdown
    console.log('[test-extract-job] Step 2: Extracting content...');
    const { content: markdown, title: extractedTitle } = extractJobOfferContent(html, url);
    console.log(`[test-extract-job] Markdown extracted: ${markdown.length} chars, title: "${extractedTitle}"`);

    // Step 3: Call OpenAI for structured extraction
    console.log('[test-extract-job] Step 3: Calling OpenAI for structured extraction...');
    const result = await extractJobOfferFromUrl(url, null, null);
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      duration: `${(duration / 1000).toFixed(2)}s`,
      url,
      extraction: {
        htmlTitle: extractedTitle,
        aiTitle: result.extraction.title,
        titleMatch: extractedTitle === result.extraction.title,
      },
      jobOffer: result.extraction,
      debug: {
        htmlLength: html.length,
        markdownLength: markdown.length,
        markdownPreview: markdown.substring(0, 1000),
        tokensUsed: result.tokensUsed,
        model: result.model,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[test-extract-job] Error:', error.message);
    return NextResponse.json({
      success: false,
      duration: `${(duration / 1000).toFixed(2)}s`,
      url,
      error: error.message,
    }, { status: 500 });
  }
}

/**
 * Test mode: Skills batch only with hardcoded data
 * Usage: /api/test/pipeline-v2?testMode=skills-only
 */
async function testSkillsOnly() {
  const { executeBatchSkills } = await import('@/lib/cv-pipeline-v2/phases/batch-skills.js');

  const startTime = Date.now();

  // Données de l'offre No-code Builder
  const jobOffer = {
    title: "No-code Builder",
    skills: {
      required: ["no-code", "low-code", "n8n", "Make", "Zapier", "API", "intégrations SaaS", "logique d'automatisation", "gestion d'erreurs", "optimisation", "modèles d'IA générative", "anglais B2"],
      nice_to_have: ["Cursor", "Replit", "Brighdata", "Phantombuster", "Open AI"],
      soft_skills: ["esprit analytique", "capacité de debugging", "curiosité technologique", "autonomie", "rigueur", "organisation"]
    }
  };

  // Skills source du CV Tech (avec les problèmes à corriger)
  const skillsSource = {
    tools: [
      { name: "Claude API / Claude Code" },
      { name: "Cursor" },
      { name: "OpenAI API" },
      { name: "Figma" },
      { name: "Matlab / Simulink" },
      { name: "Git" },
      { name: "Linux / Ubuntu Server" }
    ],
    hard_skills: [
      { name: "Prompt Engineering" },
      { name: "Claude API / Claude Code" },
      { name: "Cursor" },
      { name: "OpenAI API" },
      { name: "Agents IA" },
      { name: "Déploiement de modèles (cloud / on-premise)" },
      { name: "Python" },
      { name: "C" },
      { name: "Architecture logicielle" },
      { name: "APIs" },
      { name: "Git" },
      { name: "Figma" },
      { name: "Linux / Ubuntu Server" },
      { name: "Administration système" },
      { name: "Systèmes embarqués" },
      { name: "Micro-soudure" },
      { name: "Conception électronique" },
      { name: "Matlab / Simulink" },
      { name: "Gestion de projet" },
      { name: "Coordination d'équipes internationales" }
    ],
    soft_skills: ["Autonomie", "Coordination d'équipes", "Management d'équipe", "Capacité à structurer", "Communication"],
    methodologies: []
  };

  // Expériences adaptées (simplifiées)
  const adaptedExperiences = [
    { title: "Consultant technique senior", company: "Accenture France", skills_used: ["Qualité logicielle", "Gestion d'équipe"] },
    { title: "Fondateur & Développeur SaaS", company: "FitMyCV.io", skills_used: ["Next.js", "OpenAI API", "Développement full-stack"] }
  ];

  try {
    const result = await executeBatchSkills({
      offerId: null, // Skip DB
      skills: skillsSource,
      adaptedExperiences,
      adaptedProjects: [],
      jobOffer,
      targetLanguage: "francais",
      userId: null,
      signal: null
    });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: result.success,
      duration: `${(duration / 1000).toFixed(2)}s`,
      jobOffer: { title: jobOffer.title, required: jobOffer.skills.required },
      input: {
        hard_skills: skillsSource.hard_skills.map(s => s.name),
        tools: skillsSource.tools.map(s => s.name),
        soft_skills: skillsSource.soft_skills
      },
      output: result.adaptedSkills,
      modifications: result.modifications,
      tokens: result.tokens
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

export async function GET(request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Test route disabled in production' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  // Mode test spécial: extraction d'offre d'emploi uniquement
  const testMode = searchParams.get('testMode');
  if (testMode === 'extract-job') {
    return await testJobOfferExtraction(searchParams);
  }
  if (testMode === 'skills-only') {
    return await testSkillsOnly();
  }

  // Récupérer les paramètres
  const preset = searchParams.get('preset');
  let cvId, jobOfferUrl;

  if (preset && TEST_PRESETS[preset]) {
    cvId = TEST_PRESETS[preset].cvId;
    jobOfferUrl = TEST_PRESETS[preset].jobOfferUrl;
    console.log(`[test-pipeline-v2] Using preset: ${preset}`);
  } else {
    cvId = searchParams.get('cvId') || DEFAULT_CV_ID;
    jobOfferUrl = searchParams.get('jobOfferUrl') || DEFAULT_JOB_OFFER_URL;
  }

  // stopAfter: par défaut "classify" pour économiser les tokens
  const stopAfter = searchParams.get('stopAfter') || 'classify';
  if (!PHASES.includes(stopAfter)) {
    return NextResponse.json({
      error: `Invalid stopAfter value: ${stopAfter}`,
      validValues: PHASES,
    }, { status: 400 });
  }

  // useCache: charger les résultats en cache jusqu'à cette phase
  // Ex: useCache=extras va charger classify, experiences, projects, extras depuis le cache
  const useCache = searchParams.get('useCache');
  if (useCache && !PHASES.includes(useCache)) {
    return NextResponse.json({
      error: `Invalid useCache value: ${useCache}`,
      validValues: PHASES,
    }, { status: 400 });
  }

  // purgeCache: force la ré-extraction et invalide le cache OpenAI
  const purgeCache = searchParams.get('purgeCache') === 'true';

  // Si purgeCache, générer un cache buster unique pour invalider le cache OpenAI
  if (purgeCache) {
    CACHE_BUSTER = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    console.log(`[test-pipeline-v2] Cache buster set: ${CACHE_BUSTER}`);
  } else {
    CACHE_BUSTER = null;
  }

  console.log(`[test-pipeline-v2] stopAfter: ${stopAfter}, useCache: ${useCache || 'none'}, purgeCache: ${purgeCache}`);

  const startTime = Date.now();
  const results = { phases: [] };

  try {
    // === Récupérer les données sources ===
    const sourceCvRecord = await prisma.cvFile.findUnique({
      where: { id: cvId },
      select: { id: true, filename: true, content: true, language: true },
    });

    if (!sourceCvRecord) {
      return NextResponse.json({
        error: 'CV not found',
        cvId,
        availablePresets: Object.keys(TEST_PRESETS),
      }, { status: 404 });
    }

    const sourceCv = sourceCvRecord.content;

    // Extraire l'offre d'emploi
    console.log('[test-pipeline-v2] Extracting job offer from URL:', jobOfferUrl);

    let jobOfferResult;
    if (purgeCache) {
      // Purge: supprimer le cache DB et extraire fraîchement
      console.log('[test-pipeline-v2] purgeCache=true - Deleting cached job offer and extracting fresh');
      await prisma.jobOffer.deleteMany({
        where: { userId: DEFAULT_USER_ID, sourceValue: jobOfferUrl }
      });
      const { extraction, tokensUsed, model, title } = await extractJobOfferFromUrl(jobOfferUrl, DEFAULT_USER_ID, null);
      jobOfferResult = { extraction, title, fromCache: false, purged: true };
    } else {
      jobOfferResult = await getOrExtractJobOfferFromUrl(DEFAULT_USER_ID, jobOfferUrl);
    }

    const jobOffer = jobOfferResult.extraction;
    console.log('[test-pipeline-v2] Job offer extracted, title:', jobOffer?.title);
    console.log('[test-pipeline-v2] From cache:', jobOfferResult.fromCache, 'Purged:', jobOfferResult.purged || false);

    // Détecter la langue de l'offre
    const targetLanguage = await detectJobOfferLanguage(jobOffer, sourceCvRecord.language || 'fr');

    // === CACHE: Charger les résultats intermédiaires si useCache est spécifié ===
    let cachedData = null;
    const useCacheIndex = useCache ? PHASES.indexOf(useCache) : -1;

    if (useCache && preset) {
      cachedData = await loadIntermediateCache(preset);
      if (cachedData) {
        console.log(`[test-pipeline-v2] Using cached data up to phase: ${useCache}`);
      } else {
        console.log(`[test-pipeline-v2] WARNING: useCache=${useCache} but no cache found. Running all phases.`);
      }
    }

    // Helper: une phase utilise-t-elle le cache?
    const shouldUseCache = (phaseName) => {
      if (!cachedData) return false;
      const phaseIndex = PHASES.indexOf(phaseName);
      return phaseIndex <= useCacheIndex;
    };

    // === PHASE: Classification ===
    let classificationResult = null;
    let filteredCv = null;

    if (shouldExecutePhase('classify', stopAfter)) {
      if (shouldUseCache('classify')) {
        console.log('[test-pipeline-v2] Loading from cache: Classification');
        classificationResult = cachedData.classificationResult;
        filteredCv = cachedData.filteredCv;
        results.phases.push({ type: 'classify', status: 'from_cache', output: classificationResult?.classification });
      } else {
        console.log('[test-pipeline-v2] Executing: Classification (test mode)');
        classificationResult = await executeClassificationTest({ sourceCv, jobOffer });
        filteredCv = applyClassification(sourceCv, classificationResult.classification);
        results.phases.push({
          type: 'classify',
          status: 'completed',
          metrics: classificationResult.metrics,
          output: classificationResult.classification,
        });
      }
    }

    // === PHASE: Batch Experiences ===
    let adaptedExperiences = [];

    if (shouldExecutePhase('experiences', stopAfter) && filteredCv?.experiences?.length > 0) {
      if (shouldUseCache('experiences')) {
        console.log('[test-pipeline-v2] Loading from cache: Batch Experiences');
        adaptedExperiences = cachedData.adaptedExperiences || [];
        results.phases.push({ type: 'batch_experiences', status: 'from_cache', count: adaptedExperiences.length });
      } else {
        console.log('[test-pipeline-v2] Executing: Batch Experiences (test mode)');
        const expResult = await executeExperiencesTest({
          experiences: filteredCv.experiences,
          jobOffer,
          targetLanguage: targetLanguage.name,
        });
        adaptedExperiences = expResult.adaptedExperiences;
        results.phases.push({
          type: 'batch_experiences',
          status: 'completed',
          metrics: expResult.metrics,
          count: adaptedExperiences.length,
          output: adaptedExperiences,
        });
      }
    }

    // === PHASE: Batch Projects ===
    let adaptedProjects = [];

    if (shouldExecutePhase('projects', stopAfter)) {
      const projectsToProcess = filteredCv?.projects || [];

      if (shouldUseCache('projects')) {
        console.log('[test-pipeline-v2] Loading from cache: Batch Projects');
        adaptedProjects = cachedData.adaptedProjects || [];
        results.phases.push({ type: 'batch_projects', status: 'from_cache', count: adaptedProjects.length });
      } else if (projectsToProcess.length > 0) {
        console.log('[test-pipeline-v2] Executing: Batch Projects (test mode)');
        const projResult = await executeProjectsTest({
          projects: projectsToProcess,
          jobOffer,
          targetLanguage: targetLanguage.name,
        });
        adaptedProjects = projResult.adaptedProjects;
        results.phases.push({
          type: 'batch_projects',
          status: 'completed',
          metrics: projResult.metrics,
          count: adaptedProjects.length,
          output: adaptedProjects,
        });
      }
    }

    // === PHASE: Batch Extras ===
    let adaptedExtras = null;

    if (shouldExecutePhase('extras', stopAfter)) {
      if (shouldUseCache('extras')) {
        console.log('[test-pipeline-v2] Loading from cache: Batch Extras');
        adaptedExtras = cachedData.adaptedExtras;
        results.phases.push({ type: 'batch_extras', status: 'from_cache', output: adaptedExtras?.adaptedExtras });
      } else if (sourceCv.extras?.length > 0) {
        console.log('[test-pipeline-v2] Executing: Batch Extras (test mode)');
        const extrasResult = await executeExtrasTest({
          extras: sourceCv.extras,
          jobOffer,
          targetLanguage: targetLanguage.name,
        });
        adaptedExtras = extrasResult;
        results.phases.push({
          type: 'batch_extras',
          status: 'completed',
          metrics: extrasResult.metrics,
          output: extrasResult.adaptedExtras,
          modifications: extrasResult.modifications,
        });
      }
    }

    // === PHASE: Batch Skills ===
    let adaptedSkills = null;

    if (shouldExecutePhase('skills', stopAfter)) {
      if (shouldUseCache('skills')) {
        console.log('[test-pipeline-v2] Loading from cache: Batch Skills');
        adaptedSkills = cachedData.adaptedSkills;
        results.phases.push({ type: 'batch_skills', status: 'from_cache', output: adaptedSkills?.skills });
      } else {
        console.log('[test-pipeline-v2] Executing: Batch Skills (test mode)');
        const skillsResult = await executeSkillsTest({
          skills: sourceCv.skills,
          adaptedExperiences,
          adaptedProjects,
          jobOffer,
          targetLanguage: targetLanguage.name,
        });
        adaptedSkills = skillsResult;
        results.phases.push({
          type: 'batch_skills',
          status: 'completed',
          metrics: skillsResult.metrics,
          output: skillsResult.skills,
          modifications: skillsResult.modifications,
        });
      }
    }

    // === PHASE: Batch Summary ===
    let adaptedSummary = null;

    if (shouldExecutePhase('summary', stopAfter)) {
      if (shouldUseCache('summary')) {
        console.log('[test-pipeline-v2] Loading from cache: Batch Summary');
        adaptedSummary = cachedData.adaptedSummary;
        results.phases.push({ type: 'batch_summary', status: 'from_cache', output: adaptedSummary?.summary });
      } else {
        console.log('[test-pipeline-v2] Executing: Batch Summary (test mode)');
        const summaryResult = await executeSummaryTest({
          sourceSummary: sourceCv.summary,
          adaptedExperiences,
          adaptedProjects,
          adaptedSkills: adaptedSkills?.skills || sourceCv.skills,
          adaptedExtras: adaptedExtras?.adaptedExtras || sourceCv.extras,
          jobOffer,
          targetLanguage: targetLanguage.name,
        });
        adaptedSummary = summaryResult;
        results.phases.push({
          type: 'batch_summary',
          status: 'completed',
          metrics: summaryResult.metrics,
          output: summaryResult.summary,
          modifications: summaryResult.modifications,
        });
      }
    }

    // === CACHE: Sauvegarder les résultats intermédiaires ===
    if (preset && !useCache) {
      await saveIntermediateCache(preset, {
        classificationResult,
        filteredCv,
        adaptedExperiences,
        adaptedProjects,
        adaptedExtras,
        adaptedSkills,
        adaptedSummary,
        targetLanguage: targetLanguage.name,
        jobOffer,
        sourceCv,
      });
    }

    // === Construire la réponse ===
    const duration = Date.now() - startTime;

    // Agréger les métriques totales
    const totalMetrics = results.phases.reduce((acc, phase) => {
      if (phase.metrics) {
        acc.tokens.input += phase.metrics.tokens?.input || 0;
        acc.tokens.cached += phase.metrics.tokens?.cached || 0;
        acc.tokens.output += phase.metrics.tokens?.output || 0;
        acc.cost.totalCents += phase.metrics.cost?.totalCents || 0;
      }
      return acc;
    }, {
      tokens: { input: 0, cached: 0, output: 0 },
      cost: { totalCents: 0 },
    });

    totalMetrics.tokens.total = totalMetrics.tokens.input + totalMetrics.tokens.output;
    totalMetrics.cost.total = `$${(totalMetrics.cost.totalCents / 100).toFixed(4)}`;

    return NextResponse.json({
      success: true,
      duration: `${(duration / 1000).toFixed(1)}s`,

      // === METRIQUES TOTALES ===
      totalMetrics: {
        duration: `${(duration / 1000).toFixed(2)}s`,
        durationMs: duration,
        tokens: totalMetrics.tokens,
        cost: totalMetrics.cost.total,
        costCents: totalMetrics.cost.totalCents,
      },

      params: {
        preset: preset || null,
        cvId,
        jobOfferUrl,
        stopAfter,
        phasesExecuted: results.phases.map(p => p.type),
        availablePresets: Object.keys(TEST_PRESETS),
      },

      sourceCv: {
        filename: sourceCvRecord.filename,
        header: sourceCv.header,
        summary: sourceCv.summary,
        experienceCount: sourceCv.experience?.length || 0,
        experiences: sourceCv.experience?.map((e, i) => ({
          index: i,
          title: e.title,
          company: e.company,
          period: `${e.start_date} - ${e.end_date || 'present'}`,
        })),
        projectCount: sourceCv.projects?.length || 0,
        skills: sourceCv.skills,
        extras: sourceCv.extras,
        education: sourceCv.education,
        languages: sourceCv.languages,
      },

      jobOffer: {
        ...jobOffer,
        fromCache: jobOfferResult.fromCache,
      },

      targetLanguage,

      phases: results.phases,

      // Résultats agrégés si disponibles
      ...(filteredCv && {
        filteredCv: {
          experiencesKept: filteredCv.experiences?.length || 0,
          projectsKept: filteredCv.projects?.length || 0,
          movedToProjects: filteredCv.movedToProjects?.length || 0,
        },
      }),
    });

  } catch (error) {
    console.error('[test-pipeline-v2] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
    }, { status: 500 });
  }
}
