/**
 * POST /api/admin/sync-stripe
 * Synchronise les produits et prix Stripe avec la base de données
 *
 * Cette API appelle la fonction de synchronisation interne pour créer/mettre à jour
 * les produits et prix dans Stripe selon les plans et packs en BDD.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { syncStripeProductsInternal } from '@/lib/subscription/stripeSync';

export async function POST(request) {
  try {
    const session = await auth();

    // Vérifier que l'utilisateur est admin
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Appeler la fonction de synchronisation interne
    const result = await syncStripeProductsInternal();

    return NextResponse.json(result);

  } catch (error) {
    console.error('[Sync Stripe API] Erreur:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la synchronisation Stripe' },
      { status: 500 }
    );
  }
}
