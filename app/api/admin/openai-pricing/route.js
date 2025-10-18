import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/openai-pricing
 * Retrieve all OpenAI pricing configurations
 */
export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pricings = await prisma.openAIPricing.findMany({
      orderBy: {
        modelName: 'asc',
      },
    });

    return NextResponse.json({ pricings });
  } catch (error) {
    console.error('[API /admin/openai-pricing GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/openai-pricing
 * Create or update OpenAI pricing configuration
 *
 * Body:
 * {
 *   modelName: string,
 *   inputPricePerMToken: number,
 *   outputPricePerMToken: number,
 *   description?: string,
 *   isActive?: boolean
 * }
 */
export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { modelName, inputPricePerMToken, outputPricePerMToken, description, isActive } = body;

    // Validate required fields
    if (!modelName || inputPricePerMToken === undefined || outputPricePerMToken === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: modelName, inputPricePerMToken, outputPricePerMToken' },
        { status: 400 }
      );
    }

    // Validate pricing values
    if (inputPricePerMToken < 0 || outputPricePerMToken < 0) {
      return NextResponse.json(
        { error: 'Prices must be positive numbers' },
        { status: 400 }
      );
    }

    // Upsert pricing
    const pricing = await prisma.openAIPricing.upsert({
      where: { modelName },
      update: {
        inputPricePerMToken,
        outputPricePerMToken,
        description: description || null,
        isActive: isActive !== undefined ? isActive : true,
      },
      create: {
        modelName,
        inputPricePerMToken,
        outputPricePerMToken,
        description: description || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json({ pricing }, { status: 200 });
  } catch (error) {
    console.error('[API /admin/openai-pricing POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/openai-pricing/:modelName
 * Delete an OpenAI pricing configuration
 */
export async function DELETE(request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const modelName = searchParams.get('modelName');

    if (!modelName) {
      return NextResponse.json(
        { error: 'Missing modelName parameter' },
        { status: 400 }
      );
    }

    await prisma.openAIPricing.delete({
      where: { modelName },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /admin/openai-pricing DELETE] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
