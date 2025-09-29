const REGISTRY_SYMBOL = Symbol.for('cvSite.backgroundTaskProcessRegistry');

if (!globalThis[REGISTRY_SYMBOL]) {
  globalThis[REGISTRY_SYMBOL] = new Map();
}

function getRegistry() {
  return globalThis[REGISTRY_SYMBOL];
}

export function registerProcess(taskId, childProcess) {
  if (!taskId || !childProcess) {
    return;
  }
  const registry = getRegistry();
  registry.set(taskId, childProcess);
}

export function getRegisteredProcess(taskId) {
  if (!taskId) return undefined;
  return getRegistry().get(taskId);
}

export function clearRegisteredProcess(taskId) {
  if (!taskId) return;
  const registry = getRegistry();
  registry.delete(taskId);
}

export function listRegisteredTaskIds() {
  return Array.from(getRegistry().keys());
}

export async function killRegisteredProcess(taskId, options = {}) {
  const child = getRegisteredProcess(taskId);
  if (!child) {
    return { killed: false, reason: 'not_found' };
  }

  if (child.killed) {
    clearRegisteredProcess(taskId);
    return { killed: false, reason: 'already_killed' };
  }

  const {
    signal = 'SIGTERM',
    forceAfterMs = 5000,
    logger = console
  } = options;

  return new Promise((resolve) => {
    let settled = false;
    let forceTimeout;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (forceTimeout) clearTimeout(forceTimeout);
      child.removeListener('exit', onExit);
      clearRegisteredProcess(taskId);
      resolve(result);
    };

    const onExit = (code, exitSignal) => {
      finish({ killed: true, reason: exitSignal || code === 0 ? 'exited' : 'terminated', code, exitSignal });
    };

    child.once('exit', onExit);

    try {
      const didSend = child.kill(signal);
      if (!didSend) {
        logger.warn?.(`Failed to send ${signal} to process for task ${taskId}`);
      }
    } catch (error) {
      logger.warn?.(`Error while sending ${signal} to task ${taskId}:`, error);
      finish({ killed: false, reason: 'signal_error', error });
      return;
    }

    forceTimeout = setTimeout(() => {
      if (child.killed) {
        finish({ killed: true, reason: 'graceful_timeout' });
        return;
      }

      try {
        const forced = child.kill('SIGKILL');
        if (!forced) {
          logger.warn?.(`Failed to force kill process for task ${taskId}`);
        }
        finish({ killed: true, reason: 'force_killed' });
      } catch (error) {
        logger.error?.(`Error while force killing task ${taskId}:`, error);
        finish({ killed: false, reason: 'force_error', error });
      }
    }, typeof forceAfterMs === 'number' ? forceAfterMs : 5000);
  });
}
