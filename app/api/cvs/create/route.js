import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth/session";
import { ensureUserCvDir, listUserCvFiles, writeUserCvFile } from "@/lib/cv/storage";
import { trackCvCreation } from "@/lib/telemetry/server";
import { incrementFeatureCounter } from "@/lib/subscription/featureUsage";

export const runtime="nodejs"; export const dynamic="force-dynamic";
export async function POST(req){
  try{
    const session = await auth();
    if (!session?.user?.id){
      return NextResponse.json({ error:"Non authentifié" }, { status:401 });
    }

    var body=await req.json(); var full_name=(body.full_name||"").trim(); var current_title=(body.current_title||"").trim(); var email=(body.email||"").trim();
    var recaptchaToken=body.recaptchaToken;

    const userId = session.user.id;

    // Vérification reCAPTCHA (optionnelle pour compatibilité, mais recommandée)
    if (recaptchaToken) {
      try {
        const secretKey = process.env.RECAPTCHA_SECRET_KEY;
        if (!secretKey) {
          console.error('[create-cv] RECAPTCHA_SECRET_KEY not configured');
          return NextResponse.json({ error: "Configuration serveur manquante" }, { status: 500 });
        }

        const verificationUrl = 'https://www.google.com/recaptcha/api/siteverify';
        const verificationData = new URLSearchParams({
          secret: secretKey,
          response: recaptchaToken,
        });

        const verificationResponse = await fetch(verificationUrl, {
          method: 'POST',
          body: verificationData,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        const verificationResult = await verificationResponse.json();

        if (!verificationResult.success || (verificationResult.score && verificationResult.score < 0.5)) {
          console.warn('[create-cv] reCAPTCHA verification failed', {
            success: verificationResult.success,
            score: verificationResult.score,
          });
          return NextResponse.json(
            { error: "Échec de la vérification anti-spam. Veuillez réessayer." },
            { status: 403 }
          );
        }
      } catch (error) {
        console.error('[create-cv] Error verifying reCAPTCHA:', error);
        return NextResponse.json(
          { error: "Erreur lors de la vérification anti-spam" },
          { status: 500 }
        );
      }
    }

    // Vérifier les limites ET incrémenter le compteur/débiter le crédit (APRÈS reCAPTCHA)
    const usageResult = await incrementFeatureCounter(userId, 'create_cv_manual', {});
    if (!usageResult.success) {
      return NextResponse.json({
        error: usageResult.error,
        actionRequired: usageResult.actionRequired,
        redirectUrl: usageResult.redirectUrl
      }, { status: 403 });
    }

    var now=new Date();
    var isoNow=now.toISOString();
    var generated_at=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0");
    var cv={ generated_at, header:{ full_name, current_title, contact:{ email, links:[], location:{} } }, summary:{ description:"", domains:[] },
      skills:{ hard_skills:[], tools:[], methodologies:[] }, experience:[], education:[], languages:[], extras:{ driver_licenses:[] }, projects:[],
      order_hint:["header","summary","skills","experience","education","languages","extras","projects"], section_titles:{ summary:"Résumé", skills:"Compétences", experience:"Expérience", education:"Éducation", languages:"Langues", extras:"Informations complémentaires", projects:"Projets personnels" },
      meta:{ generator:"manual", source:"manual", created_at:isoNow, updated_at:isoNow }
    };
    await ensureUserCvDir(userId);
    const existingFiles = await listUserCvFiles(userId).catch(() => []);
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

await writeUserCvFile(userId, file, JSON.stringify(cv,null,2));
await prisma.cvFile.upsert({
      where: { userId_filename: { userId, filename: file } },
      update: {},
      create: { userId, filename: file },
    });

// Tracking télémétrie - Création manuelle CV
try {
  await trackCvCreation({
    userId,
    deviceId: null,
    status: 'success',
  });
} catch (trackError) {
  console.error('[create-cv] Erreur tracking télémétrie:', trackError);
}

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
