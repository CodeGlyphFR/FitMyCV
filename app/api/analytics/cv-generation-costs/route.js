import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics/cv-generation-costs
 * Retrieve CV generation costs grouped by generation task (admin only)
 *
 * Returns aggregated costs for each CV generation, with detailed breakdown
 * by subtask (classify, batch_experience, batch_project, etc.)
 *
 * Query params:
 * - period: '24h', '7d', '30d', 'all' (default: '30d')
 * - limit: number of tasks to return (default: 50)
 */
export async function GET(request) {
  try {
    // Check authentication and admin role
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case '24h':
        startDate.setHours(now.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case 'all':
        startDate = new Date(0);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Get CV generation tasks with their offers and subtasks (only completed ones)
    const tasks = await prisma.cvGenerationTask.findMany({
      where: {
        createdAt: {
          gte: startDate,
        },
        status: 'completed',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        offers: {
          include: {
            subtasks: {
              orderBy: {
                createdAt: 'asc',
              },
              select: {
                id: true,
                type: true,
                itemIndex: true,
                status: true,
                modelUsed: true,
                promptTokens: true,
                cachedTokens: true,
                completionTokens: true,
                estimatedCost: true,
                durationMs: true,
                createdAt: true,
                completedAt: true,
              },
            },
          },
        },
      },
    });

    // Process and aggregate data
    const generations = tasks.map(task => {
      // Aggregate all subtasks from all offers
      const allSubtasks = task.offers.flatMap(offer => offer.subtasks);

      // Calculate totals
      const totalPromptTokens = allSubtasks.reduce((sum, s) => sum + (s.promptTokens || 0), 0);
      const totalCachedTokens = allSubtasks.reduce((sum, s) => sum + (s.cachedTokens || 0), 0);
      const totalCompletionTokens = allSubtasks.reduce((sum, s) => sum + (s.completionTokens || 0), 0);
      const totalCost = allSubtasks.reduce((sum, s) => sum + (s.estimatedCost || 0), 0);

      // Calculate real duration accounting for parallel execution
      // Pipeline structure:
      // - Phase 0.5: classify (sequential)
      // - Phase 1: batch_experience, batch_project, batch_extras (parallel)
      // - Phase 2: batch_skills, batch_summary (parallel)
      // - Phase 3: recompose (sequential)
      const getMaxDurationByType = (type) => {
        const subtasksOfType = allSubtasks.filter(s => s.type === type);
        if (subtasksOfType.length === 0) return 0;
        return Math.max(...subtasksOfType.map(s => s.durationMs || 0));
      };

      const classifyDuration = getMaxDurationByType('classify');
      const phase1Duration = Math.max(
        getMaxDurationByType('batch_experience'),
        getMaxDurationByType('batch_project'),
        getMaxDurationByType('batch_extras')
      );
      const phase2Duration = Math.max(
        getMaxDurationByType('batch_skills'),
        getMaxDurationByType('batch_summary')
      );
      const recomposeDuration = getMaxDurationByType('recompose');

      const totalDurationMs = classifyDuration + phase1Duration + phase2Duration + recomposeDuration;
      const summedDurationMs = allSubtasks.reduce((sum, s) => sum + (s.durationMs || 0), 0);

      // Group subtasks by type for summary
      const subtasksByType = {};
      for (const subtask of allSubtasks) {
        const type = subtask.type;
        if (!subtasksByType[type]) {
          subtasksByType[type] = {
            type,
            count: 0,
            promptTokens: 0,
            cachedTokens: 0,
            completionTokens: 0,
            estimatedCost: 0,
            durationMs: 0,
            models: new Set(),
          };
        }
        subtasksByType[type].count++;
        subtasksByType[type].promptTokens += subtask.promptTokens || 0;
        subtasksByType[type].cachedTokens += subtask.cachedTokens || 0;
        subtasksByType[type].completionTokens += subtask.completionTokens || 0;
        subtasksByType[type].estimatedCost += subtask.estimatedCost || 0;
        subtasksByType[type].durationMs += subtask.durationMs || 0;
        if (subtask.modelUsed) {
          subtasksByType[type].models.add(subtask.modelUsed);
        }
      }

      // Convert Set to array for models
      const subtaskSummary = Object.values(subtasksByType).map(s => ({
        ...s,
        models: Array.from(s.models),
      }));

      // Sort subtasks by type for consistent display
      const typeOrder = [
        'classify',
        'batch_experience',
        'batch_project',
        'batch_extras',
        'batch_skills',
        'batch_summary',
        'recompose',
        'recompose_languages',
      ];
      subtaskSummary.sort((a, b) => {
        const aIndex = typeOrder.indexOf(a.type);
        const bIndex = typeOrder.indexOf(b.type);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      });

      return {
        taskId: task.id,
        userId: task.userId,
        user: task.user,
        mode: task.mode,
        status: task.status,
        totalOffers: task.totalOffers,
        completedOffers: task.completedOffers,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        // Cost summary
        totals: {
          promptTokens: totalPromptTokens,
          cachedTokens: totalCachedTokens,
          completionTokens: totalCompletionTokens,
          totalTokens: totalPromptTokens + totalCompletionTokens,
          estimatedCost: totalCost,
          durationMs: totalDurationMs, // Real duration accounting for parallel execution
          summedDurationMs, // Sum of all individual durations (for reference)
          subtaskCount: allSubtasks.length,
        },
        // Breakdown by subtask type
        subtaskSummary,
        // Individual subtasks (for detailed view)
        subtasks: allSubtasks.map(s => ({
          id: s.id,
          type: s.type,
          itemIndex: s.itemIndex,
          status: s.status,
          modelUsed: s.modelUsed,
          promptTokens: s.promptTokens,
          cachedTokens: s.cachedTokens,
          completionTokens: s.completionTokens,
          estimatedCost: s.estimatedCost,
          durationMs: s.durationMs,
          createdAt: s.createdAt,
          completedAt: s.completedAt,
        })),
      };
    });

    // Calculate global aggregates
    const totalStats = {
      generationCount: generations.length,
      totalCost: generations.reduce((sum, g) => sum + g.totals.estimatedCost, 0),
      totalPromptTokens: generations.reduce((sum, g) => sum + g.totals.promptTokens, 0),
      totalCachedTokens: generations.reduce((sum, g) => sum + g.totals.cachedTokens, 0),
      totalCompletionTokens: generations.reduce((sum, g) => sum + g.totals.completionTokens, 0),
      totalDurationMs: generations.reduce((sum, g) => sum + g.totals.durationMs, 0),
      totalSubtasks: generations.reduce((sum, g) => sum + g.totals.subtaskCount, 0),
      avgCostPerGeneration: generations.length > 0
        ? generations.reduce((sum, g) => sum + g.totals.estimatedCost, 0) / generations.length
        : 0,
      avgDurationPerGeneration: generations.length > 0
        ? generations.reduce((sum, g) => sum + g.totals.durationMs, 0) / generations.length
        : 0,
    };

    return NextResponse.json({
      period,
      startDate,
      endDate: now,
      totals: totalStats,
      generations,
    });
  } catch (error) {
    console.error('[API /analytics/cv-generation-costs] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
