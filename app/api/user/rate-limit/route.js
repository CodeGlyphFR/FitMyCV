import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";

export async function GET(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const userId = session.user.id;

    // Récupérer les settings de rate limiting depuis la DB
    const [tokenLimitSetting, resetHoursSetting] = await Promise.all([
      prisma.setting.findUnique({ where: { settingName: 'token_default_limit' }, select: { value: true } }),
      prisma.setting.findUnique({ where: { settingName: 'token_reset_hours' }, select: { value: true } })
    ]);

    const TOKEN_LIMIT = parseInt(tokenLimitSetting?.value || '5', 10);
    const RESET_HOURS = parseInt(resetHoursSetting?.value || '24', 10);
    const RESET_MS = RESET_HOURS * 60 * 60 * 1000;

    const now = new Date();
    const resetAgo = new Date(now.getTime() - RESET_MS);

    // Récupérer les infos de l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        matchScoreRefreshCount: true,
        tokenLastUsage: true,
      },
    });

    let canRefresh = true;
    let hoursUntilReset = 0;
    let minutesUntilReset = 0;
    let refreshCount = user?.matchScoreRefreshCount || 0;

    // Vérifier si on doit reset les tokens (UNIQUEMENT après le délai configuré)
    if (refreshCount === 0 && user?.tokenLastUsage && user.tokenLastUsage < resetAgo) {
      // Reset des tokens après le délai
      await prisma.user.update({
        where: { id: userId },
        data: {
          matchScoreRefreshCount: TOKEN_LIMIT,
          tokenLastUsage: null,
        },
      });
      refreshCount = TOKEN_LIMIT;
      canRefresh = true;
      console.log(`[rate-limit] ✅ Reset des tokens après ${RESET_HOURS}h: ${TOKEN_LIMIT}/${TOKEN_LIMIT}`);
    } else if (user?.tokenLastUsage && user.tokenLastUsage > resetAgo) {
      // On est dans la fenêtre de reset
      if (refreshCount === 0) {
        canRefresh = false;
        const resetTime = new Date(user.tokenLastUsage.getTime() + RESET_MS);
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
