/**
 * Utilitaires pour extraire les noms de fichiers CV depuis les résultats de tâches
 * Garantit une cohérence entre tous les composants de l'onboarding
 */

/**
 * Extrait le nom de fichier CV depuis le résultat d'une tâche
 * @param {object|null} taskResult - Le résultat de la tâche (task.result)
 * @returns {string|null} Le nom du fichier CV, ou null si non trouvé
 */
export function extractCvFilename(taskResult) {
  if (!taskResult) return null;

  // Handle cv_generation format (single filename at root)
  if (taskResult.filename) return taskResult.filename;

  // Handle cv_generation multi-offer format (generatedCvs array)
  if (Array.isArray(taskResult.generatedCvs) && taskResult.generatedCvs.length > 0) {
    return taskResult.generatedCvs[0].filename || null;
  }

  // Handle single file property
  if (taskResult.file) return taskResult.file;

  // Handle files array (some tasks return multiple files)
  if (Array.isArray(taskResult.files) && taskResult.files.length > 0) {
    return taskResult.files[0];
  }

  return null;
}

/**
 * Vérifie si une tâche a généré un CV valide
 * @param {object} task - L'objet tâche complet
 * @returns {boolean} True si la tâche a un CV généré valide
 */
export function taskHasValidCv(task) {
  if (!task || !task.result) return false;
  if (task.status !== 'completed') return false;

  const filename = extractCvFilename(task.result);
  return !!filename;
}
