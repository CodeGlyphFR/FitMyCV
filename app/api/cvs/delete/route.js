import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { ensureUserCvDir, listUserCvFiles, readUserCvFile, writeUserCvFile } from "@/lib/cv/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isJsonFileSafe(name){
  if (typeof name !== "string") return false;
  if (name.includes("/") || name.includes("\\") ) return false;
  return name.toLowerCase().endsWith(".json");
}

function parseNumericTimestamp(value){
  if (!value) return null;
  const str = String(value).trim();
  if (!/^\d+$/.test(str)) return null;
  if (str.length === 13){
    const num = Number(str);
    return Number.isNaN(num) ? null : num;
  }
  if (str.length >= 14){
    const year = Number(str.slice(0, 4));
    const month = Number(str.slice(4, 6)) - 1;
    const day = Number(str.slice(6, 8));
    const hours = Number(str.slice(8, 10) || "0");
    const minutes = Number(str.slice(10, 12) || "0");
    const seconds = Number(str.slice(12, 14) || "0");
    const millis = Number(str.slice(14, 17) || "0");
    if ([year, month, day, hours, minutes, seconds, millis].some((n) => Number.isNaN(n))) return null;
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    const ts = Date.UTC(year, month, day, hours, minutes, seconds, millis);
    return Number.isNaN(ts) ? null : ts;
  }
  return null;
}

function toTimestamp(value){
  if (!value) return null;
  if (typeof value === "number") return Number.isNaN(value) ? null : value;
  if (typeof value === "string"){
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = parseNumericTimestamp(trimmed);
    if (numeric != null) return numeric;
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function timestampFromFilename(name){
  if (!name) return null;
  const base = name.replace(/\.json$/i, "");
  return parseNumericTimestamp(base);
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

async function computeSortKey(userId, dir, file){
  try {
    const raw = await readUserCvFile(userId, file);
    try {
      const json = JSON.parse(raw);
      const candidates = [
        json?.meta?.updated_at,
        json?.meta?.created_at,
        json?.meta?.generated_at,
        json?.generated_at,
      ];
      for (const candidate of candidates){
        const ts = toTimestamp(candidate);
        if (ts != null) return ts;
      }
    } catch (_err) {}
  } catch (_err) {}

  const filenameTimestamp = timestampFromFilename(file);
  if (filenameTimestamp != null) return filenameTimestamp;

  try {
    const stat = await fs.stat(path.join(dir, file));
    if (stat?.mtimeMs) return stat.mtimeMs;
    if (stat?.ctimeMs) return stat.ctimeMs;
  } catch (_err) {}

  return null;
}

async function pickNextFile(userId, dir, files){
  const jsonFiles = (files || []).filter((name) => name && name.toLowerCase().endsWith(".json"));
  if (!jsonFiles.length) return null;

  const entries = [];
  for (const file of jsonFiles){
    const key = await computeSortKey(userId, dir, file);
    entries.push({ file, key: typeof key === "number" ? key : -Infinity });
  }

  entries.sort((a, b) => {
    if (a.key !== b.key) return b.key - a.key;
    return a.file.localeCompare(b.file);
  });

  const preferred = entries.find((entry) => entry.file !== "main.json");
  if (preferred) return preferred.file;

  return entries.length ? entries[0].file : null;
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
    let nextFile = await pickNextFile(session.user.id, dir, all);
    if (!nextFile && all.length > 0) nextFile = all[0];
    if (!nextFile) nextFile = await ensureAtLeastOneCV(session.user.id);
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
