import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { killRegisteredProcess } from '@/lib/backgroundTasks/processRegistry';
import { updateCvFile } from '@/lib/events/prismaWithEvents';

const MAX_PERSISTED_TASKS = 100;
const MAX_RETURNED_TASKS = 150;

const LAST_WIPE_SYMBOL = Symbol.for('cvSite.backgroundTasksLastFullSync');
if (!globalThis[LAST_WIPE_SYMBOL]) {
  globalThis[LAST_WIPE_SYMBOL] = new Map();
}

function getFullSyncCache() {
  return globalThis[LAST_WIPE_SYMBOL];
}
function toNumberTimestamp(value, fallback = Date.now()) {
  const num = Number(value);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return fallback;
  }
  return num;
}

function serializeTask(record) {
  const base = {
    id: record.id,
    title: record.title,
    successMessage: record.successMessage ?? null,
    type: record.type,
    status: record.status,
    createdAt: Number(record.createdAt),
    shouldUpdateCvList: record.shouldUpdateCvList ?? false,
    deviceId: record.deviceId ?? null,
    error: record.error ?? null,
    updatedAt: record.updatedAt?.getTime?.() ?? Date.now(),
    cvFile: record.cvFile ?? null,
  };

  if (record.result) {
    try {
      base.result = JSON.parse(record.result);
    } catch (_error) {
      base.result = record.result;
    }
  } else {
    base.result = null;
  }

  if (record.payload) {
    try {
      base.payload = JSON.parse(record.payload);
    } catch (_error) {
      base.payload = record.payload;
    }
  } else {
    base.payload = null;
  }

  return base;
}

function sanitiseStatus(status) {
  const allowed = new Set(['queued', 'running', 'completed', 'failed', 'cancelled']);
  return allowed.has(status) ? status : 'queued';
}

function buildUpdatePayload(task, deviceId) {
  const payload = {
    title: task.title ?? '',
    successMessage: task.successMessage ?? null,
    type: task.type ?? 'unknown',
    status: sanitiseStatus(task.status),
    shouldUpdateCvList: Boolean(task.shouldUpdateCvList),
    deviceId: deviceId ?? 'unknown-device',
  };

  if (Object.prototype.hasOwnProperty.call(task, 'result')) {
    payload.result = task.result == null ? null : JSON.stringify(task.result);
  }

  if (Object.prototype.hasOwnProperty.call(task, 'error')) {
    payload.error = task.error == null ? null : String(task.error);
  }

  if (Object.prototype.hasOwnProperty.call(task, 'payload')) {
    if (task.payload == null) {
      payload.payload = null;
    } else if (typeof task.payload === 'string') {
      payload.payload = task.payload;
    } else {
      try {
        payload.payload = JSON.stringify(task.payload);
      } catch (_error) {
        payload.payload = String(task.payload);
      }
    }
  }

  return payload;
}

