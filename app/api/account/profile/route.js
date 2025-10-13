import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request){
  const session = await auth();
  if (!session?.user?.id){
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Payload invalide." }, { status: 400 });

  const { name, email } = body;
  if (!name && !email){
    return NextResponse.json({ error: "Aucune modification." }, { status: 400 });
  }

  // Récupérer les informations de l'utilisateur pour vérifier s'il est OAuth
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      passwordHash: true,
      accounts: {
        select: {
          provider: true,
        },
      },
    },
  });

  // Vérifier si l'utilisateur est OAuth (pas de passwordHash ou a des comptes OAuth)
  const isOAuthUser = !user?.passwordHash || (user?.accounts?.length > 0);

  const data = {};
  if (name) data.name = String(name).trim();
  if (email){
    // Empêcher la modification de l'email pour les utilisateurs OAuth
    if (isOAuthUser) {
      return NextResponse.json({
        error: "Votre email est lié à votre compte OAuth et ne peut pas être modifié ici."
      }, { status: 403 });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    if (!normalizedEmail) {
      return NextResponse.json({ error: "Email invalide." }, { status: 400 });
    }
    const existing = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        NOT: { id: session.user.id },
      },
    });
    if (existing){
      return NextResponse.json({ error: "Cet email est déjà utilisé." }, { status: 409 });
    }
    data.email = normalizedEmail;
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data,
  });

  return NextResponse.json({ ok: true });
}
