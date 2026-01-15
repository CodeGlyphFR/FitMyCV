import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

/**
 * DELETE /api/admin/telemetry/cleanup
 * Delete all telemetry data from FeatureUsage, OpenAICall, OpenAIUsage, TelemetryEvent,
 * and CV generation tracking tables (CvGenerationSubtask, CvGenerationOffer, CvGenerationTask)
 * This is a destructive operation and should only be used by administrators
 */
export async function DELETE(request) {
  try {
    const session = await auth();

    // Only ADMIN can delete telemetry data
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    console.log(`[Admin] Deleting all telemetry data requested by user: ${session.user.email}`);

    // Delete data from all telemetry tables
    // Note: Order matters for CV generation tables due to foreign key constraints
    // Subtasks -> Offers -> Tasks
    const results = await prisma.$transaction([
      prisma.featureUsage.deleteMany({}),
      prisma.openAICall.deleteMany({}),
      prisma.openAIUsage.deleteMany({}),
      prisma.telemetryEvent.deleteMany({}),
      // CV generation tracking tables (order: children first)
      prisma.cvGenerationSubtask.deleteMany({}),
      prisma.cvGenerationOffer.deleteMany({}),
      prisma.cvGenerationTask.deleteMany({}),
    ]);

    const [
      featureUsage,
      openAICall,
      openAIUsage,
      telemetryEvent,
      cvGenerationSubtask,
      cvGenerationOffer,
      cvGenerationTask,
    ] = results;

    const totalDeleted =
      featureUsage.count +
      openAICall.count +
      openAIUsage.count +
      telemetryEvent.count +
      cvGenerationSubtask.count +
      cvGenerationOffer.count +
      cvGenerationTask.count;

    console.log(`[Admin] Successfully deleted telemetry data:`);
    console.log(`  - FeatureUsage: ${featureUsage.count} records`);
    console.log(`  - OpenAICall: ${openAICall.count} records`);
    console.log(`  - OpenAIUsage: ${openAIUsage.count} records`);
    console.log(`  - TelemetryEvent: ${telemetryEvent.count} records`);
    console.log(`  - CvGenerationSubtask: ${cvGenerationSubtask.count} records`);
    console.log(`  - CvGenerationOffer: ${cvGenerationOffer.count} records`);
    console.log(`  - CvGenerationTask: ${cvGenerationTask.count} records`);
    console.log(`  Total: ${totalDeleted} records deleted`);

    return NextResponse.json({
      success: true,
      message: 'All telemetry data deleted successfully',
      deleted: {
        featureUsage: featureUsage.count,
        openAICall: openAICall.count,
        openAIUsage: openAIUsage.count,
        telemetryEvent: telemetryEvent.count,
        cvGenerationSubtask: cvGenerationSubtask.count,
        cvGenerationOffer: cvGenerationOffer.count,
        cvGenerationTask: cvGenerationTask.count,
        total: totalDeleted,
      },
    });
  } catch (error) {
    console.error('[Admin] Error deleting telemetry data:', error);
    return NextResponse.json(
      { error: 'Failed to delete telemetry data', details: error.message },
      { status: 500 }
    );
  }
}
