#!/usr/bin/env node

/**
 * Script pour générer les événements TelemetryEvent manquants
 * basés sur les CV existants dans la base de données.
 *
 * Usage: node scripts/generate-missing-telemetry-events.js
 */

import prisma from '../lib/prisma.js';

// Event types (copié depuis lib/telemetry/server.js)
const EventTypes = {
  CV_GENERATED: 'CV_GENERATED',
  CV_IMPORTED: 'CV_IMPORTED',
  CV_CREATED_MANUAL: 'CV_CREATED_MANUAL',
  CV_TRANSLATED: 'CV_TRANSLATED',
};

const EventCategories = {
  CV_MANAGEMENT: 'cv_management',
};

// Mapping des types de création vers les types d'événements
const CREATED_BY_TO_EVENT_TYPE = {
  'generate-cv': EventTypes.CV_GENERATED,
  'generate-cv-job-title': EventTypes.CV_GENERATED,
  'create-template': EventTypes.CV_GENERATED,
  'import-pdf': EventTypes.CV_IMPORTED,
  'translate-cv': EventTypes.CV_TRANSLATED,
  null: EventTypes.CV_CREATED_MANUAL,
  '': EventTypes.CV_CREATED_MANUAL,
};

// Catégories d'événements
const EVENT_CATEGORIES = {
  [EventTypes.CV_GENERATED]: EventCategories.CV_MANAGEMENT,
  [EventTypes.CV_IMPORTED]: EventCategories.CV_MANAGEMENT,
  [EventTypes.CV_TRANSLATED]: EventCategories.CV_MANAGEMENT,
  [EventTypes.CV_CREATED_MANUAL]: EventCategories.CV_MANAGEMENT,
};

async function generateMissingEvents() {
  console.log('🔄 Début de la génération des événements TelemetryEvent manquants...\n');

  try {
    // 1. Récupérer tous les CV avec leurs métadonnées
    const allCvs = await prisma.cvFile.findMany({
      select: {
        id: true,
        userId: true,
        filename: true,
        createdBy: true,
        analysisLevel: true,
        sourceType: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    console.log(`📊 ${allCvs.length} CV trouvés dans la base\n`);

    let createdCount = 0;
    let skippedCount = 0;

    // Grouper les événements existants par userId + type + date pour un comptage précis
    const existingEventCounts = await prisma.telemetryEvent.groupBy({
      by: ['userId', 'type'],
      where: {
        type: {
          in: Object.values(CREATED_BY_TO_EVENT_TYPE),
        },
        status: 'success',
      },
      _count: {
        id: true,
      },
    });

    // Créer un Map pour accès rapide
    const eventCountMap = new Map();
    existingEventCounts.forEach(item => {
      const key = `${item.userId}_${item.type}`;
      eventCountMap.set(key, item._count.id);
    });

    // Grouper les CV par userId + eventType pour compter combien on devrait avoir
    const cvGrouped = {};
    for (const cv of allCvs) {
      const eventType = CREATED_BY_TO_EVENT_TYPE[cv.createdBy] || EventTypes.CV_CREATED_MANUAL;
      const key = `${cv.userId}_${eventType}`;

      if (!cvGrouped[key]) {
        cvGrouped[key] = [];
      }
      cvGrouped[key].push(cv);
    }

    // Pour chaque groupe, créer les événements manquants
    for (const [key, cvs] of Object.entries(cvGrouped)) {
      const expectedCount = cvs.length;
      const actualCount = eventCountMap.get(key) || 0;
      const missingCount = expectedCount - actualCount;

      if (missingCount <= 0) {
        skippedCount += expectedCount;
        continue;
      }

      // Créer les événements manquants (en prenant les derniers CV pour être cohérent)
      const cvsToCreate = cvs.slice(-missingCount);

      for (const cv of cvsToCreate) {
        const eventType = CREATED_BY_TO_EVENT_TYPE[cv.createdBy] || EventTypes.CV_CREATED_MANUAL;
        const category = EVENT_CATEGORIES[eventType];

        // Créer l'événement manquant
        const metadata = {};

        // Ajouter analysisLevel si disponible
        if (cv.analysisLevel) {
          metadata.analysisLevel = cv.analysisLevel;
        }

        // Ajouter sourceType si disponible
        if (cv.sourceType) {
          metadata.sourceType = cv.sourceType;
        }

        // Ajouter une note indiquant que c'est un événement rétroactif
        metadata.retroactive = true;

        await prisma.telemetryEvent.create({
          data: {
            type: eventType,
            category,
            userId: cv.userId,
            metadata: JSON.stringify(metadata),
            status: 'success',
            timestamp: cv.createdAt,
            createdAt: cv.createdAt, // Utiliser la vraie date de création du CV
          },
        });

        createdCount++;
        console.log(`  ✨ Événement créé: ${eventType} pour userId=${cv.userId} (${cv.filename}) à ${cv.createdAt.toISOString()}`);
      }
    }

    console.log('\n✅ Génération terminée avec succès !');
    console.log(`  - ${createdCount} événement(s) créé(s)`);
    console.log(`  - ${skippedCount} événement(s) déjà existant(s)`);

  } catch (error) {
    console.error('❌ Erreur lors de la génération:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
generateMissingEvents();
