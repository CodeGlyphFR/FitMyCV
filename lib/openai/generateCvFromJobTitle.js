import { getOpenAIClient, getModelForAnalysisLevel, checkOpenAICredits } from './client.js';
import { loadPrompt, loadPromptWithVars } from './promptLoader.js';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';
import { promises as fs } from 'fs';
import path from 'path';

async function getCvSchema() {
  const projectRoot = process.cwd();
  const templatePath = path.join(projectRoot, 'data', 'template.json');

  try {
    const content = await fs.readFile(templatePath, 'utf-8');
    console.log(`[generateCvFromJobTitle] Utilisation du template : ${templatePath}`);
    return content;
  } catch (error) {
    console.warn(`[generateCvFromJobTitle] Impossible de lire template.json: ${error.message}`);
  }

  // Fallback: schéma par défaut
  console.log('[generateCvFromJobTitle] Utilisation du schéma par défaut');
  const defaultSchema = {
    generated_at: "",
    header: {
      full_name: "",
      current_title: "",
      contact: {
        email: "",
        phone: "",
        location: { city: "", region: "", country_code: "" },
        links: []
      }
    },
    summary: {
      description: "",
      domains: []
    },
    skills: {
      hard_skills: [],
      soft_skills: [],
      tools: [],
      methodologies: []
    },
    experience: [],
    education: [],
    languages: [],
    projects: [],
    extras: []
  };
  return JSON.stringify(defaultSchema, null, 2);
}

/**
 * Valide si un titre de poste est réel et professionnel
 * @param {string} jobTitle - Le titre de poste à valider
 * @param {string} model - Le modèle GPT à utiliser
 * @param {string} userId - ID de l'utilisateur (pour télémétrie)
 * @returns {Promise<{isValid: boolean, reason?: string}>}
 */
async function validateJobTitle(jobTitle, model, userId = null) {
  console.log('[generateCvFromJobTitle] Validation du titre de poste:', jobTitle);

  const client = getOpenAIClient();

  // Charger les prompts depuis les fichiers .md
  const systemPrompt = await loadPrompt('lib/openai/prompts/validate-job-title/system.md');
  const userPrompt = await loadPromptWithVars('lib/openai/prompts/validate-job-title/user.md', {
    jobTitle: jobTitle
  });

  try {
    const startTime = Date.now();
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_completion_tokens: 50,
    });
    const duration = Date.now() - startTime;

    // Tracking OpenAI usage (validation call - no analysisLevel applicable)
    if (userId && response.usage) {
      await trackOpenAIUsage({
        userId,
        featureName: 'generate_from_job_title',
        model,
        promptTokens: response.usage.prompt_tokens || 0,
        completionTokens: response.usage.completion_tokens || 0,
        cachedTokens: response.usage.prompt_tokens_details?.cached_tokens || 0,
        duration,
      });
    }

    const answer = response.choices[0]?.message?.content?.trim().toUpperCase() || '';
    console.log('[generateCvFromJobTitle] Réponse de validation brute:', answer);
    console.log('[generateCvFromJobTitle] Titre analysé:', jobTitle);

    // Plus permissif : accepte VALIDE ou si la réponse ne contient pas INVALIDE
    const containsValide = answer.includes('VALIDE');
    const containsInvalide = answer.includes('INVALIDE');

    // Si GPT dit VALIDE ou ne dit pas explicitement INVALIDE, on accepte
    const isValid = containsValide || (!containsInvalide && answer.length > 0);

    console.log('[generateCvFromJobTitle] containsValide:', containsValide, 'containsInvalide:', containsInvalide, 'isValid:', isValid);

    return {
      isValid,
      reason: isValid ? null : 'Le titre de poste ne semble pas être un poste professionnel valide'
    };
  } catch (error) {
    console.error('[generateCvFromJobTitle] Erreur lors de la validation:', error);
    throw new Error('Impossible de valider le titre de poste: ' + error.message);
  }
}

