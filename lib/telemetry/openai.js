import prisma from '@/lib/prisma';

/**
 * Track OpenAI API usage (tokens and estimated cost)
 * This function aggregates usage by userId, featureName, model, and date
 *
 * @param {Object} params - Tracking parameters
 * @param {string} params.userId - User ID
 * @param {string} params.featureName - Feature name (generate_cv, match_score, optimize_cv, etc.)
 * @param {string} params.model - OpenAI model used (e.g., "gpt-5-nano-2025-08-07")
 * @param {number} params.promptTokens - Number of prompt tokens used
 * @param {number} params.completionTokens - Number of completion tokens used
 * @param {number} [params.cachedTokens] - Number of cached prompt tokens (optional, default 0)
 * @param {number} [params.duration] - Duration of the API call in milliseconds (optional)
 * @param {string} [params.analysisLevel] - Analysis level (rapid, medium, deep) for features that support it (optional)
 * @returns {Promise<Object>} - Updated usage record with estimated cost
 */
export async function trackOpenAIUsage({
  userId,
  featureName,
  model,
  promptTokens,
  completionTokens,
  cachedTokens = 0,
  duration,
  analysisLevel,
}) {
  try {
    if (!userId || !featureName || !model) {
      console.warn('[OpenAI Telemetry] Missing required parameters:', { userId, featureName, model });
      return null;
    }

    const totalTokens = promptTokens + completionTokens;

    // Get today's date (midnight UTC) for aggregation
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Calculate estimated cost
    const estimatedCost = await calculateCost({
      model,
      promptTokens,
      completionTokens,
      cachedTokens,
    });

    // Prepare metadata if analysisLevel is provided
    let metadata = null;
    if (analysisLevel) {
      metadata = JSON.stringify({ analysisLevel });
    }

    // Store individual call record
    const call = await prisma.openAICall.create({
      data: {
        userId,
        featureName,
        model,
        promptTokens,
        cachedTokens,
        completionTokens,
        totalTokens,
        estimatedCost,
        duration: duration || null,
        metadata,
      },
    });

    // Upsert usage record (aggregate by day)
    const usage = await prisma.openAIUsage.upsert({
      where: {
        userId_featureName_model_date: {
          userId,
          featureName,
          model,
          date: today,
        },
      },
      update: {
        promptTokens: {
          increment: promptTokens,
        },
        cachedTokens: {
          increment: cachedTokens,
        },
        completionTokens: {
          increment: completionTokens,
        },
        totalTokens: {
          increment: totalTokens,
        },
        estimatedCost: {
          increment: estimatedCost,
        },
        callsCount: {
          increment: 1,
        },
      },
      create: {
        userId,
        featureName,
        model,
        date: today,
        promptTokens,
        cachedTokens,
        completionTokens,
        totalTokens,
        estimatedCost,
        callsCount: 1,
      },
    });

    // Check alert thresholds after tracking
    await checkAlertThresholds({ userId, featureName, estimatedCost });

    return usage;
  } catch (error) {
    console.error('[OpenAI Telemetry] Failed to track usage:', error);
    // Don't throw - telemetry failures shouldn't break the app
    return null;
  }
}

/**
 * Calculate the estimated cost for an OpenAI API call
 *
 * @param {Object} params - Cost calculation parameters
 * @param {string} params.model - OpenAI model name
 * @param {number} params.promptTokens - Number of prompt tokens (total, including cached)
 * @param {number} params.completionTokens - Number of completion tokens
 * @param {number} [params.cachedTokens] - Number of cached prompt tokens (optional, default 0)
 * @returns {Promise<number>} - Estimated cost in dollars
 */
export async function calculateCost({
  model,
  promptTokens,
  completionTokens,
  cachedTokens = 0,
}) {
  try {
    // Get pricing for this model
    const pricing = await prisma.openAIPricing.findUnique({
      where: { modelName: model, isActive: true },
    });

    if (!pricing) {
      console.warn(`[OpenAI Telemetry] No pricing found for model: ${model}, using fallback`);
      // Fallback pricing if model not found (conservative estimate)
      // Assume all prompt tokens are non-cached in fallback
      return ((promptTokens * 1.0) + (completionTokens * 4.0)) / 1_000_000;
    }

    // Calculate cost with cache support:
    // - Non-cached prompt tokens: full input price
    // - Cached prompt tokens: reduced cache price
    // - Completion tokens: full output price
    const nonCachedPromptTokens = promptTokens - cachedTokens;
    const inputCost = (nonCachedPromptTokens / 1_000_000) * pricing.inputPricePerMToken;
    const cacheCost = (cachedTokens / 1_000_000) * pricing.cachePricePerMToken;
    const outputCost = (completionTokens / 1_000_000) * pricing.outputPricePerMToken;
    const totalCost = inputCost + cacheCost + outputCost;

    return totalCost;
  } catch (error) {
    console.error('[OpenAI Telemetry] Failed to calculate cost:', error);
    // Return conservative estimate
    return ((promptTokens * 1.0) + (completionTokens * 4.0)) / 1_000_000;
  }
}

