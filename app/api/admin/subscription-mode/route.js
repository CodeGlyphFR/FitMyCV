import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { isSubscriptionModeEnabled } from '@/lib/settings/settingsUtils';

/**
 * GET /api/admin/subscription-mode
 * Retourne l'état du mode abonnement et les statistiques des abonnés payants
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

    // Vérifier l'état actuel du mode abonnement
    const subscriptionModeEnabled = await isSubscriptionModeEnabled();

    // Compter les abonnés payants actifs (plans non gratuits)
    const paidSubscribersCount = await prisma.subscription.count({
      where: {
        status: 'active',
        plan: {
          isFree: false,
        },
      },
    });

    // Récupérer le setting pour avoir l'ID
    const setting = await prisma.setting.findUnique({
      where: { settingName: 'subscription_mode_enabled' },
    });

    return NextResponse.json({
      subscriptionModeEnabled,
      paidSubscribersCount,
      settingId: setting?.id || null,
    });

  } catch (error) {
    console.error('[Subscription Mode API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get subscription mode status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/subscription-mode
 * Modifie le mode abonnement (activé/désactivé)
 */
export async function POST(request) {
  try {
    const session = await auth();

    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled (boolean) is required' },
        { status: 400 }
      );
    }

    // Mettre à jour ou créer le setting
    const setting = await prisma.setting.upsert({
      where: { settingName: 'subscription_mode_enabled' },
      update: { value: enabled ? '1' : '0' },
      create: {
        settingName: 'subscription_mode_enabled',
        value: enabled ? '1' : '0',
        category: 'system',
        description: 'Mode abonnement activé (1) ou mode crédits uniquement (0)',
      },
    });

    console.log(`[Subscription Mode API] Mode abonnement ${enabled ? 'activé' : 'désactivé'} par user ${session.user.id}`);

    return NextResponse.json({
      success: true,
      subscriptionModeEnabled: enabled,
      setting,
    });

  } catch (error) {
    console.error('[Subscription Mode API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription mode' },
      { status: 500 }
    );
  }
}
