import prisma from "@/lib/prisma";
import { enqueueJob } from "@/lib/backgroundTasks/jobQueue";

export function scheduleTestJob(jobInput) {
  enqueueJob(() => runTestJob(jobInput));
}

async function runTestJob({ taskId, userId, deviceId, duration = 5000, shouldFail = false }) {
  console.log(`[testJob] starting job ${taskId} for user ${userId}`);

  try {
    await prisma.backgroundTask.updateMany({
      where: { id: taskId, userId },
      data: {
        status: 'running',
        error: null,
        deviceId,
      },
    });
  } catch (error) {
    console.warn(`Impossible de mettre à jour la tâche ${taskId}`, error);
  }

  // Simulation de travail
  await new Promise(resolve => setTimeout(resolve, duration));

  if (shouldFail) {
    try {
      await prisma.backgroundTask.updateMany({
        where: { id: taskId, userId },
        data: {
          status: 'failed',
          error: 'Échec simulé',
        },
      });
    } catch (error) {
      console.warn(`Impossible de mettre à jour la tâche ${taskId}`, error);
    }
    return;
  }

  try {
    await prisma.backgroundTask.updateMany({
      where: { id: taskId, userId },
      data: {
        status: 'completed',
        result: JSON.stringify({ success: true, duration }),
        error: null,
      },
    });
  } catch (error) {
    console.warn(`Impossible de mettre à jour la tâche ${taskId}`, error);
  }

  console.log(`[testJob] job ${taskId} completed`);
}
