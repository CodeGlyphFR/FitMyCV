import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { canUseFeature } from "@/lib/subscription/featureUsage";
import { CommonErrors, CvErrors } from "@/lib/api/apiErrors";

export const dynamic = "force-dynamic";

/**
 * Route GET pour vérifier si l'utilisateur peut activer le mode édition
 * Ne débite PAS de crédit/compteur, juste une vérification
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    const userId = session.user.id;

    // Vérifier si l'utilisateur peut utiliser la feature edit_cv
    const check = await canUseFeature(userId, 'edit_cv');

    if (!check.canUse) {
      return NextResponse.json({
        canEdit: false,
        reason: check.reason,
        actionRequired: check.actionRequired,
        redirectUrl: check.redirectUrl
      }, { status: 200 });
    }

    return NextResponse.json({
      canEdit: true,
      useCredit: check.useCredit,
      creditBalance: check.creditBalance
    }, { status: 200 });
  } catch (error) {
    console.error("[can-edit] Erreur:", error);
    return CvErrors.verifyError();
  }
}
