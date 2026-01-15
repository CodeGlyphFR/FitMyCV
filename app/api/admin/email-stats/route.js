import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

// Limite SMTP OVH: 200 emails par heure
const SMTP_HOURLY_LIMIT = 200;

/**
 * GET /api/admin/email-stats
 * Get email statistics for the last 24 hours
 * Returns:
 *   - currentHour: SMTP usage for the current hour vs limit
 *   - timeline: Hourly breakdown for the last 24 hours
 *   - summary: Total sent, failed, failure rate
 */
export async function GET(request) {
  try {
    const session = await auth();

    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Start of current hour (for current hour stats)
    const currentHourStart = new Date(now);
    currentHourStart.setMinutes(0, 0, 0);

    // Fetch all logs from the last 24 hours (excluding test emails)
    const logs = await prisma.emailLog.findMany({
      where: {
        createdAt: {
          gte: twentyFourHoursAgo,
        },
        isTestEmail: false,
      },
      select: {
        createdAt: true,
        provider: true,
        status: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Initialize hourly data for the last 24 hours
    const hourlyData = {};
    for (let i = 23; i >= 0; i--) {
      const hourDate = new Date(now.getTime() - i * 60 * 60 * 1000);
      hourDate.setMinutes(0, 0, 0);
      const hourKey = hourDate.toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
      hourlyData[hourKey] = {
        hour: hourKey,
        label: hourDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        smtp: 0,
        resend: 0,
        failed: 0,
        total: 0,
        smtpPercent: 0,
      };
    }

    // Aggregate logs by hour
    let totalSent = 0;
    let totalFailed = 0;

    logs.forEach((log) => {
      const logHour = new Date(log.createdAt);
      logHour.setMinutes(0, 0, 0);
      const hourKey = logHour.toISOString().slice(0, 13);

      if (hourlyData[hourKey]) {
        // Count by provider
        if (log.provider === 'smtp') {
          hourlyData[hourKey].smtp++;
        } else if (log.provider === 'resend') {
          hourlyData[hourKey].resend++;
        }

        // Count failures
        if (log.status === 'failed') {
          hourlyData[hourKey].failed++;
          totalFailed++;
        }

        // Count total
        hourlyData[hourKey].total++;
        totalSent++;
      }
    });

    // Calculate SMTP percentage for each hour
    Object.values(hourlyData).forEach((hour) => {
      hour.smtpPercent = parseFloat(((hour.smtp / SMTP_HOURLY_LIMIT) * 100).toFixed(1));
    });

    // Convert to array sorted chronologically
    const timeline = Object.values(hourlyData).sort(
      (a, b) => new Date(a.hour) - new Date(b.hour)
    );

    // Current hour stats
    const currentHourKey = currentHourStart.toISOString().slice(0, 13);
    const currentHourData = hourlyData[currentHourKey] || { smtp: 0, resend: 0, failed: 0 };

    return NextResponse.json({
      currentHour: {
        smtp: currentHourData.smtp,
        smtpLimit: SMTP_HOURLY_LIMIT,
        smtpPercent: parseFloat(((currentHourData.smtp / SMTP_HOURLY_LIMIT) * 100).toFixed(1)),
        resend: currentHourData.resend,
        failed: currentHourData.failed,
      },
      timeline,
      summary: {
        totalSent,
        totalFailed,
        failureRate: totalSent > 0 ? ((totalFailed / totalSent) * 100).toFixed(1) : '0',
      },
    });
  } catch (error) {
    console.error('[Email Stats API] Error getting stats:', error);
    return NextResponse.json(
      { error: 'Failed to get email stats' },
      { status: 500 }
    );
  }
}
