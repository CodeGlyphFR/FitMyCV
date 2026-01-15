import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/openai-pricing
 * Retrieve all OpenAI pricing configurations and priority mode status
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

    // Get priority mode setting
    const priorityModeSetting = await prisma.setting.findUnique({
      where: { settingName: 'openai_priority_mode' },
    });
    const isPriorityMode = priorityModeSetting?.value === 'true';

    return NextResponse.json({ pricings, isPriorityMode });
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
 *   cachePricePerMToken?: number,
 *   inputPricePerMTokenPriority?: number,
 *   outputPricePerMTokenPriority?: number,
 *   cachePricePerMTokenPriority?: number,
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
    const {
      modelName,
      inputPricePerMToken,
      outputPricePerMToken,
      cachePricePerMToken,
      inputPricePerMTokenPriority,
      outputPricePerMTokenPriority,
      cachePricePerMTokenPriority,
      description,
      isActive,
    } = body;

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

    // Validate cache price if provided
    if (cachePricePerMToken !== undefined && cachePricePerMToken < 0) {
      return NextResponse.json(
        { error: 'Cache price must be a positive number' },
        { status: 400 }
      );
    }

    // Upsert pricing
    const pricing = await prisma.openAIPricing.upsert({
      where: { modelName },
      update: {
        inputPricePerMToken,
        outputPricePerMToken,
        cachePricePerMToken: cachePricePerMToken !== undefined ? cachePricePerMToken : 0,
        inputPricePerMTokenPriority: inputPricePerMTokenPriority !== undefined ? inputPricePerMTokenPriority : null,
        outputPricePerMTokenPriority: outputPricePerMTokenPriority !== undefined ? outputPricePerMTokenPriority : null,
        cachePricePerMTokenPriority: cachePricePerMTokenPriority !== undefined ? cachePricePerMTokenPriority : null,
        description: description || null,
        isActive: isActive !== undefined ? isActive : true,
      },
      create: {
        modelName,
        inputPricePerMToken,
        outputPricePerMToken,
        cachePricePerMToken: cachePricePerMToken !== undefined ? cachePricePerMToken : 0,
        inputPricePerMTokenPriority: inputPricePerMTokenPriority !== undefined ? inputPricePerMTokenPriority : null,
        outputPricePerMTokenPriority: outputPricePerMTokenPriority !== undefined ? outputPricePerMTokenPriority : null,
        cachePricePerMTokenPriority: cachePricePerMTokenPriority !== undefined ? cachePricePerMTokenPriority : null,
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

/**
 * PATCH /api/admin/openai-pricing
 * Toggle priority mode setting
 *
 * Body:
 * {
 *   isPriorityMode: boolean
 * }
 */
export async function PATCH(request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { isPriorityMode } = body;

    if (isPriorityMode === undefined) {
      return NextResponse.json(
        { error: 'Missing required field: isPriorityMode' },
        { status: 400 }
      );
    }

    // Upsert the setting
    await prisma.setting.upsert({
      where: { settingName: 'openai_priority_mode' },
      update: {
        value: isPriorityMode ? 'true' : 'false',
      },
      create: {
        settingName: 'openai_priority_mode',
        value: isPriorityMode ? 'true' : 'false',
        category: 'openai',
        description: 'Si activé, utilise les tarifs Priority OpenAI (~70% plus cher). Désactiver pour les tarifs Standard.',
      },
    });

    return NextResponse.json({ isPriorityMode });
  } catch (error) {
    console.error('[API /admin/openai-pricing PATCH] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
