import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/session";
import { listUserCvFiles, readUserCvFile } from "@/lib/cv/storage";
import { sanitizeInMemory } from "@/lib/sanitize";

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
  if (typeof value === "number"){ return Number.isNaN(value) ? null : value; }
  if (typeof value === "string"){
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = parseNumericTimestamp(trimmed);
    if (numeric) return numeric;
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

function formatDateLabel(timestamp){
  if (timestamp == null) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(){
  const session = await auth();
  if (!session?.user?.id){
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userId = session.user.id;
  const files = await listUserCvFiles(userId);
  const rawItems = [];

  for (const file of files){
    try {
      const raw = await readUserCvFile(userId, file);
      const json = sanitizeInMemory(JSON.parse(raw));
      const title = json?.header?.current_title ? String(json.header.current_title).trim() : "";
      const trimmedTitle = title || "";
      const generator = typeof json?.meta?.generator === "string"
        ? json.meta.generator.toLowerCase().trim()
        : "";
      const isLikelyGpt = /^(generated_chatgpt_cv|gpt_)/i.test(file);
      const rawSource = generator || (typeof json?.meta?.source === "string" ? json.meta.source : "manual");
      const source = typeof rawSource === "string" ? rawSource.toLowerCase().trim() || "manual" : "manual";
      const isImported = source === "pdf-import";
      const isGenerated = generator === "chatgpt" || generator === "openai" || source === "chatgpt" || isLikelyGpt;
      // Consider both AI-generated and PDF-imported CVs as "AI-powered" for display
      const isGpt = isGenerated || isImported;
      const isManual = !isGpt;
      const createdAtCandidates = [
        json?.meta?.created_at,
        json?.meta?.updated_at,
        json?.generated_at,
        json?.meta?.generated_at,
      ];
      let createdTimestamp = null;
      for (const candidate of createdAtCandidates){
        createdTimestamp = toTimestamp(candidate);
        if (createdTimestamp) break;
      }
      if (!createdTimestamp){
        createdTimestamp = timestampFromFilename(file);
      }
      const updatedTimestamp = toTimestamp(json?.meta?.updated_at);
      const createdAtIso = createdTimestamp ? new Date(createdTimestamp).toISOString() : (json?.meta?.created_at || null);
      const updatedAtIso = updatedTimestamp ? new Date(updatedTimestamp).toISOString() : (json?.meta?.updated_at || null);
      const dateLabel = formatDateLabel(createdTimestamp ?? updatedTimestamp ?? null);
      const hasTitle = trimmedTitle.length > 0;
      const fallbackTitle = hasTitle ? trimmedTitle : "CV en cours d'édition";
      const labelPrefix = `${dateLabel || "??/??/????"} - `;
      rawItems.push({
        file,
        label: `${labelPrefix}${fallbackTitle}`,
        title: trimmedTitle,
        hasTitle,
        dateLabel: dateLabel || null,
        isGpt,
        isImported,
        isGenerated,
        isManual,
        source,
        createdAt: createdAtIso,
        updatedAt: updatedAtIso,
        sortKey: createdTimestamp ?? updatedTimestamp ?? null,
      });
    } catch (error) {
      const isLikelyGpt = /^(generated_chatgpt_cv|gpt_)/i.test(file);
      const isLikelyImport = /^import/i.test(file);
      const isImported = isLikelyImport;
      const isGenerated = isLikelyGpt;
      const isGpt = isGenerated || isImported;
      const sortKey = timestampFromFilename(file);
      const dateLabel = formatDateLabel(sortKey);
      rawItems.push({
        file,
        label: file,
        title: "",
        hasTitle: false,
        dateLabel: dateLabel || null,
        isGpt,
        isImported,
        isGenerated,
        isManual: !isGpt,
        source: isGpt ? "chatgpt" : "manual",
        createdAt: null,
        updatedAt: null,
        sortKey,
      });
    }
  }

  rawItems.sort((a, b) => {
    const aKey = typeof a.sortKey === "number" ? a.sortKey : -Infinity;
    const bKey = typeof b.sortKey === "number" ? b.sortKey : -Infinity;
    if (aKey !== bKey) return bKey - aKey;
    return a.file.localeCompare(b.file);
  });

  const items = rawItems.map(({ sortKey, ...rest }) => rest);

  const currentCookie = (cookies().get("cvFile") || {}).value;
  const current = files.includes(currentCookie) ? currentCookie : (files[0] || null);

  return NextResponse.json({ items, current });
}
