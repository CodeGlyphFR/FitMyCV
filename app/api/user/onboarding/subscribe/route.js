/**
 * API Route: /api/user/onboarding/subscribe
 *
 * Endpoint SSE (Server-Sent Events) pour la synchronisation temps réel
 * de l'état d'onboarding entre plusieurs devices (PC, tablette, mobile).
 *
 * Événements émis:
 * - onboarding:updated - Mise à jour progressive de l'état
 * - onboarding:reset - Reset complet de l'onboarding
 *
 * Flow:
 * 1. Client ouvre connexion SSE
 * 2. Serveur enregistre la connexion pour cet userId
 * 3. Quand onboardingState change (via PATCH /api/user/onboarding), serveur broadcast
 * 4. Tous les devices connectés reçoivent l'update instantanément
 */

import { auth } from '@/lib/auth/session';
import { sseManager } from '@/lib/sse/sseManager';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/user/onboarding/subscribe
 *
 * Établit une connexion SSE pour un utilisateur
 */
export async function GET(request) {
  try {
    // Vérifier session
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Créer un ReadableStream pour SSE
    const stream = new ReadableStream({
      start(controller) {
        // Ajouter la connexion au SSE Manager
        sseManager.addConnection(userId, controller);

        // Envoyer un message de bienvenue
        const welcomeMessage = `event: connected\ndata: ${JSON.stringify({ message: 'SSE connection established', userId })}\n\n`;
        controller.enqueue(new TextEncoder().encode(welcomeMessage));

        // Heartbeat toutes les 30 secondes pour maintenir la connexion active
        const heartbeatInterval = setInterval(() => {
          try {
            const heartbeat = sseManager.sendHeartbeat(userId);

            // Si heartbeat échoue, c'est que la connexion est fermée
            if (heartbeat === 0) {
              clearInterval(heartbeatInterval);
            }
          } catch (error) {
            // Connexion fermée, nettoyer
            clearInterval(heartbeatInterval);
            sseManager.removeConnection(userId, controller);
          }
        }, 30000);

        // Cleanup quand la connexion se ferme
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeatInterval);
          sseManager.removeConnection(userId, controller);

          if (process.env.NODE_ENV === 'development') {
            console.log(`[SSE] Client déconnecté : ${userId}`);
          }
        });

        // Log pour debug (dev only)
        if (process.env.NODE_ENV === 'development') {
          console.log(`[SSE] Nouvelle connexion pour user ${userId}`);
        }
      },

      cancel() {
        // Appelé quand le client ferme la connexion
        sseManager.closeAllConnections(userId);
      }
    });

    // Retourner la response SSE
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Désactiver buffering nginx
      }
    });

  } catch (error) {
    console.error('[SSE] Erreur création connexion:', error);

    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
