import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { ensureUserCvDir, listUserCvFiles, writeUserCvFile } from "@/lib/cv/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isJsonFileSafe(name){
  if (typeof name !== "string") return false;
  if (name.includes("/") || name.includes("\\") ) return false;
  return name.toLowerCase().endsWith(".json");
}

async function ensureAtLeastOneCV(userId){
  const now = new Date();
  const file = "cv-" + now.getFullYear() + String(now.getMonth()+1).padStart(2,"0") + "-" + now.getTime() + ".json";
  const minimal = {
    generated_at: now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0"),
    header: { full_name: "Nouveau CV", current_title: "", contact: { email: "", links: [], location: {} } },
    summary: { description: "", domains: [] },
    skills: { hard_skills: [], tools: [], methodologies: [] },
    experience: [], education: [], languages: [], extras: { driver_licenses: [] }, projects: [],
    order_hint: ["header","summary","skills","experience","education","languages","extras","projects"],
    section_titles: { summary:"Résumé", skills:"Compétences", experience:"Expérience", education:"Éducation", languages:"Langues", extras:"Informations complémentaires", projects:"Projets personnels" }
  };
  await writeUserCvFile(userId, file, JSON.stringify(minimal, null, 2));
  return file;
}

export async function POST(req){
  try{
    const session = await auth();
    if (!session?.user?.id){
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await req.json();
    const file = (body && body.file) || "";
    if (!isJsonFileSafe(file)) {
      return NextResponse.json({ error: "Nom de fichier invalide" }, { status: 400 });
    }
    const dir = await ensureUserCvDir(session.user.id);
    const target = path.join(dir, path.basename(file));
    // verify file exists
    try { await fs.access(target); } catch { return NextResponse.json({ error: "CV introuvable" }, { status: 404 }); }
    // delete
    await fs.unlink(target);
    try {
      await prisma.cvFile.delete({
        where: { userId_filename: { userId: session.user.id, filename: file } },
      });
    } catch (_err) {}
    // choose next file
    const all = await listUserCvFiles(session.user.id);
    let nextFile = null;
    if (all.includes("main.json")) nextFile = "main.json";
    else if (all.length > 0) nextFile = all[0];
    else nextFile = await ensureAtLeastOneCV(session.user.id);
    if (nextFile){
      await prisma.cvFile.upsert({
        where: { userId_filename: { userId: session.user.id, filename: nextFile } },
        update: {},
        create: { userId: session.user.id, filename: nextFile },
      });
    }
    return NextResponse.json({ ok: true, nextFile });
  }catch(e){
    return NextResponse.json({ error: (e && e.message) || "Erreur inconnue" }, { status: 500 });
  }
}
