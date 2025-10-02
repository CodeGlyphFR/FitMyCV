import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-Sent Events endpoint pour le status du match score
export async function GET(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cvFile = searchParams.get("file");

  if (!cvFile) {
    return new Response("CV file missing", { status: 400 });
  }

  const userId = session.user.id;

  // Configuration pour SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let lastStatus = null;
      let intervalId = null;

      const checkStatus = async () => {
        try {
          const cvRecord = await prisma.cvFile.findUnique({
            where: {
              userId_filename: {
                userId,
                filename: cvFile,
              },
            },
            select: {
              matchScore: true,
              matchScoreStatus: true,
              matchScoreUpdatedAt: true,
            },
          });

          if (!cvRecord) {
            controller.close();
            return;
          }

          const currentStatus = cvRecord.matchScoreStatus || 'idle';

          // Envoyer un événement seulement si le status a changé
          if (currentStatus !== lastStatus) {
            lastStatus = currentStatus;

            const data = {
              status: currentStatus,
              score: cvRecord.matchScore,
              updatedAt: cvRecord.matchScoreUpdatedAt,
            };

            const message = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(message));

            // Si le status est 'idle' ou 'error', on peut arrêter le polling
            if (currentStatus === 'idle' || currentStatus === 'error') {
              clearInterval(intervalId);
              // Envoyer un dernier message puis fermer
              setTimeout(() => controller.close(), 100);
            }
          }
        } catch (error) {
          console.error('[SSE] Error checking status:', error);
          clearInterval(intervalId);
          controller.close();
        }
      };

      // Vérifier immédiatement
      await checkStatus();

      // Puis vérifier toutes les secondes
      intervalId = setInterval(checkStatus, 1000);

      // Cleanup quand la connexion est fermée
      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
