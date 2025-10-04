import prisma from './lib/prisma.js';

/**
 * Hook Next.js appelé au démarrage du serveur
 * Nettoie les tâches orphelines (running/queued) au redémarrage
 */
export async function register() {
  // Uniquement côté serveur
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      console.log('[instrumentation] Nettoyage des tâches orphelines au démarrage...');

      // Récupérer toutes les tâches en cours ou en attente
      const orphanedTasks = await prisma.backgroundTask.findMany({
        where: {
          status: {
            in: ['running', 'queued']
          }
        }
      });

      if (orphanedTasks.length > 0) {
        console.log(`[instrumentation] ${orphanedTasks.length} tâche(s) orpheline(s) détectée(s)`);

        // Repasser toutes les tâches orphelines en statut failed
        const result = await prisma.backgroundTask.updateMany({
          where: {
            status: {
              in: ['running', 'queued']
            }
          },
          data: {
            status: 'failed',
            error: 'Le serveur a redémarré pendant l\'exécution de cette tâche'
          }
        });

        console.log(`[instrumentation] ${result.count} tâche(s) marquée(s) comme échouée(s)`);
      } else {
        console.log('[instrumentation] Aucune tâche orpheline détectée');
      }
    } catch (error) {
      console.error('[instrumentation] Erreur lors du nettoyage des tâches orphelines:', error);
    }
  }
}
