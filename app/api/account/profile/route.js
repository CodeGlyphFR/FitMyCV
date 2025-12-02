import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth/session";
import { createEmailChangeRequest, sendEmailChangeVerification } from "@/lib/email/emailService";
import { CommonErrors, AccountErrors } from "@/lib/api/apiErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request){
  const session = await auth();
  if (!session?.user?.id){
    return CommonErrors.notAuthenticated();
  }

  const body = await request.json().catch(() => null);
  if (!body) return CommonErrors.invalidPayload();

  const { name, email } = body;
  if (!name && !email){
    return NextResponse.json({ error: "Aucune modification." }, { status: 400 });
  }

  // Récupérer les informations de l'utilisateur pour vérifier s'il est OAuth
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      name: true,
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
  let emailChangeRequested = false;

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

    // Vérifier si l'email est différent de l'actuel
    if (normalizedEmail === user.email) {
      return NextResponse.json({ error: "Cette adresse est déjà votre email actuel." }, { status: 400 });
    }

    // Vérifier si l'email n'est pas déjà utilisé
    const existing = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        NOT: { id: session.user.id },
      },
    });
    if (existing){
      return NextResponse.json({ error: "Cet email est déjà utilisé." }, { status: 409 });
    }

    // Au lieu de changer directement l'email, créer une demande de changement
    try {
      const token = await createEmailChangeRequest(session.user.id, normalizedEmail);
      const result = await sendEmailChangeVerification({
        email: normalizedEmail,
        name: user.name || 'Utilisateur',
        token,
      });

      if (!result.success) {
        return NextResponse.json({
          error: "Impossible d'envoyer l'email de vérification."
        }, { status: 500 });
      }

      emailChangeRequested = true;
    } catch (error) {
      console.error('[profile] Erreur lors de la création de la demande de changement d\'email:', error);
      return AccountErrors.emailChangeFailed();
    }
  }

  // Mettre à jour uniquement le nom si fourni
  if (Object.keys(data).length > 0) {
    await prisma.user.update({
      where: { id: session.user.id },
      data,
    });
  }

  return NextResponse.json({
    ok: true,
    emailChangeRequested,
    message: emailChangeRequested
      ? "Un email de vérification a été envoyé à votre nouvelle adresse."
      : "Profil mis à jour."
  });
}
