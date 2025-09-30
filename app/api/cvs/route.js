import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/session";
import { listUserCvFiles, readUserCvFile } from "@/lib/cv/storage";
import { sanitizeInMemory } from "@/lib/sanitize";
import prisma from "@/lib/prisma";

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
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
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

  // Récupérer tous les sourceType et createdBy depuis la DB en une seule requête
  const cvFilesData = await prisma.cvFile.findMany({
    where: {
      userId,
      filename: { in: files }
    },
    select: {
      filename: true,
      sourceType: true,
      sourceValue: true,
      createdBy: true,
    },
  });

  // Créer une map pour un accès rapide
  const sourceMap = new Map(cvFilesData.map(cf => [cf.filename, {
    sourceType: cf.sourceType,
    sourceValue: cf.sourceValue,
    createdBy: cf.createdBy
  }]));

  const rawItems = [];

  for (const file of files){
    try {
      const raw = await readUserCvFile(userId, file);
      const json = sanitizeInMemory(JSON.parse(raw));
      const title = json?.header?.current_title ? String(json.header.current_title).trim() : "";
      const trimmedTitle = title || "";

      // Récupérer les données de source depuis la DB
      const sourceData = sourceMap.get(file);
      const sourceType = sourceData?.sourceType || null;
      const sourceValue = sourceData?.sourceValue || null;
      const createdBy = sourceData?.createdBy || null;

      // Déterminer le type de CV basé sur createdBy
      // createdBy = 'generate-cv' => Généré par IA (icon GPT)
      // createdBy = 'import-pdf' => Importé depuis PDF (icon Import)
      // createdBy = null => Créé manuellement (pas d'icon)
      const isGenerated = createdBy === 'generate-cv';
      const isImported = createdBy === 'import-pdf';
      const isManual = createdBy === null;
      // Get all timestamps
      const createdTimestamp = toTimestamp(json?.meta?.created_at) || toTimestamp(json?.generated_at) || toTimestamp(json?.meta?.generated_at) || timestampFromFilename(file);
      const updatedTimestamp = toTimestamp(json?.meta?.updated_at);

      // Use the most recent timestamp for sorting and display
      const mostRecentTimestamp = updatedTimestamp && updatedTimestamp > createdTimestamp ? updatedTimestamp : createdTimestamp;

      const createdAtIso = createdTimestamp ? new Date(createdTimestamp).toISOString() : (json?.meta?.created_at || null);
      const updatedAtIso = updatedTimestamp ? new Date(updatedTimestamp).toISOString() : (json?.meta?.updated_at || null);
      const dateLabel = formatDateLabel(mostRecentTimestamp);
      const hasTitle = trimmedTitle.length > 0;
      const fallbackTitle = hasTitle ? trimmedTitle : "CV en cours d'édition";
      const labelPrefix = `${dateLabel || "??/??/????"} - `;
      rawItems.push({
        file,
        label: `${labelPrefix}${fallbackTitle}`,
        title: trimmedTitle,
        hasTitle,
        dateLabel: dateLabel || null,
        sourceType, // 'link', 'pdf', ou null
        sourceValue, // URL ou nom de fichier PDF
        createdBy, // 'generate-cv', 'import-pdf', ou null
        isGenerated, // true si createdBy === 'generate-cv'
        isImported, // true si createdBy === 'import-pdf'
        isManual, // true si createdBy === null
        createdAt: createdAtIso,
        updatedAt: updatedAtIso,
        sortKey: mostRecentTimestamp,
      });
    } catch (error) {
      // En cas d'erreur de lecture, utiliser les données de la DB si disponibles
      const sourceData = sourceMap.get(file);
      const sourceType = sourceData?.sourceType || null;
      const sourceValue = sourceData?.sourceValue || null;
      const createdBy = sourceData?.createdBy || null;

      const isGenerated = createdBy === 'generate-cv';
      const isImported = createdBy === 'import-pdf';
      const isManual = createdBy === null;

      const sortKey = timestampFromFilename(file);
      const dateLabel = formatDateLabel(sortKey);
      rawItems.push({
        file,
        label: file,
        title: "",
        hasTitle: false,
        dateLabel: dateLabel || null,
        sourceType,
        sourceValue,
        createdBy,
        isGenerated,
        isImported,
        isManual,
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
