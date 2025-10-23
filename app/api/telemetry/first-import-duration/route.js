import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/telemetry/first-import-duration
 * Returns the average duration for first_import_pdf operations
 */
export async function GET() {
  try {
    // Calculate average duration from OpenAICall for first_import_pdf
    const result = await prisma.openAICall.aggregate({
      where: {
        featureName: 'first_import_pdf',
        duration: {
          not: null,
        },
      },
      _avg: {
        duration: true,
      },
      _count: {
        id: true,
      },
    });

    const averageDuration = result._avg.duration;
    const callCount = result._count.id;

    // Default to 60 seconds if no data available
    const estimatedDuration = averageDuration && callCount > 0
      ? Math.round(averageDuration)
      : 60000;

    console.log(`[first-import-duration] Average duration: ${estimatedDuration}ms (from ${callCount} calls)`);

    return NextResponse.json({
      success: true,
      estimatedDuration,
      callCount,
      hasData: callCount > 0,
    });
  } catch (error) {
    console.error('[first-import-duration] Error calculating average:', error);

    // Return default duration on error
    return NextResponse.json({
      success: true,
      estimatedDuration: 60000,
      callCount: 0,
      hasData: false,
    });
  }
}
