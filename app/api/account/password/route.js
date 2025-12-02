import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth/session";
import { validatePassword } from "@/lib/security/passwordPolicy";
import { CommonErrors, AuthErrors, AccountErrors } from "@/lib/api/apiErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request){
  const session = await auth();
  if (!session?.user?.id){
    return CommonErrors.notAuthenticated();
  }

  const body = await request.json().catch(() => null);
  if (!body) return CommonErrors.invalidPayload();

  const { currentPassword, newPassword } = body;

  // Validation de la force du nouveau mot de passe
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    return AuthErrors.passwordWeak();
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user){
    return CommonErrors.notFound('user');
  }

  if (user.passwordHash){
    const valid = await bcrypt.compare(currentPassword || "", user.passwordHash);
    if (!valid){
      return AuthErrors.passwordIncorrect();
    }
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  });

  return NextResponse.json({ ok: true });
}
