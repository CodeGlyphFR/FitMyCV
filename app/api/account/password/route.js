import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth/session";
import { validatePassword } from "@/lib/security/passwordPolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request){
  const session = await auth();
  if (!session?.user?.id){
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Payload invalide." }, { status: 400 });

  const { currentPassword, newPassword } = body;

  // Validation de la force du nouveau mot de passe
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    return NextResponse.json({
      error: "Nouveau mot de passe trop faible",
      details: passwordValidation.errors
    }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user){
    return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
  }

  if (user.passwordHash){
    const valid = await bcrypt.compare(currentPassword || "", user.passwordHash);
    if (!valid){
      return NextResponse.json({ error: "Mot de passe actuel incorrect." }, { status: 400 });
    }
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  });

  return NextResponse.json({ ok: true });
}
