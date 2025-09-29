const MAX_CONCURRENT_JOBS = 3;

const jobQueue = [];
let activeJobs = 0;

function processQueue() {
  if (activeJobs >= MAX_CONCURRENT_JOBS) {
    return;
  }
  const nextJob = jobQueue.shift();
  if (!nextJob) {
    return;
  }

  activeJobs += 1;

  try {
    const jobResult = nextJob();

    Promise.resolve(jobResult)
      .catch((error) => {
        console.error('[backgroundTasks] job failed:', error);
      })
      .finally(() => {
        activeJobs -= 1;
        setImmediate(processQueue);
      });
  } catch (error) {
    activeJobs -= 1;
    console.error('[backgroundTasks] unexpected error while running job:', error);
    setImmediate(processQueue);
  }
}

export function enqueueJob(jobRunner) {
  jobQueue.push(jobRunner);
  processQueue();
}

export function getQueueSnapshot() {
  return {
    pending: jobQueue.length,
    active: activeJobs,
    max: MAX_CONCURRENT_JOBS,
  };
}
