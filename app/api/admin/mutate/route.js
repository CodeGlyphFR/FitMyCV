import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/session";
import { listUserCvFiles, readUserCvFile, writeUserCvFile } from "@/lib/cv/storage";
import { sanitizeInMemory } from "@/lib/sanitize";

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
    var selected=(cookies().get("cvFile")||{}).value || "main.json";
    if (!files.includes(selected)) selected = "main.json";
    var cv=JSON.parse(await readUserCvFile(userId, selected));
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
    await writeUserCvFile(userId, selected, JSON.stringify(sanitized,null,2)); return NextResponse.json({ ok:true });
  }catch(e){ return NextResponse.json({ error:(e&&e.message)||"Erreur inconnue"},{ status:500 }); }
}
