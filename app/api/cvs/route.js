import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/session";
import { listUserCvFiles, readUserCvFile } from "@/lib/cv/storage";
import { sanitizeInMemory } from "@/lib/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(){
  const session = await auth();
  if (!session?.user?.id){
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userId = session.user.id;
  const files = await listUserCvFiles(userId);
  const items = [];

  for (const file of files){
    try {
      const raw = await readUserCvFile(userId, file);
      const json = sanitizeInMemory(JSON.parse(raw));
      const title = json?.header?.current_title ? String(json.header.current_title).trim() : "";
      const label = title || file.replace(/\.json$/, "");
      const isGpt = /^(generated_chatgpt_cv|gpt_)/i.test(file) || json?.meta?.generator === "chatgpt";
      const isMain = file === "main.json";
      items.push({ file, label, isGpt, isMain });
    } catch (error) {
      items.push({ file, label: file, isGpt: false, isMain: file === "main.json" });
    }
  }

  const currentCookie = (cookies().get("cvFile") || {}).value;
  const current = files.includes(currentCookie) ? currentCookie : "main.json";

  return NextResponse.json({ items, current });
}
