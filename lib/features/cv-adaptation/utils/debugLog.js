/**
 * Module utilitaire centralisé pour les logs de debug du pipeline CV
 *
 * Gère la hiérarchie des logs :
 * logs/[timestamp]/
 *   ├── experiences/
 *   ├── skills/
 *   └── summary/
 *
 * Rotation automatique : conserve uniquement les 7 dernières générations
 */

import { promises as fs } from 'fs';
import path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs');
const MAX_GENERATIONS = 7;

/**
 * Types de logs supportés (correspondent aux sous-dossiers)
 */
export const LogType = {
  EXPERIENCES: 'experiences',
  SKILLS: 'skills',
  SUMMARY: 'summary',
};

/**
 * Nettoie les anciennes générations pour ne garder que les MAX_GENERATIONS dernières
 * @param {string} logsDir - Chemin du dossier de logs principal
 */
async function cleanupOldGenerations(logsDir) {
  try {
    const entries = await fs.readdir(logsDir, { withFileTypes: true });

    // Filtrer uniquement les dossiers (pas les fichiers comme .gitkeep)
    const dirs = entries.filter(entry => entry.isDirectory());

    if (dirs.length <= MAX_GENERATIONS) {
      return; // Pas besoin de nettoyer
    }

    // Trier par nom (qui contient le timestamp ISO, donc ordre chronologique)
    const sortedDirs = dirs
      .map(d => d.name)
      .sort(); // Ordre alphabétique = ordre chronologique pour timestamps ISO

    // Supprimer les plus anciennes (garder les MAX_GENERATIONS dernières)
    const toDelete = sortedDirs.slice(0, sortedDirs.length - MAX_GENERATIONS);

    for (const dirName of toDelete) {
      const dirPath = path.join(logsDir, dirName);
      await fs.rm(dirPath, { recursive: true, force: true });
      console.log(`[debugLog] Cleaned up old generation: ${dirName}`);
    }
  } catch (err) {
    // Silencieux - pas critique si le nettoyage échoue
    console.warn(`[debugLog] Cleanup warning: ${err.message}`);
  }
}

/**
 * Écrit un fichier de debug dans la structure centralisée
 *
 * @param {Object} params
 * @param {string} params.type - Type de log (LogType.EXPERIENCES, LogType.SKILLS, LogType.SUMMARY)
 * @param {string} params.filename - Nom du fichier (ex: 'experience_0.md', 'hard_skills.md', 'summary.md')
 * @param {string} params.generationTimestamp - Timestamp de la génération (format: 2026-01-29T17-09-34)
 * @param {string} params.systemPrompt - Prompt système envoyé à l'IA
 * @param {string} params.userPrompt - Prompt utilisateur envoyé à l'IA
 * @param {Object} params.response - Réponse de l'IA
 * @param {number} params.duration - Durée de l'appel en ms
 * @param {string} [params.title] - Titre optionnel pour le header du fichier
 */
export async function writeDebugLog({
  type,
  filename,
  generationTimestamp,
  systemPrompt,
  userPrompt,
  response,
  duration,
  title = 'Debug Log',
}) {
  try {
    // Nettoyer les anciennes générations avant de créer le nouveau dossier
    await cleanupOldGenerations(LOGS_DIR);

    // Créer la structure : logs/[timestamp]/[type]/
    const generationDir = path.join(LOGS_DIR, generationTimestamp, type);
    await fs.mkdir(generationDir, { recursive: true });

    const filepath = path.join(generationDir, filename);

    const content = `# ${title}
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
 * Génère un timestamp formaté pour les logs
 * Format: 2026-01-29T17-09-34 (compatible système de fichiers)
 * @returns {string}
 */
export function generateTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
