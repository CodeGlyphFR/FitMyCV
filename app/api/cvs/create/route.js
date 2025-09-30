import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth/session";
import { ensureUserCvDir, listUserCvFiles, writeUserCvFile } from "@/lib/cv/storage";

export const runtime="nodejs"; export const dynamic="force-dynamic";
export async function POST(req){
  try{
    const session = await auth();
    if (!session?.user?.id){
      return NextResponse.json({ error:"Non authentifié" }, { status:401 });
    }

    var body=await req.json(); var full_name=(body.full_name||"").trim(); var current_title=(body.current_title||"").trim(); var email=(body.email||"").trim();
    var now=new Date();
    var isoNow=now.toISOString();
    var generated_at=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0");
    var cv={ generated_at, header:{ full_name, current_title, contact:{ email, links:[], location:{} } }, summary:{ description:"", domains:[] },
      skills:{ hard_skills:[], tools:[], methodologies:[] }, experience:[], education:[], languages:[], extras:{ driver_licenses:[] }, projects:[],
      order_hint:["header","summary","skills","experience","education","languages","extras","projects"], section_titles:{ summary:"Résumé", skills:"Compétences", experience:"Expérience", education:"Éducation", languages:"Langues", extras:"Informations complémentaires", projects:"Projets personnels" },
      meta:{ generator:"manual", source:"manual", created_at:isoNow, updated_at:isoNow }
    };
    await ensureUserCvDir(session.user.id);
    const existingFiles = await listUserCvFiles(session.user.id).catch(() => []);
    let baseName = String(Date.now());
    var file = baseName+".json";
    while (existingFiles.includes(file)){
      baseName = String(Number(baseName) + 1);
      file = baseName+".json";
    }
    try{
      if (!cv.summary) cv.summary = { description:"", domains:[] };
      if (!cv.skills) cv.skills = { hard_skills:[], tools:[], methodologies:[], soft_skills:[] };
      if (!Array.isArray(cv.skills.hard_skills)) cv.skills.hard_skills = [];
      if (!Array.isArray(cv.skills.tools)) cv.skills.tools = [];
      if (!Array.isArray(cv.skills.methodologies)) cv.skills.methodologies = [];
      if (!Array.isArray(cv.skills.soft_skills)) cv.skills.soft_skills = [];
      if (!Array.isArray(cv.experience)) cv.experience = [];
      if (!Array.isArray(cv.education)) cv.education = [];
      if (!Array.isArray(cv.languages)) cv.languages = [];
      if (!Array.isArray(cv.extras)) cv.extras = [];
      if (!Array.isArray(cv.projects)) cv.projects = [];
    }catch{}
    
await writeUserCvFile(session.user.id, file, JSON.stringify(cv,null,2));
await prisma.cvFile.upsert({
      where: { userId_filename: { userId: session.user.id, filename: file } },
      update: {},
      create: { userId: session.user.id, filename: file },
    });

// Définir le cookie côté serveur pour qu'il soit immédiatement disponible
const response = NextResponse.json({ ok:true, file });
response.cookies.set('cvFile', file, {
  path: '/',
  maxAge: 31536000, // 1 an
  httpOnly: false,
  sameSite: 'lax'
});
return response;
  }catch(e){ return NextResponse.json({ error: (e&&e.message)||"Erreur inconnue" }, { status:500 }); }
}
