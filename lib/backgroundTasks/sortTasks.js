export function sortTasksForDisplay(taskList) {
  if (!Array.isArray(taskList)) {
    return [];
  }

  const STATUS_PRIORITY = {
    running: 0,
    queued: 1,
    failed: 2,
    cancelled: 2,
    completed: 3,
  };

  return [...taskList].sort((a, b) => {
    const priorityA = STATUS_PRIORITY[a?.status] ?? 99;
    const priorityB = STATUS_PRIORITY[b?.status] ?? 99;
    const priorityDiff = priorityA - priorityB;
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const aCreatedAt = typeof a?.createdAt === 'number' ? a.createdAt : 0;
    const bCreatedAt = typeof b?.createdAt === 'number' ? b.createdAt : 0;

    return bCreatedAt - aCreatedAt;
  });
}
