import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth/session";
import { ensureUserCvDir, listUserCvFiles, writeUserCvFile } from "@/lib/cv/storage";
import { trackCvCreation } from "@/lib/telemetry/server";
import { incrementFeatureCounter } from "@/lib/subscription/featureUsage";
import { verifyRecaptcha } from "@/lib/recaptcha/verifyRecaptcha";
import { CommonErrors, AuthErrors, CvErrors } from "@/lib/api/apiErrors";

export const runtime="nodejs"; export const dynamic="force-dynamic";
export async function POST(req){
  try{
    const session = await auth();
    if (!session?.user?.id){
      return CommonErrors.notAuthenticated();
    }

    var body=await req.json(); var full_name=(body.full_name||"").trim(); var current_title=(body.current_title||"").trim(); var email=(body.email||"").trim();
    var recaptchaToken=body.recaptchaToken;

    const userId = session.user.id;

    // Vérification reCAPTCHA (optionnelle pour compatibilité, mais recommandée)
    if (recaptchaToken) {
      const recaptchaResult = await verifyRecaptcha(recaptchaToken, {
        callerName: 'create-cv',
        scoreThreshold: 0.5,
      });

      if (!recaptchaResult.success) {
        return AuthErrors.recaptchaFailed();
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

    // CV JSON contient uniquement le contenu (8 sections), métadonnées en DB (CvFile.*)
    var cv={
      header:{ full_name, current_title, contact:{ email, links:[], location:{} } },
      summary:{ description:"", domains:[] },
      skills:{ hard_skills:[], tools:[], methodologies:[], soft_skills:[] },
      experience:[],
      education:[],
      languages:[],
      extras:[],
      projects:[]
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
  }catch(e){ return CvErrors.createError(); }
}
