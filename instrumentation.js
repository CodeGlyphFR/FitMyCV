export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { cleanupOrphanedTasks } = await import('@/lib/backgroundTasks/cleanupOrphanedTasks');
    await cleanupOrphanedTasks();
  }
}
