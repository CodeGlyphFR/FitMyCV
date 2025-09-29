export function sortTasksForDisplay(taskList) {
  if (!Array.isArray(taskList)) {
    return [];
  }

  const getPriority = (status) => {
    if (status === 'running') {
      return 0;
    }
    return 1;
  };

  return [...taskList].sort((a, b) => {
    const priorityDiff = getPriority(a?.status) - getPriority(b?.status);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const aCreatedAt = typeof a?.createdAt === 'number' ? a.createdAt : 0;
    const bCreatedAt = typeof b?.createdAt === 'number' ? b.createdAt : 0;

    return bCreatedAt - aCreatedAt;
  });
}
