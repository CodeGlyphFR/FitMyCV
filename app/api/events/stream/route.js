import { auth } from "@/lib/auth/session";
import dbEmitter from "@/lib/events/dbEmitter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Endpoint Server-Sent Events pour la synchronisation temps réel
 * Maintient une connexion ouverte et envoie les événements DB au client
 */
export async function GET(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;

  // Configuration pour SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Fonction pour envoyer un message au client
      const sendEvent = (event, data) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(message));
        } catch (error) {
          // Erreur d'envoi SSE
        }
      };

      // Handler pour les mises à jour de tâches
      const handleTaskUpdate = ({ taskId, userId: eventUserId, data }) => {
        // Ne transmettre que les événements de cet utilisateur
        if (eventUserId === userId) {
          sendEvent('task:updated', { taskId, data, timestamp: Date.now() });
        }
      };

      // Handler pour les mises à jour de CV
      const handleCvUpdate = ({ filename, userId: eventUserId, data }) => {
        if (eventUserId === userId) {
          sendEvent('cv:updated', { filename, data, timestamp: Date.now() });
        }
      };

      // Handler pour les changements DB génériques
      const handleDbChange = ({ entity, id, userId: eventUserId, data }) => {
        if (eventUserId === userId) {
          sendEvent('db:change', { entity, id, data, timestamp: Date.now() });
        }
      };

      // Handlers pour CV Generation v2
      const handleCvGenerationProgress = ({ userId: eventUserId, data }) => {
        if (eventUserId === userId) {
          sendEvent('cv_generation_v2:offer_progress', { ...data, timestamp: Date.now() });
        }
      };

      const handleCvGenerationOfferCompleted = ({ userId: eventUserId, data }) => {
        if (eventUserId === userId) {
          sendEvent('cv_generation_v2:offer_completed', { ...data, timestamp: Date.now() });
        }
      };

      const handleCvGenerationOfferFailed = ({ userId: eventUserId, data }) => {
        if (eventUserId === userId) {
          sendEvent('cv_generation_v2:offer_failed', { ...data, timestamp: Date.now() });
        }
      };

      const handleCvGenerationCompleted = ({ userId: eventUserId, data }) => {
        if (eventUserId === userId) {
          sendEvent('cv_generation_v2:completed', { ...data, timestamp: Date.now() });
        }
      };

      // Handlers pour CV Improvement v2
      const handleCvImprovementProgress = ({ userId: eventUserId, data }) => {
        if (eventUserId === userId) {
          sendEvent('cv_improvement:progress', { ...data, timestamp: Date.now() });
        }
      };

      const handleCvImprovementCompleted = ({ userId: eventUserId, data }) => {
        if (eventUserId === userId) {
          sendEvent('cv_improvement:completed', { ...data, timestamp: Date.now() });
        }
      };

      const handleCvImprovementFailed = ({ userId: eventUserId, data }) => {
        if (eventUserId === userId) {
          sendEvent('cv_improvement:failed', { ...data, timestamp: Date.now() });
        }
      };

      // Handler pour les mises à jour de crédits
      const handleCreditsUpdate = ({ userId: eventUserId, data }) => {
        if (eventUserId === userId) {
          sendEvent('credits:updated', { ...data, timestamp: Date.now() });
        }
      };

      // S'abonner aux événements
      dbEmitter.on('task:updated', handleTaskUpdate);
      dbEmitter.on('cv:updated', handleCvUpdate);
      dbEmitter.on('db:change', handleDbChange);
      dbEmitter.on('cv_generation_v2:offer_progress', handleCvGenerationProgress);
      dbEmitter.on('cv_generation_v2:offer_completed', handleCvGenerationOfferCompleted);
      dbEmitter.on('cv_generation_v2:offer_failed', handleCvGenerationOfferFailed);
      dbEmitter.on('cv_generation_v2:completed', handleCvGenerationCompleted);
      dbEmitter.on('cv_improvement:progress', handleCvImprovementProgress);
      dbEmitter.on('cv_improvement:completed', handleCvImprovementCompleted);
      dbEmitter.on('cv_improvement:failed', handleCvImprovementFailed);
      dbEmitter.on('credits:updated', handleCreditsUpdate);

      // Envoyer un message de connexion réussie
      sendEvent('connected', { userId, timestamp: Date.now() });

      // Cleanup quand la connexion est fermée
      request.signal.addEventListener('abort', () => {
        dbEmitter.off('task:updated', handleTaskUpdate);
        dbEmitter.off('cv:updated', handleCvUpdate);
        dbEmitter.off('db:change', handleDbChange);
        dbEmitter.off('cv_generation_v2:offer_progress', handleCvGenerationProgress);
        dbEmitter.off('cv_generation_v2:offer_completed', handleCvGenerationOfferCompleted);
        dbEmitter.off('cv_generation_v2:offer_failed', handleCvGenerationOfferFailed);
        dbEmitter.off('cv_generation_v2:completed', handleCvGenerationCompleted);
        dbEmitter.off('cv_improvement:progress', handleCvImprovementProgress);
        dbEmitter.off('cv_improvement:completed', handleCvImprovementCompleted);
        dbEmitter.off('cv_improvement:failed', handleCvImprovementFailed);
        dbEmitter.off('credits:updated', handleCreditsUpdate);
        controller.close();
      });

      // Keep-alive : envoyer un ping toutes les 30 secondes
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch (error) {
          clearInterval(keepAliveInterval);
        }
      }, 30000);

      // Cleanup du keep-alive
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAliveInterval);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Pour nginx
    },
  });
}
