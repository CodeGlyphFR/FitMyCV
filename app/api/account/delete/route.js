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

  // Supprimer toutes les données liées dans l'ordre (contraintes FK)
  try {
    logger.context('DELETE account', 'info', `Suppression des données pour l'utilisateur ${user.id}`);

    // Supprimer toutes les relations (ordre important pour les contraintes FK)
    await prisma.linkHistory.deleteMany({ where: { userId: user.id } });
    await prisma.feedback.deleteMany({ where: { userId: user.id } });
    await prisma.consentLog.deleteMany({ where: { userId: user.id } });
    await prisma.cvFile.deleteMany({ where: { userId: user.id } });
    await prisma.backgroundTask.deleteMany({ where: { userId: user.id } });

    // Supprimer les données de télémétrie
    await prisma.telemetryEvent.deleteMany({ where: { userId: user.id } });
    await prisma.featureUsage.deleteMany({ where: { userId: user.id } });
    await prisma.openAIUsage.deleteMany({ where: { userId: user.id } });

    // Supprimer les comptes OAuth
    await prisma.account.deleteMany({ where: { userId: user.id } });

    // Supprimer l'utilisateur
    await prisma.user.delete({ where: { id: user.id } });

    logger.context('DELETE account', 'info', `✅ Utilisateur ${user.id} supprimé de la DB`);
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
