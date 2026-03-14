import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/session";
import { listUserCvFiles, readUserCvFile } from "@/lib/cv-core/storage";
import { sanitizeInMemory } from "@/lib/sanitize";
import prisma from "@/lib/prisma";
import { CommonErrors } from "@/lib/api/apiErrors";
import { toTimestamp, timestampFromFilename, formatDateLabel } from "@/lib/utils/timestampUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(){
  const session = await auth();
  if (!session?.user?.id){
    return CommonErrors.notAuthenticated();
  }

  const userId = session.user.id;
  const files = await listUserCvFiles(userId);

  // Récupérer tous les sourceType, createdBy, isTranslated, originalCreatedBy, language et createdAt depuis la DB en une seule requête
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
      originalCreatedBy: true,
      isTranslated: true,
      language: true,
      createdAt: true,
    },
  });

  // Créer une map pour un accès rapide
  const sourceMap = new Map(cvFilesData.map(cf => [cf.filename, {
    sourceType: cf.sourceType,
    sourceValue: cf.sourceValue,
    createdBy: cf.createdBy,
    originalCreatedBy: cf.originalCreatedBy,
    isTranslated: cf.isTranslated,
    language: cf.language,
    dbCreatedAt: cf.createdAt,
  }]));

  // Lire tous les fichiers CV en parallèle (max 10 concurrents) au lieu de séquentiellement
  const pLimit = (await import('p-limit')).default;
  const limit = pLimit(10);

  const rawItems = await Promise.all(files.map(file => limit(async () => {
    try {
      const raw = await readUserCvFile(userId, file);
      const json = sanitizeInMemory(JSON.parse(raw));
      const title = json?.header?.current_title ? String(json.header.current_title).trim() : "";
      const trimmedTitle = title || "";

      const sourceData = sourceMap.get(file);
      const sourceType = sourceData?.sourceType || null;
      const sourceValue = sourceData?.sourceValue || null;
      const createdBy = sourceData?.createdBy || null;
      const originalCreatedBy = sourceData?.originalCreatedBy || null;
      const isTranslated = sourceData?.isTranslated || false;
      const dbCreatedAt = sourceData?.dbCreatedAt || null;

      const cvLanguage = sourceData?.language || json?.language || null;

      const isGenerated = createdBy === 'generate-cv';
      const isImported = createdBy === 'import-pdf';
      const isManual = createdBy === null;
      const dbCreatedAtTimestamp = dbCreatedAt ? new Date(dbCreatedAt).getTime() : null;
      const jsonCreatedTimestamp = toTimestamp(json?.meta?.created_at) || toTimestamp(json?.generated_at) || toTimestamp(json?.meta?.generated_at) || timestampFromFilename(file);
      const createdTimestamp = dbCreatedAtTimestamp || jsonCreatedTimestamp;
      const updatedTimestamp = toTimestamp(json?.meta?.updated_at);

      const mostRecentTimestamp = updatedTimestamp && updatedTimestamp > createdTimestamp ? updatedTimestamp : createdTimestamp;
      const sortTimestamp = dbCreatedAtTimestamp || mostRecentTimestamp;

      const createdAtIso = createdTimestamp ? new Date(createdTimestamp).toISOString() : null;
      const updatedAtIso = updatedTimestamp ? new Date(updatedTimestamp).toISOString() : (json?.meta?.updated_at || null);
      const dateLabel = formatDateLabel(mostRecentTimestamp);
      const hasTitle = trimmedTitle.length > 0;
      const fallbackTitle = hasTitle ? trimmedTitle : "CV en cours d'édition";
      const labelPrefix = `${dateLabel || "??/??/????"} - `;
      return {
        file,
        label: `${labelPrefix}${fallbackTitle}`,
        title: trimmedTitle,
        hasTitle,
        dateLabel: dateLabel || null,
        sourceType,
        sourceValue,
        createdBy,
        originalCreatedBy,
        isGenerated,
        isImported,
        isManual,
        isTranslated,
        language: cvLanguage,
        createdAt: createdAtIso,
        updatedAt: updatedAtIso,
        sortKey: sortTimestamp,
      };
    } catch (error) {
      const sourceData = sourceMap.get(file);
      const sourceType = sourceData?.sourceType || null;
      const sourceValue = sourceData?.sourceValue || null;
      const createdBy = sourceData?.createdBy || null;
      const originalCreatedBy = sourceData?.originalCreatedBy || null;
      const isTranslated = sourceData?.isTranslated || false;
      const dbCreatedAt = sourceData?.dbCreatedAt || null;

      const isGenerated = createdBy === 'generate-cv';
      const isImported = createdBy === 'import-pdf';
      const isManual = createdBy === null;

      const sortKey = dbCreatedAt ? new Date(dbCreatedAt).getTime() : timestampFromFilename(file);
      const dateLabel = formatDateLabel(sortKey);
      return {
        file,
        label: file,
        title: "",
        hasTitle: false,
        dateLabel: dateLabel || null,
        sourceType,
        sourceValue,
        createdBy,
        originalCreatedBy,
        isGenerated,
        isImported,
        isManual,
        isTranslated,
        language: sourceData?.language || null,
        createdAt: null,
        updatedAt: null,
        sortKey,
      };
    }
  })));

  rawItems.sort((a, b) => {
    const aKey = typeof a.sortKey === "number" ? a.sortKey : -Infinity;
    const bKey = typeof b.sortKey === "number" ? b.sortKey : -Infinity;
    if (aKey !== bKey) return bKey - aKey;
    return a.file.localeCompare(b.file);
  });

  const items = rawItems.map(({ sortKey, ...rest }) => rest);

  // Next.js 16: cookies() est maintenant async
  const cookieStore = await cookies();
  const currentCookie = (cookieStore.get("cvFile") || {}).value;
  const current = files.includes(currentCookie) ? currentCookie : (files[0] || null);

  const response = NextResponse.json({ items, current });

  // Re-set the cookie without httpOnly to clean up stale httpOnly cookies
  // left by previous versions of /api/cvs/create
  if (current) {
    response.cookies.set('cvFile', current, {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  return response;
}
