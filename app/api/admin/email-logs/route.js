import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/email-logs
 * Get email logs with pagination and filters
 * Query params:
 *   - page: Page number (default: 1)
 *   - limit: Items per page (default: 25)
 *   - template: Filter by template name (optional)
 *   - status: Filter by status (optional)
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const templateName = searchParams.get('template');
    const status = searchParams.get('status');

    const where = {};
    if (templateName) where.templateName = templateName;
    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          template: {
            select: { name: true, subject: true },
          },
        },
      }),
      prisma.emailLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error('[Email Logs API] Error getting logs:', error);
    return NextResponse.json(
      { error: 'Failed to get email logs' },
      { status: 500 }
    );
  }
}
