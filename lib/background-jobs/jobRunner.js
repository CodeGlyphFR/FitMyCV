/**
 * Framework générique pour exécuter des background jobs
 * Gère: AbortController, vérification pré-run, error handling, télémétrie, cleanup
 *
 * Usage:
 * ```javascript
 * const { schedule, run } = createJobRunner({
 *   name: 'translateCv',
 *   getService: async () => (await import('./service')).translateCv,
 *   prepareInput: async (jobInput, signal) => ({ ... }),
 *   handleResult: async ({ jobInput, result, userId, taskId }) => ({ data: {...}, trackingData: {...} }),
 *   trackSuccess: async ({ userId, deviceId, duration, ...trackingData }) => { ... },
 *   trackError: async ({ userId, deviceId, duration, error }) => { ... },
 * });
 * ```
 */

import prisma from "@/lib/prisma";
import { enqueueJob } from "@/lib/background-jobs/jobQueue";
import { registerAbortController, clearRegisteredProcess } from "@/lib/background-jobs/processRegistry";
import { updateBackgroundTask } from "@/lib/events/prismaWithEvents";
import { refundFeatureUsage } from "@/lib/subscription/featureUsage";

/**
 * @typedef {Object} JobConfig
 * @property {string} name - Nom du job pour les logs (ex: 'translateCv')
 * @property {Function} getService - Fonction async qui retourne le service à appeler
 * @property {Function} prepareInput - (jobInput, signal) => params pour le service
 * @property {Function} handleResult - ({ jobInput, result, userId, taskId, abortController }) => { data, trackingData, successMessage? }
 * @property {Function} trackSuccess - ({ userId, deviceId, duration, ...trackingData }) => void
 * @property {Function} trackError - ({ userId, deviceId, duration, error, ...trackingData }) => void
 * @property {Function} [beforeRun] - Hook optionnel avant exécution du service
 * @property {Function} [afterRun] - Hook optionnel après handleResult
 * @property {Function} [cleanup] - Fonction de nettoyage (fichiers temp, etc.)
 * @property {Function} [onCancellation] - Hook optionnel lors d'une annulation
 */

/**
 * Crée les fonctions schedule et run pour un job
 * @param {JobConfig} config
 * @returns {{ schedule: Function, run: Function }}
 */
export function createJobRunner(config) {
  const {
    name,
    getService,
    prepareInput,
    handleResult,
    trackSuccess,
    trackError,
    beforeRun,
    afterRun,
    cleanup,
    onCancellation,
  } = config;

  async function run(jobInput) {
    const { taskId, user, deviceId } = jobInput;
    const userId = user.id;
    const startTime = Date.now();

    console.log(`[${name}Job] starting job ${taskId} for user ${userId}`);

    // 1. Vérification pré-run
    try {
      const record = await prisma.backgroundTask.findUnique({ where: { id: taskId } });
      if (!record || record.status === 'cancelled') {
        console.log(`[${name}Job] Task ${taskId} already cancelled or not found, skipping`);
        await cleanup?.(jobInput);
        return;
      }
    } catch (error) {
      console.warn(`[${name}Job] Impossible de vérifier la tâche ${taskId} avant démarrage`, error);
    }

    // 2. Setup AbortController
    const abortController = new AbortController();
    registerAbortController(taskId, abortController);

    await updateBackgroundTask(taskId, userId, {
      status: 'running',
      error: null,
      deviceId,
    });

    // 3. Before run hook
    try {
      await beforeRun?.(jobInput, abortController);
    } catch (error) {
      await handleJobError({
        name, taskId, userId, deviceId, startTime, error,
        abortController, trackError, cleanup, jobInput,
      });
      return;
    }

    // 4. Vérifier annulation
    if (abortController.signal.aborted) {
      await handleCancellation({ name, taskId, userId, cleanup, jobInput, onCancellation });
      return;
    }

    // 5. Exécuter le service
    let result;
    try {
      const service = await getService();
      const serviceParams = await prepareInput(jobInput, abortController.signal);
      result = await service(serviceParams);

      if (abortController.signal.aborted) {
        throw new Error('Task cancelled');
      }
    } catch (error) {
      await handleJobError({
        name, taskId, userId, deviceId, startTime, error,
        abortController, trackError, cleanup, jobInput,
      });
      return;
    }

    // 6. Traiter le résultat
    try {
      const finalResult = await handleResult({
        jobInput,
        result,
        userId,
        taskId,
        abortController,
      });

      // 7. After run hook
      await afterRun?.(jobInput, result, finalResult);

      // 8. Track success
      const duration = Date.now() - startTime;
      try {
        await trackSuccess({
          userId,
          deviceId: deviceId || null,
          duration,
          ...(finalResult.trackingData || {}),
        });
      } catch (trackErr) {
        console.error(`[${name}Job] Erreur tracking télémétrie:`, trackErr);
      }

      // 9. Cleanup et completion
      await cleanup?.(jobInput);
      clearRegisteredProcess(taskId);

      await updateBackgroundTask(taskId, userId, {
        status: 'completed',
        result: JSON.stringify(finalResult.data),
        error: null,
        ...(finalResult.successMessage && { successMessage: finalResult.successMessage }),
      });

      console.log(`[${name}Job] Job ${taskId} completed successfully`);

    } catch (error) {
      await handleJobError({
        name, taskId, userId, deviceId, startTime, error,
        abortController, trackError, cleanup, jobInput,
      });
    }
  }

  function schedule(jobInput) {
    enqueueJob(() => run(jobInput));
  }

  return { schedule, run };
}

// ============================================================================
// Helper functions
// ============================================================================

async function handleCancellation({ name, taskId, userId, cleanup, jobInput, onCancellation }) {
  console.log(`[${name}Job] Tâche ${taskId} annulée`);

  await refundFeatureUsage(taskId);
  await onCancellation?.(jobInput);
  await cleanup?.(jobInput);
  clearRegisteredProcess(taskId);

  await updateBackgroundTask(taskId, userId, {
    status: 'cancelled',
    result: null,
    error: null,
  });
}

async function handleJobError({
  name, taskId, userId, deviceId, startTime, error,
  abortController, trackError, cleanup, jobInput,
}) {
  await cleanup?.(jobInput);
  clearRegisteredProcess(taskId);

  // Gestion de l'annulation
  if (error.message === 'Task cancelled' || abortController.signal.aborted) {
    console.log(`[${name}Job] Tâche ${taskId} annulée`);
    await refundFeatureUsage(taskId);
    await updateBackgroundTask(taskId, userId, {
      status: 'cancelled',
      result: null,
      error: null,
    });
    return;
  }

  console.error(`[${name}Job] Erreur pour la tâche ${taskId}:`, error);
  console.error(`[${name}Job] Stack trace:`, error.stack);

  const isQuotaExceeded = error.message && /insufficient_quota|exceeded your current quota/i.test(error.message);
  const errorMessage = isQuotaExceeded
    ? "Quota OpenAI dépassé. Vérifiez votre facturation."
    : (error.message || `Échec lors de l'exécution du job ${name}`);

  await refundFeatureUsage(taskId);
  await updateBackgroundTask(taskId, userId, {
    status: 'failed',
    result: null,
    error: errorMessage,
  });

  // Track error
  const duration = Date.now() - startTime;
  try {
    await trackError({
      userId,
      deviceId: deviceId || null,
      duration,
      status: 'error',
      error: errorMessage,
    });
  } catch (trackErr) {
    console.error(`[${name}Job] Erreur tracking télémétrie:`, trackErr);
  }
}
