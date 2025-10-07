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

  console.log(`[SSE] Nouvelle connexion pour user ${userId}`);

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
          console.error('[SSE] Erreur envoi message:', error);
        }
      };

      // Handler pour les mises à jour de tâches
      const handleTaskUpdate = ({ taskId, userId: eventUserId, data }) => {
        console.log(`[SSE] 📨 Event task:updated reçu - taskId: ${taskId}, userId: ${eventUserId}`);
        // Ne transmettre que les événements de cet utilisateur
        if (eventUserId === userId) {
          console.log(`[SSE] ✅ Envoi au client user ${userId}`);
          sendEvent('task:updated', { taskId, data, timestamp: Date.now() });
        } else {
          console.log(`[SSE] ⏭️ Ignoré (userId différent)`);
        }
      };

      // Handler pour les mises à jour de CV
      const handleCvUpdate = ({ filename, userId: eventUserId, data }) => {
        console.log(`[SSE] 📨 Event cv:updated reçu - filename: ${filename}, userId: ${eventUserId}`);
        if (eventUserId === userId) {
          console.log(`[SSE] ✅ Envoi au client user ${userId}`);
          sendEvent('cv:updated', { filename, data, timestamp: Date.now() });
        } else {
          console.log(`[SSE] ⏭️ Ignoré (userId différent)`);
        }
      };

      // Handler pour les changements DB génériques
      const handleDbChange = ({ entity, id, userId: eventUserId, data }) => {
        if (eventUserId === userId) {
          sendEvent('db:change', { entity, id, data, timestamp: Date.now() });
        }
      };

      // S'abonner aux événements
      console.log(`[SSE] 📡 Ajout des listeners pour user ${userId}`);
      dbEmitter.on('task:updated', handleTaskUpdate);
      dbEmitter.on('cv:updated', handleCvUpdate);
      dbEmitter.on('db:change', handleDbChange);

      console.log(`[SSE] 📊 Nombre de listeners task:updated: ${dbEmitter.listenerCount('task:updated')}`);
      console.log(`[SSE] 📊 Nombre de listeners cv:updated: ${dbEmitter.listenerCount('cv:updated')}`);

      // Envoyer un message de connexion réussie
      sendEvent('connected', { userId, timestamp: Date.now() });
      console.log(`[SSE] ✅ Connexion établie et message 'connected' envoyé pour user ${userId}`);

      // Cleanup quand la connexion est fermée
      request.signal.addEventListener('abort', () => {
        console.log(`[SSE] 🔌 Connexion fermée pour user ${userId}, nettoyage des listeners...`);
        dbEmitter.off('task:updated', handleTaskUpdate);
        dbEmitter.off('cv:updated', handleCvUpdate);
        dbEmitter.off('db:change', handleDbChange);

        console.log(`[SSE] 📊 Listeners restants task:updated: ${dbEmitter.listenerCount('task:updated')}`);
        console.log(`[SSE] 📊 Listeners restants cv:updated: ${dbEmitter.listenerCount('cv:updated')}`);

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
