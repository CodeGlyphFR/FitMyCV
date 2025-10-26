import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/session";
import { listUserCvFiles, readUserCvFile, writeUserCvFile } from "@/lib/cv/storage";
import { sanitizeInMemory } from "@/lib/sanitize";
import { validateCv } from "@/lib/cv/validation";
import prisma from "@/lib/prisma";
import { trackCvEdit } from "@/lib/telemetry/server";
import { incrementFeatureCounter, canUseFeature } from "@/lib/subscription/featureUsage";

export const runtime="nodejs"; export const dynamic="force-dynamic";
function parsePath(p){ var out=[]; var re=/([^\[.]+)|\[(\d+)\]/g; var m; while((m=re.exec(p))!==null){ if(m[1]!=null) out.push(m[1]); else if(m[2]!=null) out.push(Number(m[2])); } return out; }
function getByPath(obj, arr){ var cur=obj; for(var i=0;i<arr.length;i++){ if(cur==null) return undefined; cur=cur[arr[i]]; } return cur; }
function setByPath(obj, arr, value){ var cur=obj; for(var i=0;i<arr.length-1;i++){ var k=arr[i]; if(cur[k]==null) cur[k] = (typeof arr[i+1]==="number")? []:{}; cur=cur[k]; } cur[arr[arr.length-1]] = value; }
export async function POST(req){
  try{
    const session = await auth();
    if (!session?.user?.id){
      return NextResponse.json({ error:"Non authentifié"},{ status:401 });
    }

    var body=await req.json(); var op=body.op, fieldPath=body.path, value=body.value, index=body.index, to=body.to; if(!fieldPath||!op) return NextResponse.json({ error:"Paramètres manquants"},{ status:400 });
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

    var tokens=parsePath(fieldPath); var parentPath=tokens.slice(0,-1); var key=tokens[tokens.length-1]; var targetParent=getByPath(cv,parentPath);
    switch(op){
      case "set": setByPath(cv, tokens, value); break;
      case "push": { var arr=getByPath(cv, tokens); if(!Array.isArray(arr)) setByPath(cv, tokens, []); (getByPath(cv, tokens)).push(value); break; }
      case "insert": { var arr2=getByPath(cv, tokens); if(!Array.isArray(arr2)) return NextResponse.json({ error:"Target n'est pas un tableau"},{ status:400 }); var i=(typeof index==="number")? index:arr2.length; arr2.splice(i,0,value); break; }
      case "remove": { if(typeof key==="number"){ if(!Array.isArray(targetParent)) return NextResponse.json({ error:"Parent n'est pas un tableau"},{ status:400 }); targetParent.splice(key,1); } else if(typeof index==="number"){ var arr3=getByPath(cv, tokens); if(!Array.isArray(arr3)) return NextResponse.json({ error:"Target n'est pas un tableau"},{ status:400 }); arr3.splice(index,1); } else { if(targetParent && typeof targetParent==="object"){ delete targetParent[key]; } } break; }
      case "move": { var arr4=getByPath(cv, tokens); if(!Array.isArray(arr4)) return NextResponse.json({ error:"Target n'est pas un tableau"},{ status:400 }); if(typeof index!=="number"||typeof to!=="number") return NextResponse.json({ error:"index/to manquant"},{ status:400 }); var item=arr4.splice(index,1)[0]; arr4.splice(to,0,item); break; }
      default: return NextResponse.json({ error:"Opération inconnue"},{ status:400 });
    }
    const sanitized = sanitizeInMemory(cv);

    // Validation (optionnelle, pas bloquante)
    const { valid, errors } = await validateCv(sanitized);
    if (!valid) {
      console.warn(`[mutate] CV validation errors for ${userId}/${selected}:`, errors);
    }

    const isoNow = new Date().toISOString();
    // Préserver les métadonnées importantes du CV original
    const originalMeta = cv.meta || {};
    const meta = {
      ...originalMeta, // Préserve improved_from, changes_made, etc.
      updated_at: isoNow,
    };
    if (!meta.created_at) meta.created_at = isoNow;
    if (!meta.generator) meta.generator = selected === "main.json" ? "raw" : "manual";
    if (!meta.source){
      meta.source = selected === "main.json" ? "raw" : "manual";
    }
    sanitized.meta = meta;
    await writeUserCvFile(userId, selected, JSON.stringify(sanitized,null,2));

    // Vérifier si une entrée existe dans la DB pour ce CV
    const existingCvFile = await prisma.cvFile.findUnique({
      where: {
        userId_filename: {
          userId: userId,
          filename: selected
        }
      }
    });

    if (existingCvFile) {
      // Si l'entrée existe, mettre à jour uniquement la date sans toucher aux métadonnées importantes
      await prisma.cvFile.update({
        where: {
          userId_filename: {
            userId: userId,
            filename: selected
          }
        },
        data: {
          updatedAt: new Date()
          // Ne PAS modifier sourceType, sourceValue, createdBy, etc.
        }
      });
    } else {
      // Si l'entrée n'existe pas (cas du main.json initial par exemple), la créer
      // avec des valeurs par défaut qui ne casseront pas le système
      await prisma.cvFile.create({
        data: {
          userId: userId,
          filename: selected,
          sourceType: null, // Garder null pour ne pas interférer avec la détection
          sourceValue: null,
          createdBy: 'manual-edit',
          updatedAt: new Date()
        }
      });
    }

    // Tracking télémétrie - Édition CV
    try {
      // Extraire section et field depuis fieldPath
      const tokens = parsePath(fieldPath);
      const section = tokens.length > 0 ? String(tokens[0]) : 'unknown';
      const field = tokens.length > 1 ? String(tokens[1]) : null;

      await trackCvEdit({
        userId,
        deviceId: null,
        operation: op,
        section,
        field,
      });
    } catch (trackError) {
      console.error('[mutate] Erreur tracking télémétrie:', trackError);
    }

    return NextResponse.json({ ok:true });
  }catch(e){ return NextResponse.json({ error:(e&&e.message)||"Erreur inconnue"},{ status:500 }); }
}
