import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  TASK_TYPE_TO_FEATURES,
  DEFAULT_DURATIONS,
  MIN_CALLS_FOR_AVERAGE,
  getDefaultDuration,
} from '@/lib/backgroundTasks/taskFeatureMapping';

/**
 * GET /api/telemetry/average-task-duration
 *
 * Retourne la durée moyenne estimée pour un type de tâche donné
 * basée sur les données de télémétrie (OpenAICall).
 *
 * Query params:
 * - taskType (required): Type de tâche (generation, import-pdf, etc.)
 * - model (optional): Modèle OpenAI utilisé
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskType = searchParams.get('taskType');
    const model = searchParams.get('model');

    if (!taskType) {
      return NextResponse.json(
        { success: false, error: 'taskType parameter is required' },
        { status: 400 }
      );
    }

    // Récupérer les featureNames associés au type de tâche
    const featureNames = TASK_TYPE_TO_FEATURES[taskType];

    if (!featureNames || featureNames.length === 0) {
      // Type de tâche inconnu, retourner durée par défaut
      return NextResponse.json({
        success: true,
        estimatedDuration: getDefaultDuration(taskType),
        callCount: 0,
        hasData: false,
        source: 'default',
      });
    }

    // Construire les conditions de requête
    const whereCondition = {
      featureName: { in: featureNames },
      duration: { not: null },
    };

    // Filtrer par modèle si spécifié
    if (model) {
      whereCondition.model = model;
    }

    // Récupérer les 10 derniers calls pour calculer la moyenne
    // Limite à 10 pour performance quand il y aura beaucoup de données
    const recentCalls = await prisma.openAICall.findMany({
      where: whereCondition,
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { duration: true },
    });

    const callCount = recentCalls.length;
    const averageDuration = callCount > 0
      ? recentCalls.reduce((sum, call) => sum + call.duration, 0) / callCount
      : null;

    // Utiliser la moyenne télémétrie si assez de données, sinon défaut
    const hasEnoughData = callCount >= MIN_CALLS_FOR_AVERAGE;
    const estimatedDuration = hasEnoughData && averageDuration
      ? Math.round(averageDuration)
      : DEFAULT_DURATIONS[taskType] || 30000;

    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[average-task-duration] taskType=${taskType}, ` +
        `avg=${averageDuration}ms, count=${callCount}, ` +
        `using=${hasEnoughData ? 'telemetry' : 'default'} (${estimatedDuration}ms)`
      );
    }

    return NextResponse.json({
      success: true,
      estimatedDuration,
      callCount,
      hasData: hasEnoughData,
      source: hasEnoughData ? 'telemetry' : 'default',
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[average-task-duration] Error:', error);
    }

    // En cas d'erreur, retourner une durée par défaut générique
    return NextResponse.json({
      success: true,
      estimatedDuration: 30000,
      callCount: 0,
      hasData: false,
      source: 'error_fallback',
    });
  }
}
