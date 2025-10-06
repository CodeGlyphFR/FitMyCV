/**
 * Hook Next.js appelé au démarrage du serveur
 * Nettoie les tâches orphelines (running/queued) au redémarrage
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { cleanupOrphanedTasks } = await import('@/lib/backgroundTasks/cleanupOrphanedTasks');
    await cleanupOrphanedTasks();
  }
}
