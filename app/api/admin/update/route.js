import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/session";
import { listUserCvFiles, readUserCvFile, writeUserCvFile } from "@/lib/cv/storage";
import { sanitizeInMemory } from "@/lib/sanitize";
import { validateCv } from "@/lib/cv/validation";
import { incrementFeatureCounter, canUseFeature } from "@/lib/subscription/featureUsage";

export const runtime="nodejs"; export const dynamic="force-dynamic";
function parsePath(p){ var out=[]; var re=/([^\[.]+)|\[(\d+)\]/g; var m; while((m=re.exec(p))!==null){ if(m[1]!=null) out.push(m[1]); else if(m[2]!=null) out.push(Number(m[2])); } return out; }
function setByPath(obj, arr, value){ var cur=obj; for(var i=0;i<arr.length-1;i++){ var k=arr[i]; if(cur[k]==null) cur[k] = (typeof arr[i+1]==="number")? []:{}; cur=cur[k]; } cur[arr[arr.length-1]] = value; }
export async function POST(req){
  try{
    const session = await auth();
    if (!session?.user?.id){
      return NextResponse.json({ error:"Non authentifié" }, { status:401 });
    }

    var body=await req.json(); var fieldPath=body.path; var value=body.value; if(!fieldPath) return NextResponse.json({ error:"Paramètre 'path' manquant"},{ status:400 });
    const userId = session.user.id;
    const files = await listUserCvFiles(userId);
    const currentCookie = (cookies().get("cvFile")||{}).value;
    var selected = files.includes(currentCookie) ? currentCookie : (files[0] || null);
    if (!selected) return NextResponse.json({ error: "Aucun CV disponible" }, { status: 404 });
    var cv=JSON.parse(await readUserCvFile(userId, selected));

    // Tracker l'édition seulement si c'est la première fois qu'on édite ce CV
    // (c'est-à-dire si le generator n'est pas encore "manual")
    const isFirstEdit = cv.meta?.generator && cv.meta.generator !== "manual";
    if (isFirstEdit) {
      // Vérifier les limites
      const check = await canUseFeature(userId, 'edit_cv');
      if (!check.canUse) {
        return NextResponse.json({ error: check.reason }, { status: 403 });
      }

      // Incrémenter le compteur/débiter le crédit
      const usageResult = await incrementFeatureCounter(userId, 'edit_cv', {});
      if (!usageResult.success) {
        return NextResponse.json({
          error: usageResult.error,
          actionRequired: usageResult.actionRequired,
          redirectUrl: usageResult.redirectUrl
        }, { status: 403 });
      }
    }

    setByPath(cv, parsePath(fieldPath), value);
    const sanitized = sanitizeInMemory(cv);

    // Validation (optionnelle, pas bloquante)
    const { valid, errors } = await validateCv(sanitized);
    if (!valid) {
      console.warn(`[update] CV validation errors for ${userId}/${selected}:`, errors);
    }

    const isoNow = new Date().toISOString();
    const meta = {
      ...(sanitized.meta || {}),
      updated_at: isoNow,
    };
    if (!meta.created_at) meta.created_at = isoNow;
    if (!meta.generator) meta.generator = selected === "main.json" ? "raw" : "manual";
    if (!meta.source){
      meta.source = selected === "main.json" ? "raw" : "manual";
    }
    sanitized.meta = meta;
    await writeUserCvFile(userId, selected, JSON.stringify(sanitized, null, 2));
    return NextResponse.json({ ok:true });
  }catch(e){ return NextResponse.json({ error:(e&&e.message)||"Erreur inconnue" },{ status:500 }); }
}
