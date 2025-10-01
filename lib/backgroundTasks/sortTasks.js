export function sortTasksForDisplay(taskList) {
  if (!Array.isArray(taskList)) {
    return [];
  }

  const STATUS_PRIORITY = {
    running: 0,
    queued: 1,
    failed: 1,
    cancelled: 1,
    completed: 1,
  };

  return [...taskList].sort((a, b) => {
    // Priorité 1 : Trier par statut (running en premier, tout le reste pareil)
    const priorityA = STATUS_PRIORITY[a?.status] ?? 99;
    const priorityB = STATUS_PRIORITY[b?.status] ?? 99;
    const priorityDiff = priorityA - priorityB;
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    // Priorité 2 : Trier par date (plus récent en premier)
    const aCreatedAt = typeof a?.createdAt === 'number' ? a.createdAt : 0;
    const bCreatedAt = typeof b?.createdAt === 'number' ? b.createdAt : 0;

    return bCreatedAt - aCreatedAt;
  });
}
