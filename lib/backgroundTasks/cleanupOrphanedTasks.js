import prisma from '@/lib/prisma';

/**
 * Nettoie les tâches orphelines au redémarrage du serveur
 * - Met les BackgroundTask 'running' et 'queued' en 'failed'
 * - Remet les CvFile avec matchScoreStatus/optimiseStatus 'inprogress' à 'idle'
 */
export async function cleanupOrphanedTasks() {
  try {
    console.log('[cleanupOrphanedTasks] Démarrage du nettoyage des tâches orphelines...');

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

    if (orphanedTasks.count > 0) {
      console.log(`[cleanupOrphanedTasks] ${orphanedTasks.count} tâche(s) orpheline(s) marquée(s) comme échouée(s)`);
    }

    // 2. Nettoyer les CvFile avec matchScoreStatus en 'inprogress'
    const orphanedMatchScores = await prisma.cvFile.updateMany({
      where: {
        matchScoreStatus: 'inprogress'
      },
      data: {
        matchScoreStatus: 'idle'
      }
    });

    if (orphanedMatchScores.count > 0) {
      console.log(`[cleanupOrphanedTasks] ${orphanedMatchScores.count} CV avec calcul de score interrompu réinitialisé(s)`);
    }

    // 3. Nettoyer les CvFile avec optimiseStatus en 'inprogress'
    const orphanedOptimisations = await prisma.cvFile.updateMany({
      where: {
        optimiseStatus: 'inprogress'
      },
      data: {
        optimiseStatus: 'idle'
      }
    });

    if (orphanedOptimisations.count > 0) {
      console.log(`[cleanupOrphanedTasks] ${orphanedOptimisations.count} CV avec optimisation interrompue réinitialisé(s)`);
    }

    const total = orphanedTasks.count + orphanedMatchScores.count + orphanedOptimisations.count;
    if (total === 0) {
      console.log('[cleanupOrphanedTasks] Aucune tâche orpheline détectée');
    } else {
      console.log(`[cleanupOrphanedTasks] Nettoyage terminé: ${total} élément(s) nettoyé(s)`);
    }

  } catch (error) {
    console.error('[cleanupOrphanedTasks] Erreur lors du nettoyage des tâches orphelines:', error);
  }
}
