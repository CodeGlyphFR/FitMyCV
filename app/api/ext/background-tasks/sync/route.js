/**
 * GET /api/ext/background-tasks/sync
 *
 * Extension proxy for task polling. Same logic as /api/background-tasks/sync GET.
 */

import { NextResponse } from 'next/server';
import { withExtensionAuth } from '@/lib/api/withExtensionAuth';
import prisma from '@/lib/prisma';
import { killRegisteredProcess } from '@/lib/background-jobs/processRegistry';
import { refundCredit } from '@/lib/subscription/credits';

const MAX_RETURNED_TASKS = 150;

function toNumberTimestamp(value, fallback = Date.now()) {
  const num = Number(value);
  if (Number.isNaN(num) || !Number.isFinite(num)) return fallback;
  return num;
}

function extractSourceUrl(record) {
  if (!record.payload) return null;
  try {
    const p = JSON.parse(record.payload);
    return p.url || null;
  } catch { return null; }
}

function serializeTask(record, phaseInfo) {
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
    currentPhase: phaseInfo?.offerStatus || null,
    currentStep: phaseInfo?.currentStep || null,
    sourceUrl: extractSourceUrl(record),
  };

  if (record.result) {
    try { base.result = JSON.parse(record.result); } catch { base.result = record.result; }
  } else {
    base.result = null;
  }

  if (record.payload) {
    try { base.payload = JSON.parse(record.payload); } catch { base.payload = record.payload; }
  } else {
    base.payload = null;
  }

  return base;
}

export const GET = withExtensionAuth(async (request, { userId }) => {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId') || undefined;
    const since = searchParams.get('since');
    const taskId = searchParams.get('taskId');
    const action = searchParams.get('action');

    // Single task check
    if (taskId && action === 'check') {
      const task = await prisma.backgroundTask.findFirst({
        where: { id: taskId, userId },
      });

      let phaseInfo = null;
      if (task) {
        const offer = await prisma.cvGenerationOffer.findFirst({
          where: { taskId: task.id },
          select: {
            status: true,
            subtasks: {
              where: { status: 'running' },
              select: { type: true },
              take: 1,
            },
          },
        });
        if (offer) {
          phaseInfo = {
            offerStatus: offer.status,
            currentStep: offer.subtasks[0]?.type || null,
          };
        }
      }

      return NextResponse.json({
        success: true,
        task: task ? serializeTask(task, phaseInfo) : null,
        timestamp: Date.now(),
      });
    }

    const sinceValue = since ? toNumberTimestamp(since, 0) : 0;
    const hasIncrementalFilter = Boolean(since && sinceValue > 0);

    let tasks;
    if (hasIncrementalFilter) {
      // Two queries: recently updated tasks + still-active tasks (whose phases
      // may have changed in CvGenerationOffer without touching BackgroundTask.updatedAt)
      const ACTIVE_STATUSES = ['queued', 'running'];
      const [changed, active] = await Promise.all([
        prisma.backgroundTask.findMany({
          where: { userId, updatedAt: { gt: new Date(sinceValue) } },
          orderBy: [{ createdAt: 'desc' }, { updatedAt: 'desc' }],
          take: MAX_RETURNED_TASKS,
        }),
        prisma.backgroundTask.findMany({
          where: { userId, status: { in: ACTIVE_STATUSES } },
          orderBy: [{ createdAt: 'desc' }],
          take: 50,
        }),
      ]);
      // Deduplicate
      const seen = new Set();
      tasks = [];
      for (const t of [...changed, ...active]) {
        if (!seen.has(t.id)) { seen.add(t.id); tasks.push(t); }
      }
    } else {
      tasks = await prisma.backgroundTask.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { updatedAt: 'desc' }],
        take: MAX_RETURNED_TASKS,
      });
    }

    // Enrich cv_generation tasks with phase info from CvGenerationOffer/Subtask
    const cvTaskIds = tasks
      .filter(t => t.type === 'cv_generation' && t.status !== 'completed' && t.status !== 'failed' && t.status !== 'cancelled')
      .map(t => t.id);

    const phaseMap = new Map();
    if (cvTaskIds.length > 0) {
      const offerPhases = await prisma.cvGenerationOffer.findMany({
        where: { taskId: { in: cvTaskIds } },
        select: {
          taskId: true,
          status: true,
          subtasks: {
            where: { status: 'running' },
            select: { type: true },
            take: 1,
          },
        },
      });
      for (const offer of offerPhases) {
        phaseMap.set(offer.taskId, {
          offerStatus: offer.status,
          currentStep: offer.subtasks[0]?.type || null,
        });
      }
    }

    return NextResponse.json({
      success: true,
      deviceId,
      tasks: tasks.map(t => serializeTask(t, phaseMap.get(t.id))),
      timestamp: Date.now(),
      syncType: hasIncrementalFilter ? 'incremental' : 'full',
    });
  } catch (error) {
    console.error('[ext/sync] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
});

export const DELETE = withExtensionAuth(async (request, { userId }) => {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const action = searchParams.get('action');

    if (!taskId || action !== 'cancel') {
      return NextResponse.json(
        { success: false, error: 'taskId and action=cancel required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const task = await prisma.backgroundTask.findFirst({
      where: { id: taskId, userId },
      select: { type: true, cvFile: true, status: true },
    });

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      );
    }

    const shouldRefund = task.status === 'queued' || task.status === 'running';

    // Refund all credits associated with this task
    let refundResult = null;
    let totalRefunded = 0;
    if (shouldRefund) {
      const creditTransactions = await prisma.creditTransaction.findMany({
        where: {
          taskId,
          userId,
          amount: { lt: 0 },
          refunded: false,
        },
      });

      for (const creditTransaction of creditTransactions) {
        const result = await refundCredit(userId, creditTransaction.id, 'Annulation de tâche (extension)');
        if (result.success) {
          totalRefunded += Math.abs(result.transaction?.amount || 0);
          refundResult = result;
        }
      }
      if (totalRefunded > 0) {
        console.log(`[ext/cancel] ${totalRefunded} credit(s) refunded for task ${taskId}`);
      }
    }

    // Update status to cancelled
    const updateResult = await prisma.backgroundTask.updateMany({
      where: { id: taskId, userId },
      data: { status: 'cancelled', error: null },
    });

    // Kill running process
    let killInfo = null;
    if (updateResult.count > 0) {
      try {
        killInfo = await killRegisteredProcess(taskId, { logger: console });
      } catch (err) {
        console.warn(`[ext/cancel] Failed to kill process for task ${taskId}:`, err);
      }
    }

    return NextResponse.json({
      success: updateResult.count > 0,
      cancelled: updateResult.count > 0,
      killInfo,
      refunded: totalRefunded > 0,
      refundedAmount: totalRefunded,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[ext/cancel] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel task' },
      { status: 500 }
    );
  }
});
