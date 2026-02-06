import prisma from '@/lib/prisma';

/**
 * Nettoie les tâches orphelines au redémarrage du serveur
 * - Met les BackgroundTask 'running' et 'queued' en 'failed'
 * - Remet les CvFile avec matchScoreStatus/optimiseStatus 'inprogress' à 'idle'
 */
export async function cleanupOrphanedTasks() {
  try {
    // 1. Nettoyer les BackgroundTask orphelines (running ou queued)
    const orphanedTasks = await prisma.backgroundTask.updateMany({
      where: {
        status: {
          in: ['running', 'queued']
        }
      },
      data: {
        status: 'failed',
        error: 'Tâche interrompue par le redémarrage du serveur'
      }
    });

    // 2. Nettoyer les CvFile avec matchScoreStatus en 'inprogress'
    const orphanedMatchScores = await prisma.cvFile.updateMany({
      where: {
        matchScoreStatus: 'inprogress'
      },
      data: {
        matchScoreStatus: 'idle'
      }
    });

    // 3. Nettoyer les CvFile avec optimiseStatus en 'inprogress'
    const orphanedOptimisations = await prisma.cvFile.updateMany({
      where: {
        optimiseStatus: 'inprogress'
      },
      data: {
        optimiseStatus: 'idle'
      }
    });

  } catch (error) {
    // Erreur silencieuse lors du nettoyage
  }
}
