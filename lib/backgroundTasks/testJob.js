import prisma from "@/lib/prisma";
import { enqueueJob } from "@/lib/backgroundTasks/jobQueue";

async function updateBackgroundTask(taskId, userId, data) {
  if (!taskId) return;
  try {
    await prisma.backgroundTask.updateMany({
      where: { id: taskId, userId },
      data,
    });
  } catch (error) {
    console.warn(`Impossible de mettre à jour la tâche ${taskId}`, error);
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function scheduleTestJob({ taskId, userId, deviceId, duration = 4000, shouldFail = false }) {
  enqueueJob(async () => {
    await updateBackgroundTask(taskId, userId, {
      status: 'running',
      error: null,
      deviceId,
    });

    try {
      await wait(duration);

      if (shouldFail) {
        throw new Error('Test job failure requested');
      }

      await updateBackgroundTask(taskId, userId, {
        status: 'completed',
        result: JSON.stringify({ ok: true, completedAt: Date.now() }),
        error: null,
      });
    } catch (error) {
      const message = error?.message || 'Test job failed';
      await updateBackgroundTask(taskId, userId, {
        status: shouldFail ? 'failed' : 'cancelled',
        result: null,
        error: shouldFail ? message : null,
      });
    }

    if (process.env.NODE_ENV !== 'test') {
      console.log(`[testJob] completed ${taskId} for user ${userId}`);
      globalThis.dispatchEvent?.(new Event("cv:list:changed"));
    }
  });
}
