import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth/session";
import { getUserCvDir } from "@/lib/cv/storage";
import fs from "fs/promises";
import path from "path";
import logger from "@/lib/security/secureLogger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request){
  const session = await auth();
  if (!session?.user?.id){
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const password = body?.password ? String(body.password) : "";

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user){
    return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
  }

  if (!user.passwordHash){
    return NextResponse.json({ error: "Ce compte ne possède pas de mot de passe. Définissez-en un avant de supprimer le compte." }, { status: 400 });
  }

  if (!password){
    return NextResponse.json({ error: "Merci de saisir votre mot de passe pour confirmer." }, { status: 400 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid){
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 400 });
  }

  // Supprimer l'utilisateur de la DB (les foreign keys avec onDelete: Cascade supprimeront automatiquement toutes les données liées)
  try {
    logger.context('DELETE account', 'info', `Suppression de l'utilisateur ${user.id} (cascade automatique activé)`);

    // La suppression de l'utilisateur supprimera automatiquement via cascade :
    // - Accounts, CvFiles, BackgroundTasks, LinkHistory, Feedbacks
    // - ConsentLogs, TelemetryEvents, FeatureUsage, OpenAIUsage, OpenAICalls
    // - Subscriptions, CreditBalance, CreditTransactions, FeatureUsageCounters
    // - Referrals, EmailVerificationTokens, AutoSignInTokens, EmailChangeRequests
    await prisma.user.delete({ where: { id: user.id } });

    logger.context('DELETE account', 'info', `✅ Utilisateur ${user.id} supprimé avec succès (+ toutes données liées via cascade)`);
  } catch (error) {
    logger.context('DELETE account', 'error', "❌ Erreur lors de la suppression:", error);
    return NextResponse.json({
      error: "Impossible de supprimer le compte pour le moment.",
      details: error.message
    }, { status: 500 });
  }

  // Supprimer le dossier utilisateur
  const userDir = getUserCvDir(user.id);
  try {
    await fs.rm(userDir, { recursive: true, force: true });
    const parentDir = path.dirname(userDir);
    await fs.rm(parentDir, { recursive: true, force: true });
    logger.context('DELETE account', 'info', '✅ Dossier utilisateur supprimé');
  } catch (error) {
    logger.context('DELETE account', 'warn', "⚠️ Suppression du dossier utilisateur impossible:", error);
    // Ne pas retourner d'erreur si le dossier n'existe pas ou ne peut pas être supprimé
  }

  // Supprimer tous les cookies de l'utilisateur
  try {
    const cookieStore = cookies();

    // Liste des cookies à supprimer
    const cookiesToDelete = [
      'cvFile',
      'next-auth.session-token',
      'next-auth.csrf-token',
      'next-auth.callback-url',
      '__Secure-next-auth.session-token',
      '__Host-next-auth.csrf-token'
    ];

    for (const cookieName of cookiesToDelete) {
      cookieStore.delete(cookieName);
    }

    logger.context('DELETE account', 'info', '✅ Cookies supprimés');
  } catch (error) {
    logger.context('DELETE account', 'warn', "⚠️ Suppression des cookies impossible:", error);
  }

  return NextResponse.json({ ok: true });
}
