import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth/session";
import { getUserCvDir } from "@/lib/cv/storage";
import fs from "fs/promises";
import path from "path";

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

  const userDir = getUserCvDir(user.id);
  try {
    await fs.rm(userDir, { recursive: true, force: true });
    const parentDir = path.dirname(userDir);
    await fs.rm(parentDir, { recursive: true, force: true });
  } catch (error) {
    console.error("Suppression du dossier utilisateur impossible", error);
  }

  try {
    await prisma.user.delete({ where: { id: user.id } });
  } catch (error) {
    console.error("Suppression de l'utilisateur impossible", error);
    return NextResponse.json({ error: "Impossible de supprimer le compte pour le moment." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
