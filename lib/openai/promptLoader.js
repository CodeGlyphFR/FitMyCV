import { promises as fs } from 'fs';
import path from 'path';

const PROMPTS_DIR = path.join(process.cwd(), 'lib/openai/prompts');

// Cache en mémoire pour performance (surtout en production)
const cache = {};

/**
 * Charge un prompt depuis un fichier .md
 * @param {string} promptPath - Chemin relatif (ex: "scoring/system.md") OU absolu depuis cwd (ex: "lib/openai/prompts/scoring/system.md")
 * @param {boolean} useCache - Utiliser le cache (défaut: true en prod, false en dev)
 * @returns {Promise<string>} - Contenu du prompt
 */
export async function loadPrompt(promptPath, useCache = process.env.NODE_ENV === 'production') {
  if (useCache && cache[promptPath]) {
    console.log(`[promptLoader] ✅ Cache hit: ${promptPath}`);
    return cache[promptPath];
  }

  // Si le chemin commence par 'lib/openai/prompts/', utiliser depuis cwd
  // Sinon, utiliser PROMPTS_DIR
  let fullPath;
  if (promptPath.startsWith('lib/openai/prompts/')) {
    fullPath = path.join(process.cwd(), promptPath);
  } else {
    fullPath = path.join(PROMPTS_DIR, promptPath);
  }

  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    const trimmed = content.trim();

    if (useCache) {
      cache[promptPath] = trimmed;
      console.log(`[promptLoader] 📥 Cached: ${promptPath}`);
    } else {
      console.log(`[promptLoader] 📖 Loaded (no cache): ${promptPath}`);
    }

    return trimmed;
  } catch (error) {
    console.error(`[promptLoader] ❌ Erreur chargement prompt: ${fullPath}`, error);
    throw new Error(`Prompt introuvable: ${fullPath}`);
  }
}

/**
 * Charge un prompt avec remplacement de variables
 * @param {string} promptPath - Chemin du prompt
 * @param {Object} variables - Variables à remplacer {placeholder: value}
 * @returns {Promise<string>}
 *
 * @example
 * await loadPromptWithVars('scoring/user.md', {
 *   cvContent: '...',
 *   jobOfferContent: '...'
 * });
 */
export async function loadPromptWithVars(promptPath, variables = {}) {
  let prompt = await loadPrompt(promptPath);

  // Remplacer les placeholders {variable}
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    prompt = prompt.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  }

  return prompt;
}

/**
 * Vide le cache (utile en dev pour hot-reload)
 */
export function clearPromptCache() {
  const keys = Object.keys(cache);
  keys.forEach(key => delete cache[key]);
  console.log(`[promptLoader] 🗑️ Cache vidé (${keys.length} entrées)`);
}

/**
 * Affiche les statistiques du cache
 */
export function getPromptCacheStats() {
  return {
    entries: Object.keys(cache).length,
    prompts: Object.keys(cache)
  };
}
