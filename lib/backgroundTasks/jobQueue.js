const MAX_CONCURRENT_JOBS = 3;
const MAX_CONCURRENT_TASK_TYPES = 3;
const MAX_CV_GENERATION_PER_USER = 3;

const jobQueue = [];
let activeJobs = 0;

// Map<userId, Map<taskType, count>> - Track active task types per user with count
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
 * - Pour cv_generation: max 3 simultanées par utilisateur
 * - Autres types: un seul à la fois par utilisateur
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

  // Pour cv_generation: permettre plusieurs avec limite
  if (taskType === 'cv_generation') {
    const currentCount = userTypes.get('cv_generation') || 0;
    if (currentCount >= MAX_CV_GENERATION_PER_USER) {
      return {
        allowed: false,
        reason: 'max_cv_generation_reached',
        message: `Maximum ${MAX_CV_GENERATION_PER_USER} générations CV simultanées`
      };
    }
    return { allowed: true };
  }

  // Autres types: comportement existant (1 seul à la fois)
  const currentCount = userTypes.get(taskType) || 0;
  if (currentCount > 0) {
    return {
      allowed: false,
      reason: 'task_type_already_running',
      message: `Une tâche de type "${taskType}" est déjà en cours`
    };
  }

  // Vérifier la limite de types concurrents (types avec count > 0)
  const activeTypesCount = [...userTypes.values()].filter(c => c > 0).length;
  if (activeTypesCount >= MAX_CONCURRENT_TASK_TYPES) {
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
 * Incrémente le compteur pour ce type de tâche
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} taskType - Type de tâche
 */
export function registerTaskTypeStart(userId, taskType) {
  if (!activeTaskTypes.has(userId)) {
    activeTaskTypes.set(userId, new Map());
  }
  const userTypes = activeTaskTypes.get(userId);
  userTypes.set(taskType, (userTypes.get(taskType) || 0) + 1);
}

/**
 * Enregistre la fin d'un type de tâche pour un utilisateur
 * Décrémente le compteur pour ce type de tâche
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} taskType - Type de tâche
 */
export function registerTaskTypeEnd(userId, taskType) {
  const userTypes = activeTaskTypes.get(userId);
  if (userTypes && userTypes.has(taskType)) {
    const current = userTypes.get(taskType);
    if (current <= 1) {
      userTypes.delete(taskType);
    } else {
      userTypes.set(taskType, current - 1);
    }
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
  return userTypes ? Array.from(userTypes.keys()) : [];
}