/**
 * Génère un CV modèle à partir d'un titre de poste
 * @param {Object} params
 * @param {string} params.jobTitle - Le titre de poste
 * @param {string} params.language - La langue du CV (français, anglais, etc.)
 * @param {string} params.analysisLevel - Le niveau d'analyse (rapid, medium, deep)
 * @param {string} params.requestedModel - Le modèle GPT à utiliser (optionnel)
 * @param {AbortSignal} params.signal - Signal pour annuler la tâche
 * @param {string} params.userId - ID de l'utilisateur (pour télémétrie)
 * @returns {Promise<string>} Le CV généré au format JSON
 */
export async function generateCvFromJobTitle({
  jobTitle,
  language = 'français',
  analysisLevel = 'medium',
  requestedModel = null,
  signal = null,
  userId = null
}) {
  console.log('[generateCvFromJobTitle] Démarrage de la génération de CV pour:', jobTitle);

  if (!jobTitle || typeof jobTitle !== 'string' || !jobTitle.trim()) {
    throw new Error('Titre de poste manquant ou invalide');
  }

  // Vérifier les crédits OpenAI avant l'appel
  console.log('[generateCvFromJobTitle] Vérification des crédits OpenAI...');
  try {
    await checkOpenAICredits();
    console.log('[generateCvFromJobTitle] ✅ Crédits OpenAI disponibles');
  } catch (error) {
    console.error('[generateCvFromJobTitle] ❌ Erreur crédits OpenAI:', error.message);
    throw error;
  }

  const trimmedJobTitle = jobTitle.trim();
  const client = getOpenAIClient();

  // Récupérer le modèle depuis les settings
  const model = await getAiModelSetting('model_generate_from_job_title');

  console.log(`[generateCvFromJobTitle] Modèle GPT utilisé : ${model}`);

  // Vérifier si annulé
  if (signal?.aborted) {
    throw new Error('Task cancelled');
  }

  // Étape 1 : Validation désactivée - on accepte tous les titres
  console.log('[generateCvFromJobTitle] Étape 1/2 : Validation du titre de poste (désactivée - tous les titres acceptés)');
  console.log('[generateCvFromJobTitle] ✓ Titre de poste accepté:', trimmedJobTitle);

  // Vérifier si annulé
  if (signal?.aborted) {
    throw new Error('Task cancelled');
  }

  // Étape 2 : Générer le CV
  console.log('[generateCvFromJobTitle] Étape 2/2 : Génération du CV...');
  const cvSchema = await getCvSchema();

  // Charger les prompts depuis les fichiers .md
  const systemPrompt = await loadPrompt('lib/openai/prompts/generate-from-job-title/system.md');
  const userPrompt = await loadPromptWithVars('lib/openai/prompts/generate-from-job-title/user.md', {
    jobTitle: trimmedJobTitle,
    language: language,
    cvSchema: cvSchema
  });

  try {
    const startTime = Date.now();
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
    });
    const duration = Date.now() - startTime;

    // Vérifier si annulé
    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error('Aucune réponse de GPT');
    }

    // Valider que c'est du JSON valide
    let parsedCV;
    try {
      parsedCV = JSON.parse(rawContent);
    } catch (parseError) {
      console.error('[generateCvFromJobTitle] Erreur de parsing JSON:', parseError);
      throw new Error('La réponse de GPT n\'est pas un JSON valide');
    }

    // Vérifier que le CV contient les champs essentiels
    if (!parsedCV.header?.full_name || !parsedCV.header?.current_title) {
      throw new Error('Le CV généré est incomplet (nom ou titre manquant)');
    }

    console.log('[generateCvFromJobTitle] ✓ CV généré avec succès');

    // Track OpenAI usage only for successful generation
    if (userId && response.usage) {
      try {
        await trackOpenAIUsage({
          userId,
          featureName: 'generate_from_job_title',
          model,
          promptTokens: response.usage.prompt_tokens || 0,
          completionTokens: response.usage.completion_tokens || 0,
          cachedTokens: response.usage.prompt_tokens_details?.cached_tokens || 0,
          duration,
          analysisLevel,
        });
      } catch (trackError) {
        console.error('[generateCvFromJobTitle] Failed to track OpenAI usage:', trackError);
      }
    }

    return JSON.stringify(parsedCV, null, 2);
  } catch (error) {
    console.error('[generateCvFromJobTitle] Erreur lors de la génération:', error);

    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    throw new Error('Impossible de générer le CV: ' + error.message);
  }
}
