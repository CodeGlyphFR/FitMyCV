/**
 * GET /api/ext/cvs
 *
 * Extension proxy for CV list. Same logic as /api/cvs but with Bearer token auth.
 */

import { NextResponse } from 'next/server';
import { withExtensionAuth } from '@/lib/api/withExtensionAuth';
import { listUserCvFiles, readUserCvFile } from '@/lib/cv-core/storage';
import { sanitizeInMemory } from '@/lib/sanitize';
import prisma from '@/lib/prisma';
import { toTimestamp, timestampFromFilename, formatDateLabel } from '@/lib/utils/timestampUtils';
import { CommonErrors } from '@/lib/api/apiErrors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withExtensionAuth(async (request, { userId }) => {
  try {
    const files = await listUserCvFiles(userId);

    const cvFilesData = await prisma.cvFile.findMany({
      where: { userId, filename: { in: files } },
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

    for (const file of files) {
      try {
        const raw = await readUserCvFile(userId, file);
        const json = sanitizeInMemory(JSON.parse(raw));
        const title = json?.header?.current_title ? String(json.header.current_title).trim() : '';
        const trimmedTitle = title || '';

        const sourceData = sourceMap.get(file);
        const createdBy = sourceData?.createdBy || null;
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

        const dateLabel = formatDateLabel(mostRecentTimestamp);
        const hasTitle = trimmedTitle.length > 0;
        const fallbackTitle = hasTitle ? trimmedTitle : "CV en cours d'édition";

        rawItems.push({
          file,
          label: `${dateLabel || '??/??/????'} - ${fallbackTitle}`,
          title: trimmedTitle,
          hasTitle,
          dateLabel: dateLabel || null,
          sourceType: sourceData?.sourceType || null,
          sourceValue: sourceData?.sourceValue || null,
          createdBy,
          originalCreatedBy: sourceData?.originalCreatedBy || null,
          isGenerated,
          isImported,
          isManual,
          isTranslated: sourceData?.isTranslated || false,
          language: cvLanguage,
          createdAt: createdTimestamp ? new Date(createdTimestamp).toISOString() : null,
          updatedAt: updatedTimestamp ? new Date(updatedTimestamp).toISOString() : (json?.meta?.updated_at || null),
          sortKey: sortTimestamp,
        });
      } catch {
        const sourceData = sourceMap.get(file);
        const createdBy = sourceData?.createdBy || null;
        const dbCreatedAt = sourceData?.dbCreatedAt || null;
        const sortKey = dbCreatedAt ? new Date(dbCreatedAt).getTime() : timestampFromFilename(file);
        const dateLabel = formatDateLabel(sortKey);

        rawItems.push({
          file,
          label: file,
          title: '',
          hasTitle: false,
          dateLabel: dateLabel || null,
          sourceType: sourceData?.sourceType || null,
          sourceValue: sourceData?.sourceValue || null,
          createdBy,
          originalCreatedBy: sourceData?.originalCreatedBy || null,
          isGenerated: createdBy === 'generate-cv',
          isImported: createdBy === 'import-pdf',
          isManual: createdBy === null,
          isTranslated: sourceData?.isTranslated || false,
          language: sourceData?.language || null,
          createdAt: null,
          updatedAt: null,
          sortKey,
        });
      }
    }

    rawItems.sort((a, b) => {
      const aKey = typeof a.sortKey === 'number' ? a.sortKey : -Infinity;
      const bKey = typeof b.sortKey === 'number' ? b.sortKey : -Infinity;
      if (aKey !== bKey) return bKey - aKey;
      return a.file.localeCompare(b.file);
    });

    const items = rawItems.map(({ sortKey, ...rest }) => rest);

    // For extension, use first file as current (no cookie access)
    const current = files[0] || null;

    return NextResponse.json({ items, current });
  } catch (error) {
    console.error('[ext/cvs] Error:', error);
    return CommonErrors.serverError();
  }
});
