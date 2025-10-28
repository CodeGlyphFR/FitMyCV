import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { incrementFeatureCounter } from "@/lib/subscription/featureUsage";

export const dynamic = "force-dynamic";

/**
 * Route POST pour débiter 1 crédit/compteur pour edit_cv
 * Appelée UNE SEULE FOIS par session d'édition (à la première modification)
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const userId = session.user.id;

    console.log(`[debit-edit] Débit de la session d'édition pour userId=${userId}`);

    // Incrémenter le compteur/débiter le crédit
    const result = await incrementFeatureCounter(userId, 'edit_cv', {});

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        actionRequired: result.actionRequired,
        redirectUrl: result.redirectUrl
      }, { status: 403 });
    }

    console.log(`[debit-edit] ✅ Débit réussi: usedCredit=${result.usedCredit}`);

    return NextResponse.json({
      success: true,
      usedCredit: result.usedCredit,
      transactionId: result.transactionId
    }, { status: 200 });
  } catch (error) {
    console.error("[debit-edit] Erreur:", error);
    return NextResponse.json(
      { error: "Erreur lors du débit" },
      { status: 500 }
    );
  }
}
