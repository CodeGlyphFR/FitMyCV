import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request){
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Payload invalide." }, { status: 400 });

  const { name, email, password } = body;
  if (!email || !password || !name){
    return NextResponse.json({ error: "Nom, email et mot de passe sont requis." }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing){
    return NextResponse.json({ error: "Un compte existe déjà avec cet email." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash,
    },
  });

  return NextResponse.json({ ok: true, userId: user.id });
}
