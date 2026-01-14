import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { CommonErrors } from '@/lib/api/apiErrors';
import prisma from '@/lib/prisma';

// Cache en mémoire pour éviter trop de requêtes à la base
let settingsCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 10000; // 10 secondes

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/settings
 * Récupère tous les paramètres de configuration depuis la table Setting
 * Retourne un objet avec les noms de settings comme clés et les valeurs comme valeurs
 */
export async function GET(request) {
  try {
    // Vérifier l'authentification
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    const now = Date.now();

    // Utiliser le cache si valide
    if (settingsCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        settings: settingsCache,
        cached: true,
      });
    }

    // Récupérer tous les settings depuis la base
    const allSettings = await prisma.setting.findMany({
      select: {
        settingName: true,
        value: true,
      },
    });

    // Transformer en objet key-value
    const settingsObject = {};
    allSettings.forEach((setting) => {
      // Convertir "1" en true et "0" en false
      settingsObject[setting.settingName] = setting.value === '1';
    });

    // Valeurs par défaut si les settings n'existent pas en base
    const defaultSettings = {
      registration_enabled: true,
      feature_manual_cv: true,
      feature_ai_generation: true,
      feature_import: true,
      feature_export: true,
      feature_match_score: true,
      feature_optimize: true,
      feature_history: true,
      feature_search_bar: true,
      feature_translate: true,
      feature_language_switcher: true,
      feature_edit_mode: true,
      feature_feedback: true,
    };

    // Fusionner avec les valeurs par défaut
    const finalSettings = { ...defaultSettings, ...settingsObject };

    // Mettre à jour le cache
    settingsCache = finalSettings;
    cacheTimestamp = now;

    return NextResponse.json({
      success: true,
      settings: finalSettings,
      cached: false,
    });
  } catch (error) {
    console.error('[API Settings] Erreur lors de la récupération des settings:', error);

    // En cas d'erreur, retourner les valeurs par défaut
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la récupération des paramètres',
        settings: {
          registration_enabled: true,
          feature_manual_cv: true,
          feature_ai_generation: true,
          feature_import: true,
          feature_export: true,
          feature_match_score: true,
          feature_optimize: true,
          feature_history: true,
          feature_search_bar: true,
          feature_translate: true,
          feature_language_switcher: true,
          feature_edit_mode: true,
          feature_feedback: true,
        },
      },
      { status: 200 } // On retourne 200 avec les valeurs par défaut pour ne pas casser l'app
    );
  }
}
