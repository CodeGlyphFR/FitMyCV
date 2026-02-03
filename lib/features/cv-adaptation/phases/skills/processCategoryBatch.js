/**
 * Traitement d'une catégorie de skills par l'IA
 *
 * Ce module exécute l'appel IA pour une catégorie donnée et retourne
 * les correspondances brutes (matches). Le code appelant déterminera
 * ensuite les actions à partir des scores.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { getOpenAIClient, addTemperatureIfSupported, isReasoningModel } from '@/lib/openai-core/client';
import { getAiModelSetting } from '@/lib/settings/aiModels';

const PROMPTS_DIR = path.join(process.cwd(), 'lib/features/cv-adaptation/prompts');
const SCHEMAS_DIR = path.join(process.cwd(), 'lib/features/cv-adaptation/schemas');
const DEBUG_DIR = path.join(process.cwd(), 'logs/skills-debug');

/**
 * Mapping des codes ISO de langue vers leurs noms complets
 * Pour renforcer l'instruction de langue dans le prompt
 */
const LANGUAGE_NAMES = {
  en: 'anglais',
  fr: 'francais',
  de: 'allemand',
  es: 'espagnol',
  it: 'italien',
  pt: 'portugais',
  nl: 'neerlandais',
};

/**
 * Noms d'affichage des catégories pour les prompts
 */
const CATEGORY_DISPLAY_NAMES = {
  hard_skills: 'Hard Skills (Competences techniques)',
  soft_skills: 'Soft Skills (Competences comportementales)',
  tools: 'Outils et Technologies',
  methodologies: 'Methodologies et Frameworks',
};

/**
 * Noms des types d'éléments pour les prompts (dynamique)
 */
const ELEM_TYPE_NAMES = {
  hard_skills: 'compétences techniques',
  soft_skills: 'compétences humaines',
  tools: 'outils',
  methodologies: 'méthodologies',
};

/**
 * Convertit un code ISO de langue en nom complet
 * @param {string} code - Code ISO (en, fr, de, etc.)
 * @returns {string} - Nom complet de la langue
 */
function getLanguageName(code) {
  return LANGUAGE_NAMES[code] || code;
}

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
 * Formate un tableau pour le prompt (retourne "[]" si vide ou undefined)
 * @param {Array} arr - Tableau à formater
 * @returns {string} - JSON stringifié
 */
function formatJsonArray(arr) {
  if (!arr || arr.length === 0) {
    return '[]';
  }
  return JSON.stringify(arr, null, 2);
}

/**
 * Écrit les prompts et réponse IA dans un fichier de debug
 * @param {string} category - Nom de la catégorie
 * @param {string} systemPrompt - Prompt système envoyé
 * @param {string} userPrompt - Prompt utilisateur envoyé
 * @param {Object} response - Réponse de l'IA
 * @param {number} duration - Durée de l'appel en ms
 * @param {string} generationTimestamp - Timestamp unique de la génération (nom du sous-dossier)
 */
async function writeDebugLog(category, systemPrompt, userPrompt, response, duration, generationTimestamp) {
  try {
    // Créer le dossier de génération
    const generationDir = path.join(DEBUG_DIR, generationTimestamp);
    await fs.mkdir(generationDir, { recursive: true });

    // Nom de fichier simplifié (juste la catégorie)
    const filename = `${category}.md`;
    const filepath = path.join(generationDir, filename);

    const content = `# Debug Skills Batch: ${category}
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
 * Exécute le traitement IA pour une catégorie de skills
 *
 * @param {Object} params
 * @param {string} params.category - Nom de la catégorie (hard_skills, soft_skills, tools, methodologies)
 * @param {Array} params.preparedItems - Items préparés par prepareSkillItems
 * @param {boolean} params.hasProficiency - true si la catégorie a des proficiency
 * @param {Object} params.jobOfferSkills - Skills de l'offre {required, niceToHave}
 * @param {string} params.cvLanguage - Code langue du CV (fr, en, etc.)
 * @param {string} params.jobLanguage - Code langue de l'offre
 * @param {string} params.interfaceLanguage - Code langue de l'interface
 * @param {string} params.generationTimestamp - Timestamp unique de la génération (pour le dossier de logs)
 * @param {AbortSignal} params.signal - Signal d'annulation
 * @returns {Promise<Object>} { matches: Array, tokens: {prompt, completion}, duration }
 */
export async function processCategoryBatch({
  category,
  preparedItems,
  hasProficiency,
  jobOfferSkills,
  cvLanguage,
  jobLanguage,
  interfaceLanguage,
  generationTimestamp,
  signal = null,
}) {
  const startTime = Date.now();

  // Si la catégorie est vide, retourner un résultat vide
  if (!preparedItems || preparedItems.length === 0) {
    return {
      matches: [],
      tokens: { prompt: 0, completion: 0 },
      duration: 0,
    };
  }

  try {
    const model = await getAiModelSetting('model_cv_batch_skills');
    const systemPromptTemplate = await loadPrompt('skills-category-system.md');
    const userPromptTemplate = await loadPrompt('skills-category-user.md');
    const schema = await loadSchema('skillsMatchSchema.json');

    // Toujours envoyer uniquement les noms (pas de proficiency dans le prompt)
    const cvItemsForAI = preparedItems.map(item => item.name);

    // Fusionner les skills de l'offre en une seule liste
    const allJobItems = [
      ...(jobOfferSkills.required || []),
      ...(jobOfferSkills.niceToHave || []),
    ];

    // Appliquer les variables au system prompt
    const systemPrompt = replaceVariables(systemPromptTemplate, {
      elemType: ELEM_TYPE_NAMES[category] || 'éléments',
      cvLanguage: getLanguageName(cvLanguage),
      jobLanguage: getLanguageName(jobLanguage),
    });

    // Construire le user prompt avec les variables
    const userPrompt = replaceVariables(userPromptTemplate, {
      categoryDisplayName: CATEGORY_DISPLAY_NAMES[category] || category,
      cvItemsJson: formatJsonArray(cvItemsForAI),
      jobItemsJson: formatJsonArray(allJobItems),
      cvLanguage: getLanguageName(cvLanguage),
      jobLanguage: getLanguageName(jobLanguage),
      interfaceLanguage: getLanguageName(interfaceLanguage),
      skillCount: preparedItems.length.toString(),
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
    requestOptions = addTemperatureIfSupported(requestOptions, 0.2);
    // Ajouter max_completion_tokens uniquement pour les modèles de raisonnement
    // (les modèles classiques utilisent la valeur par défaut d'OpenAI)
    if (isReasoningModel(model)) {
      requestOptions.max_completion_tokens = 16000;
    }

    const fetchOptions = signal ? { signal } : {};
    const response = await client.chat.completions.create(requestOptions, fetchOptions);

    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    const duration = Date.now() - startTime;
    const content = response.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error(`No content in OpenAI response for category ${category}`);
    }

    const result = JSON.parse(content);

    // Écrire le fichier de debug
    await writeDebugLog(category, systemPrompt, userPrompt, result, duration, generationTimestamp);

    return {
      matches: result.matches || [],
      tokens: {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
        cached: response.usage?.prompt_tokens_details?.cached_tokens || 0,
      },
      duration,
      model,
    };
  } catch (error) {
    // Propager l'erreur pour permettre l'annulation de la tâche et le remboursement des crédits
    // L'erreur sera catchée par executeBatchSkills qui mettra la subtask en failed
    throw error;
  }
}
