import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { getStartOfDayUTC, getUserMonthlyPeriod, getStartOfMonthUTC } from '@/lib/analytics/dateHelpers';

// Mark route as dynamic since it uses auth() which accesses headers
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/openai-alerts/triggered
 * Returns all triggered alerts (where current value >= threshold)
 */
export async function GET(req) {
  try {
    const session = await auth();

    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 403 }
      );
    }

    // Get all enabled alerts
    const alerts = await prisma.openAIAlert.findMany({
      where: { enabled: true },
    });

    if (alerts.length === 0) {
      return NextResponse.json({
        triggeredAlerts: [],
        totalTriggered: 0,
        byType: {},
      });
    }

    // Date calculations using shared utility
    const today = getStartOfDayUTC();
    const monthStart = getStartOfMonthUTC();

    const triggeredAlerts = [];
    const byType = {};

    // Check each alert
    for (const alert of alerts) {
      let actualValue = 0;
      let affectedUsers = [];
      let isTriggered = false;

      switch (alert.type) {
        case 'user_daily': {
          // Find all users who exceeded daily limit (today 0:00 to 23:59)
          const userCosts = await prisma.openAIUsage.groupBy({
            by: ['userId'],
            where: {
              date: today,
            },
            _sum: {
              estimatedCost: true,
            },
            having: {
              estimatedCost: {
                _sum: {
                  gte: alert.threshold,
                },
              },
            },
          });

          if (userCosts.length > 0) {
            isTriggered = true;
            // Get user details
            const userIds = userCosts.map(u => u.userId);
            const users = await prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, email: true, name: true },
            });

            affectedUsers = userCosts.map(uc => {
              const user = users.find(u => u.id === uc.userId);
              return {
                userId: uc.userId,
                email: user?.email || 'Unknown',
                name: user?.name || null,
                cost: uc._sum.estimatedCost || 0,
                exceeded: (uc._sum.estimatedCost || 0) - alert.threshold,
              };
            });

            // Calculate highest cost as actualValue
            actualValue = Math.max(...affectedUsers.map(u => u.cost));
          }
          break;
        }

        case 'user_monthly': {
          // Find all users who exceeded monthly limit
          // HYBRID logic: Uses Stripe billing period if available, otherwise calendar month

          // Get ALL users (with and without subscriptions)
          const allUsers = await prisma.user.findMany({
            select: {
              id: true,
              email: true,
              name: true,
            },
          });

          // Group users by monthly period type (Stripe vs Calendar)
          const periodGroups = new Map();

          for (const user of allUsers) {
            const monthlyPeriod = await getUserMonthlyPeriod(user.id);
            if (!monthlyPeriod) continue;

            const periodKey = `${monthlyPeriod.start.getTime()}-${monthlyPeriod.end.getTime()}`;

            if (!periodGroups.has(periodKey)) {
              periodGroups.set(periodKey, {
                start: monthlyPeriod.start,
                end: monthlyPeriod.end,
                type: monthlyPeriod.type,
                users: [],
              });
            }
            periodGroups.get(periodKey).users.push(user);
          }

          // Query usage for each period group (batched by period)
          for (const [periodKey, group] of periodGroups) {
            const userIds = group.users.map(u => u.id);

            // Single query for all users in this monthly period
            const userCosts = await prisma.openAIUsage.groupBy({
              by: ['userId'],
              where: {
                userId: { in: userIds },
                date: {
                  gte: group.start,
                  lte: group.end,
                },
              },
              _sum: {
                estimatedCost: true,
              },
              having: {
                estimatedCost: {
                  _sum: {
                    gte: alert.threshold,
                  },
                },
              },
            });

            // Process results
            for (const uc of userCosts) {
              const user = group.users.find(u => u.id === uc.userId);
              if (!user) continue;

              const cost = uc._sum.estimatedCost || 0;

              isTriggered = true;
              affectedUsers.push({
                userId: user.id,
                email: user.email,
                name: user.name || null,
                cost,
                exceeded: cost - alert.threshold,
                billingType: group.type, // 'stripe' or 'calendar'
              });
            }
          }

          if (affectedUsers.length > 0) {
            // Calculate highest cost as actualValue
            actualValue = Math.max(...affectedUsers.map(u => u.cost));
          }
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
          isTriggered = actualValue >= alert.threshold;
          break;
        }

        case 'global_monthly': {
          // Check total cost across all users for calendar month
          const globalMonthlyCost = await prisma.openAIUsage.aggregate({
            where: {
              date: {
                gte: monthStart,
              },
            },
            _sum: {
              estimatedCost: true,
            },
          });
          actualValue = globalMonthlyCost._sum.estimatedCost || 0;
          isTriggered = actualValue >= alert.threshold;
          break;
        }

        case 'feature_daily': {
          // Check each feature's cost for today
          const featureCosts = await prisma.openAIUsage.groupBy({
            by: ['featureName'],
            where: {
              date: today,
            },
            _sum: {
              estimatedCost: true,
            },
            having: {
              estimatedCost: {
                _sum: {
                  gte: alert.threshold,
                },
              },
            },
          });

          if (featureCosts.length > 0) {
            isTriggered = true;
            affectedUsers = featureCosts.map(fc => ({
              featureName: fc.featureName,
              cost: fc._sum.estimatedCost || 0,
              exceeded: (fc._sum.estimatedCost || 0) - alert.threshold,
            }));
            actualValue = Math.max(...featureCosts.map(f => f._sum.estimatedCost || 0));
          }
          break;
        }
      }

      // If alert is triggered, add to results
      if (isTriggered) {
        const exceeded = actualValue - alert.threshold;
        const exceededPercentage = ((exceeded / alert.threshold) * 100).toFixed(1);

        triggeredAlerts.push({
          id: alert.id,
          name: alert.name,
          description: alert.description,
          type: alert.type,
          threshold: alert.threshold,
          actualValue,
          exceeded,
          exceededPercentage: parseFloat(exceededPercentage),
          affectedUsers,
        });

        // Count by type
        byType[alert.type] = (byType[alert.type] || 0) + 1;
      }
    }

    return NextResponse.json({
      triggeredAlerts,
      totalTriggered: triggeredAlerts.length,
      byType,
    });

  } catch (error) {
    console.error('[API /admin/openai-alerts/triggered GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