/**
 * Check if any alert thresholds have been exceeded
 *
 * @param {Object} params - Alert check parameters
 * @param {string} params.userId - User ID
 * @param {string} params.featureName - Feature name
 * @param {number} params.estimatedCost - Cost of this API call
 * @returns {Promise<void>}
 */
export async function checkAlertThresholds({ userId, featureName, estimatedCost }) {
  try {
    // Get all enabled alerts
    const alerts = await prisma.openAIAlert.findMany({
      where: { enabled: true },
    });

    if (alerts.length === 0) return;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const alert of alerts) {
      let shouldAlert = false;
      let actualValue = 0;

      switch (alert.type) {
        case 'user_daily': {
          // Check user's total cost for today
          const userDailyCost = await prisma.openAIUsage.aggregate({
            where: {
              userId,
              date: today,
            },
            _sum: {
              estimatedCost: true,
            },
          });
          actualValue = userDailyCost._sum.estimatedCost || 0;
          shouldAlert = actualValue > alert.threshold;
          break;
        }

        case 'user_monthly': {
          // Check user's total cost for last 30 days
          const userMonthlyCost = await prisma.openAIUsage.aggregate({
            where: {
              userId,
              date: {
                gte: thirtyDaysAgo,
              },
            },
            _sum: {
              estimatedCost: true,
            },
          });
          actualValue = userMonthlyCost._sum.estimatedCost || 0;
          shouldAlert = actualValue > alert.threshold;
          break;
        }

        case 'global_daily': {
          // Check total cost across all users for today
          const globalDailyCost = await prisma.openAIUsage.aggregate({
            where: {
              date: today,
            },
            _sum: {
              estimatedCost: true,
            },
          });
          actualValue = globalDailyCost._sum.estimatedCost || 0;
          shouldAlert = actualValue > alert.threshold;
          break;
        }

        case 'global_monthly': {
          // Check total cost across all users for last 30 days
          const globalMonthlyCost = await prisma.openAIUsage.aggregate({
            where: {
              date: {
                gte: thirtyDaysAgo,
              },
            },
            _sum: {
              estimatedCost: true,
            },
          });
          actualValue = globalMonthlyCost._sum.estimatedCost || 0;
          shouldAlert = actualValue > alert.threshold;
          break;
        }

        case 'feature_daily': {
          // Check specific feature cost for today (across all users)
          const featureDailyCost = await prisma.openAIUsage.aggregate({
            where: {
              featureName,
              date: today,
            },
            _sum: {
              estimatedCost: true,
            },
          });
          actualValue = featureDailyCost._sum.estimatedCost || 0;
          shouldAlert = actualValue > alert.threshold;
          break;
        }
      }

      if (shouldAlert) {
        console.warn(`[OpenAI Telemetry] Alert triggered: ${alert.name}`, {
          type: alert.type,
          threshold: alert.threshold,
          actualValue,
          userId,
          featureName,
        });

        // TODO: Send notification (email, Slack, etc.)
        // This could be extended to send actual alerts via email/webhook
      }
    }
  } catch (error) {
    console.error('[OpenAI Telemetry] Failed to check alert thresholds:', error);
    // Don't throw - alert failures shouldn't break the app
  }
}

/**
 * Get usage statistics for a user
 *
 * @param {Object} params - Query parameters
 * @param {string} params.userId - User ID
 * @param {Date} [params.startDate] - Start date for the query
 * @param {Date} [params.endDate] - End date for the query
 * @returns {Promise<Object>} - Usage statistics
 */
export async function getUserUsageStats({ userId, startDate, endDate }) {
  try {
    const whereClause = {
      userId,
    };

    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = startDate;
      if (endDate) whereClause.date.lte = endDate;
    }

    const stats = await prisma.openAIUsage.aggregate({
      where: whereClause,
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        estimatedCost: true,
        callsCount: true,
      },
    });

    const byFeature = await prisma.openAIUsage.groupBy({
      by: ['featureName'],
      where: whereClause,
      _sum: {
        estimatedCost: true,
        totalTokens: true,
      },
      orderBy: {
        _sum: {
          estimatedCost: 'desc',
        },
      },
    });

    return {
      totalCost: stats._sum.estimatedCost || 0,
      totalTokens: stats._sum.totalTokens || 0,
      totalCalls: stats._sum.callsCount || 0,
      byFeature,
    };
  } catch (error) {
    console.error('[OpenAI Telemetry] Failed to get user usage stats:', error);
    return null;
  }
}