export async function GET(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId') || undefined;
    const since = searchParams.get('since');
    const taskId = searchParams.get('taskId');
    const action = searchParams.get('action');

    if (taskId && action === 'check') {
      const task = await prisma.backgroundTask.findFirst({
        where: { id: taskId, userId: session.user.id },
      });

      return NextResponse.json({
        success: true,
        task: task ? serializeTask(task) : null,
        timestamp: Date.now(),
      });
    }

    const cache = getFullSyncCache();
    const lastKnown = cache.get(session.user.id) || 0;
    const whereClause = { userId: session.user.id };
    const sinceValue = since ? toNumberTimestamp(since, 0) : 0;
    const hasIncrementalFilter = Boolean(since && sinceValue > 0 && sinceValue >= lastKnown);

    if (hasIncrementalFilter) {
      whereClause.updatedAt = { gt: new Date(sinceValue) };
    }

    // Return most recent tasks, capped to avoid unbounded payloads
    const tasks = await prisma.backgroundTask.findMany({
      where: whereClause,
      orderBy: [
        { createdAt: 'desc' },
        { updatedAt: 'desc' },
      ],
      take: MAX_RETURNED_TASKS,
    });

    const serialized = tasks.map(serializeTask);

    return NextResponse.json({
      success: true,
      deviceId,
      tasks: serialized,
      timestamp: Date.now(),
      syncType: hasIncrementalFilter ? 'incremental' : 'full',
    });
  } catch (error) {
    console.error('Error fetching background tasks:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { tasks: incomingTasks, deviceId } = body || {};

    if (!Array.isArray(incomingTasks) || !incomingTasks.length) {
      return NextResponse.json(
        { success: false, error: 'No tasks provided' },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const processedIds = [];

    const operations = incomingTasks.map(async (task) => {
      if (!task?.id) {
        return;
      }

      const existing = await prisma.backgroundTask.findUnique({ where: { id: task.id } });
      const updatePayload = buildUpdatePayload(task, deviceId);

      if (existing) {
        if (existing.userId !== userId) {
          return;
        }
        await prisma.backgroundTask.update({
          where: { id: task.id },
          data: updatePayload,
        });

        // Si une tâche est annulée, réinitialiser les statuts du CV
        if (task.status === 'cancelled' && existing.status !== 'cancelled') {
          console.log(`[sync] Tâche ${task.id} (${existing.type}) passée à 'cancelled'`);

          // Ne rembourser le token que si la tâche était en attente ou en cours
          const shouldRefundToken = existing.status === 'queued' || existing.status === 'running';

          try {
            const payload = existing.payload ? JSON.parse(existing.payload) : null;
            const cvFile = payload?.cvFile;

            console.log(`[sync] Payload cvFile:`, cvFile);

            if (cvFile) {
              if (existing.type === 'improve-cv') {
                // Réinitialiser optimiseStatus
                await prisma.cvFile.update({
                  where: { userId_filename: { userId, filename: cvFile } },
                  data: { optimiseStatus: 'idle', optimiseUpdatedAt: new Date() }
                });
                console.log(`[sync] ✅ optimiseStatus → idle pour ${cvFile}`);
              } else if (existing.type === 'calculate-match-score') {
                // Réinitialiser matchScoreStatus
                await prisma.cvFile.update({
                  where: { userId_filename: { userId, filename: cvFile } },
                  data: { matchScoreStatus: 'idle' }
                });
                console.log(`[sync] ✅ matchScoreStatus → idle pour ${cvFile}`);
              }
            } else {
              console.warn(`[sync] ⚠️ Pas de cvFile dans le payload pour ${task.id}`);
            }

            // Rembourser le token pour les tâches qui consomment des tokens
            if (shouldRefundToken && (existing.type === 'job-title-generation' || existing.type === 'calculate-match-score')) {
              const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { matchScoreRefreshCount: true }
              });

              // Incrémenter le compteur de 1 - Ne JAMAIS toucher à matchScoreFirstRefreshAt
              // Ne PAS limiter à TOKEN_LIMIT pour ne pas "voler" des tokens en cas de bug
              const newCount = (user?.matchScoreRefreshCount || 0) + 1;

              await prisma.user.update({
                where: { id: userId },
                data: { matchScoreRefreshCount: newCount }
              });

              console.log(`[sync] ✅ Token remboursé pour ${existing.type} (${newCount})`);
            }
          } catch (err) {
            console.error('[sync] ❌ Erreur réinitialisation statuts CV:', err);
          }
        }
      } else {
        await prisma.backgroundTask.create({
          data: {
            id: task.id,
            userId,
            createdAt: BigInt(task.createdAt ?? Date.now()),
            ...updatePayload,
          },
        });
      }
      processedIds.push(task.id);
    });

    await Promise.all(operations);

    // Keep task history bounded per user
    const totalTasks = await prisma.backgroundTask.count({ where: { userId } });
    if (totalTasks > MAX_PERSISTED_TASKS) {
      const excess = totalTasks - MAX_PERSISTED_TASKS;
      const oldest = await prisma.backgroundTask.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        take: excess,
        select: { id: true },
      });
      if (oldest.length) {
        await prisma.backgroundTask.deleteMany({
          where: {
            id: { in: oldest.map((entry) => entry.id) },
            userId,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      synced: processedIds.length,
      processedIds,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error syncing background tasks:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sync tasks' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const action = searchParams.get('action');

    if (action === 'deleteCompleted') {
      const body = await request.json().catch(() => ({}));
      const taskIds = Array.isArray(body?.taskIds) ? body.taskIds : [];

      if (!taskIds.length) {
        return NextResponse.json(
          { success: false, error: 'Task IDs array required' },
          { status: 400 }
        );
      }

      const result = await prisma.backgroundTask.deleteMany({
        where: {
          id: { in: taskIds },
          userId,
        },
      });

      if (result.count > 0) {
        const cache = getFullSyncCache();
        cache.set(userId, Date.now());
      }

      return NextResponse.json({
        success: true,
        deleted: result.count,
        timestamp: Date.now(),
      });
    }

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: 'Task ID required' },
        { status: 400 }
      );
    }

    if (action === 'cancel') {
      // Récupérer la tâche pour savoir quel CV elle concerne
      const task = await prisma.backgroundTask.findUnique({
        where: { id: taskId },
        select: { type: true, cvFile: true, userId: true, status: true }
      });

      // Ne rembourser le token que si la tâche était en attente ou en cours (pas déjà terminée)
      const shouldRefundToken = task && (task.status === 'queued' || task.status === 'running');

      const updateResult = await prisma.backgroundTask.updateMany({
        where: { id: taskId, userId },
        data: {
          status: 'cancelled',
          error: null,
        },
      });

      let killedProcesses = null;
      if (updateResult.count > 0) {
        try {
          const killResult = await killRegisteredProcess(taskId, { logger: console });
          killedProcesses = killResult;
        } catch (killError) {
          console.warn(`Failed to terminate process for task ${taskId}:`, killError);
        }

        // Si c'est une tâche d'optimisation, remettre le optimiseStatus du CV à 'idle'
        if (task?.type === 'improve-cv' && task.cvFile && task.userId === userId) {
          try {
            await updateCvFile(userId, task.cvFile, {
              optimiseStatus: 'idle',
              optimiseUpdatedAt: new Date()
            });
            console.log(`[cancel] ✅ optimiseStatus remis à 'idle' pour ${task.cvFile}`);
          } catch (error) {
            console.error(`[cancel] ❌ Erreur mise à jour optimiseStatus:`, error);
          }
        }

        // Si c'est une tâche de calcul de score, remettre le matchScoreStatus du CV à 'idle'
        if (task?.type === 'calculate-match-score' && task.cvFile && task.userId === userId) {
          try {
            await updateCvFile(userId, task.cvFile, {
              matchScoreStatus: 'idle',
              matchScoreUpdatedAt: new Date()
            });
            console.log(`[cancel] ✅ matchScoreStatus remis à 'idle' pour ${task.cvFile}`);
          } catch (error) {
            console.error(`[cancel] ❌ Erreur mise à jour matchScoreStatus:`, error);
          }
        }

        // Rembourser le token pour les tâches qui consomment des tokens
        if (shouldRefundToken && (task.type === 'job-title-generation' || task.type === 'calculate-match-score')) {
          try {
            // Récupérer le compteur actuel de l'utilisateur
            const user = await prisma.user.findUnique({
              where: { id: userId },
              select: { matchScoreRefreshCount: true }
            });

            // Incrémenter le compteur de 1 - Ne JAMAIS toucher à matchScoreFirstRefreshAt
            // Ne PAS limiter à TOKEN_LIMIT pour ne pas "voler" des tokens en cas de bug
            const newCount = (user?.matchScoreRefreshCount || 0) + 1;

            await prisma.user.update({
              where: { id: userId },
              data: { matchScoreRefreshCount: newCount }
            });

            console.log(`[cancel] ✅ Token remboursé pour ${task.type} (${newCount})`);
          } catch (error) {
            console.error(`[cancel] ❌ Erreur remboursement token:`, error);
          }
        }
      }

      return NextResponse.json({
        success: updateResult.count > 0,
        cancelled: updateResult.count > 0,
        killInfo: killedProcesses,
        timestamp: Date.now(),
      });
    }

    const deleteResult = await prisma.backgroundTask.deleteMany({
      where: { id: taskId, userId },
    });

    let killInfo = null;
    if (deleteResult.count > 0) {
      try {
        killInfo = await killRegisteredProcess(taskId, { logger: console });
      } catch (killError) {
        console.warn(`Failed to terminate process while deleting task ${taskId}:`, killError);
      }
    }

    return NextResponse.json({
      success: true,
      deleted: deleteResult.count > 0,
      killInfo,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error processing background task deletion:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process task' },
      { status: 500 }
    );
  }
}
