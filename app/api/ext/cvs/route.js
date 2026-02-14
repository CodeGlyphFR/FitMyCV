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

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function parseNumericTimestamp(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!/^\d+$/.test(str)) return null;
  if (str.length === 13) {
    const num = Number(str);
    return Number.isNaN(num) ? null : num;
  }
  if (str.length >= 14) {
    const year = Number(str.slice(0, 4));
    const month = Number(str.slice(4, 6)) - 1;
    const day = Number(str.slice(6, 8));
    const hours = Number(str.slice(8, 10) || '0');
    const minutes = Number(str.slice(10, 12) || '0');
    const seconds = Number(str.slice(12, 14) || '0');
    const millis = Number(str.slice(14, 17) || '0');
    if ([year, month, day, hours, minutes, seconds, millis].some((n) => Number.isNaN(n))) return null;
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    const ts = Date.UTC(year, month, day, hours, minutes, seconds, millis);
    return Number.isNaN(ts) ? null : ts;
  }
  return null;
}

function toTimestamp(value) {
  if (!value) return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = parseNumericTimestamp(trimmed);
    if (numeric) return numeric;
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function timestampFromFilename(name) {
  if (!name) return null;
  const base = name.replace(/\.json$/i, '');
  return parseNumericTimestamp(base);
}

function formatDateLabel(timestamp) {
  if (timestamp == null) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

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
    return NextResponse.json({ error: 'Failed to fetch CV list' }, { status: 500 });
  }
});
