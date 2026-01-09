const MAX_CONCURRENT_JOBS = 3;
const MAX_CONCURRENT_TASK_TYPES = 3;

const jobQueue = [];
let activeJobs = 0;

// Map<userId, Set<taskType>> - Track active task types per user
const activeTaskTypes = new Map();

function processQueue() {
  if (activeJobs >= MAX_CONCURRENT_JOBS) {
    return;
  }
  const nextJob = jobQueue.shift();
  if (!nextJob) {
    return;
  }

  activeJobs += 1;

  try {
    const jobResult = nextJob();

    Promise.resolve(jobResult)
      .catch((error) => {
        console.error('[backgroundTasks] job failed:', error);
      })
      .finally(() => {
        activeJobs -= 1;
        setImmediate(processQueue);
      });
  } catch (error) {
    activeJobs -= 1;
    console.error('[backgroundTasks] unexpected error while running job:', error);
    setImmediate(processQueue);
  }
}

export function enqueueJob(jobRunner) {
  jobQueue.push(jobRunner);
  processQueue();
}

export function getQueueSnapshot() {
  return {
    pending: jobQueue.length,
    active: activeJobs,
    max: MAX_CONCURRENT_JOBS,
  };
}

/**
 * Vérifie si un type de tâche peut démarrer pour un utilisateur
 *
 * Règles:
 * - Un seul type de tâche identique à la fois par utilisateur
 * - Maximum 3 types de tâches différents en parallèle par utilisateur
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} taskType - Type de tâche (cv_generation, pdf_import, cv_translation, etc.)
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function canStartTaskType(userId, taskType) {
  const userTypes = activeTaskTypes.get(userId);

  // Pas de tâches actives pour cet utilisateur
  if (!userTypes || userTypes.size === 0) {
    return { allowed: true };
  }

  // Vérifier si ce type est déjà en cours
  if (userTypes.has(taskType)) {
    return {
      allowed: false,
      reason: 'task_type_already_running',
      message: `Une tâche de type "${taskType}" est déjà en cours`
    };
  }

  // Vérifier la limite de types concurrents
  if (userTypes.size >= MAX_CONCURRENT_TASK_TYPES) {
    return {
      allowed: false,
      reason: 'max_concurrent_types_reached',
      message: `Maximum ${MAX_CONCURRENT_TASK_TYPES} types de tâches différents en parallèle`
    };
  }

  return { allowed: true };
}

/**
 * Enregistre le démarrage d'un type de tâche pour un utilisateur
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} taskType - Type de tâche
 */
export function registerTaskTypeStart(userId, taskType) {
  if (!activeTaskTypes.has(userId)) {
    activeTaskTypes.set(userId, new Set());
  }
  activeTaskTypes.get(userId).add(taskType);
}

/**
 * Enregistre la fin d'un type de tâche pour un utilisateur
 * Libère le slot pour qu'une nouvelle tâche de ce type puisse démarrer
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} taskType - Type de tâche
 */
export function registerTaskTypeEnd(userId, taskType) {
  const userTypes = activeTaskTypes.get(userId);
  if (userTypes) {
    userTypes.delete(taskType);
    // Nettoyer si plus de types actifs
    if (userTypes.size === 0) {
      activeTaskTypes.delete(userId);
    }
  }
}

/**
 * Récupère les types de tâches actifs pour un utilisateur
 *
 * @param {string} userId - ID de l'utilisateur
 * @returns {string[]} Liste des types de tâches actifs
 */
export function getActiveTaskTypes(userId) {
  const userTypes = activeTaskTypes.get(userId);
  return userTypes ? Array.from(userTypes) : [];
}
