import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";

const TOKEN_LIMIT = 5;

export async function GET(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const userId = session.user.id;
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Récupérer les infos de l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        matchScoreRefreshCount: true,
        matchScoreFirstRefreshAt: true,
      },
    });

    let canRefresh = true;
    let hoursUntilReset = 0;
    let minutesUntilReset = 0;
    let refreshCount = user?.matchScoreRefreshCount || 0;

    // Vérifier si on doit reset les tokens (UNIQUEMENT après 24h)
    if (refreshCount === 0 && user?.matchScoreFirstRefreshAt && user.matchScoreFirstRefreshAt < oneDayAgo) {
      // Reset des tokens après 24h
      await prisma.user.update({
        where: { id: userId },
        data: {
          matchScoreRefreshCount: TOKEN_LIMIT,
          matchScoreFirstRefreshAt: null,
        },
      });
      refreshCount = TOKEN_LIMIT;
      canRefresh = true;
      console.log(`[rate-limit] ✅ Reset des tokens après 24h: ${TOKEN_LIMIT}/${TOKEN_LIMIT}`);
    } else if (user?.matchScoreFirstRefreshAt && user.matchScoreFirstRefreshAt > oneDayAgo) {
      // On est dans la fenêtre de 24h
      if (refreshCount === 0) {
        canRefresh = false;
        const resetTime = new Date(user.matchScoreFirstRefreshAt.getTime() + 24 * 60 * 60 * 1000);
        const totalMinutesLeft = Math.ceil((resetTime - now) / (60 * 1000));
        hoursUntilReset = Math.floor(totalMinutesLeft / 60);
        minutesUntilReset = totalMinutesLeft % 60;
      }
    }

    return NextResponse.json({
      refreshCount,
      refreshLimit: TOKEN_LIMIT,
      canRefresh,
      hoursUntilReset,
      minutesUntilReset,
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error("Error fetching rate limit:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
