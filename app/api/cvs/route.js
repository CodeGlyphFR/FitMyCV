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
      const originalCreatedBy = sourceData?.originalCreatedBy || null;
      const isTranslated = sourceData?.isTranslated || false;
      const dbCreatedAt = sourceData?.dbCreatedAt || null;

      // Récupérer la langue du CV (priorité DB, fallback JSON)
      const cvLanguage = sourceData?.language || json?.language || null;

      // Déterminer le type de CV basé sur createdBy
      // createdBy = 'generate-cv' => Généré par IA (icon GPT)
      // createdBy = 'import-pdf' => Importé depuis PDF (icon Import)
      // createdBy = 'translate-cv' => Traduit (icon basée sur originalCreatedBy + T)
      // createdBy = null => Créé manuellement (pas d'icon)
      const isGenerated = createdBy === 'generate-cv';
      const isImported = createdBy === 'import-pdf';
      const isManual = createdBy === null;
      // Get all timestamps - priorité à la DB car generated_at peut être supprimé lors des éditions
      const dbCreatedAtTimestamp = dbCreatedAt ? new Date(dbCreatedAt).getTime() : null;
      const jsonCreatedTimestamp = toTimestamp(json?.meta?.created_at) || toTimestamp(json?.generated_at) || toTimestamp(json?.meta?.generated_at) || timestampFromFilename(file);
      const createdTimestamp = dbCreatedAtTimestamp || jsonCreatedTimestamp;
      const updatedTimestamp = toTimestamp(json?.meta?.updated_at);

      // Use the most recent timestamp for sorting and display
      const mostRecentTimestamp = updatedTimestamp && updatedTimestamp > createdTimestamp ? updatedTimestamp : createdTimestamp;

      // Utiliser dbCreatedAt pour le tri (priorité à la base de données)
      const sortTimestamp = dbCreatedAtTimestamp || mostRecentTimestamp;

      const createdAtIso = createdTimestamp ? new Date(createdTimestamp).toISOString() : null;
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
        createdBy, // 'generate-cv', 'import-pdf', 'translate-cv', ou null
        originalCreatedBy, // createdBy original pour les CV traduits
        isGenerated, // true si createdBy === 'generate-cv'
        isImported, // true si createdBy === 'import-pdf'
        isManual, // true si createdBy === null
        isTranslated, // true si c'est un CV traduit
        language: cvLanguage, // 'fr', 'en', ou null
        createdAt: createdAtIso,
        updatedAt: updatedAtIso,
        sortKey: sortTimestamp, // Utiliser le timestamp de la DB pour le tri
      });
    } catch (error) {
      // En cas d'erreur de lecture, utiliser les données de la DB si disponibles
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

      // Utiliser dbCreatedAt pour le tri, sinon fallback sur le timestamp du filename
      const sortKey = dbCreatedAt ? new Date(dbCreatedAt).getTime() : timestampFromFilename(file);
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
        originalCreatedBy,
        isGenerated,
        isImported,
        isManual,
        isTranslated,
        language: sourceData?.language || null, // Utiliser la langue de la DB si disponible
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

  // Next.js 16: cookies() est maintenant async
  const cookieStore = await cookies();
  const currentCookie = (cookieStore.get("cvFile") || {}).value;
  const current = files.includes(currentCookie) ? currentCookie : (files[0] || null);

  return NextResponse.json({ items, current });
}
