import { fromPath } from 'pdf2pic';
import sharp from 'sharp';
import os from 'os';
import prisma from '@/lib/prisma';

// Configuration par défaut pour la conversion PDF → images
const PDF_CONVERSION_CONFIG = {
  MAX_PAGES: 10,
  MAX_WIDTH: 1000,
  DENSITY: 100,
  FORMAT: 'jpeg',
  QUALITY: 75,
  DETAIL: 'high',
};

// Cache des paramètres Settings (refresh toutes les 5 min)
let cachedPdfConfig = null;
let pdfConfigCacheTime = 0;
const PDF_CONFIG_CACHE_TTL = 5 * 60 * 1000;

/**
 * Récupère les paramètres PDF depuis la table Settings (avec cache)
 * @returns {Promise<Object>} - Configuration PDF
 */
export async function getPdfImageConfig() {
  // Utiliser le cache si valide
  if (cachedPdfConfig && Date.now() - pdfConfigCacheTime < PDF_CONFIG_CACHE_TTL) {
    return cachedPdfConfig;
  }

  try {
    const settings = await prisma.setting.findMany({
      where: { category: 'pdf_import' }
    });

    const getSettingValue = (name, defaultValue) => {
      const setting = settings.find(s => s.settingName === name);
      return setting?.value ?? defaultValue;
    };

    cachedPdfConfig = {
      maxPages: PDF_CONVERSION_CONFIG.MAX_PAGES, // Non configurable pour l'instant
      maxWidth: parseInt(getSettingValue('pdf_image_max_width', String(PDF_CONVERSION_CONFIG.MAX_WIDTH))),
      density: parseInt(getSettingValue('pdf_image_density', String(PDF_CONVERSION_CONFIG.DENSITY))),
      quality: parseInt(getSettingValue('pdf_image_quality', String(PDF_CONVERSION_CONFIG.QUALITY))),
      detail: getSettingValue('pdf_vision_detail', PDF_CONVERSION_CONFIG.DETAIL),
    };
  } catch (error) {
    console.error('[pdfToImages] Erreur lecture Settings, utilisation des valeurs par défaut:', error.message);
    cachedPdfConfig = {
      maxPages: PDF_CONVERSION_CONFIG.MAX_PAGES,
      maxWidth: PDF_CONVERSION_CONFIG.MAX_WIDTH,
      density: PDF_CONVERSION_CONFIG.DENSITY,
      quality: PDF_CONVERSION_CONFIG.QUALITY,
      detail: PDF_CONVERSION_CONFIG.DETAIL,
    };
  }

  pdfConfigCacheTime = Date.now();
  return cachedPdfConfig;
}

/**
 * Invalide le cache de la configuration PDF
 * Appeler après modification dans l'admin
 */
export function invalidatePdfConfigCache() {
  cachedPdfConfig = null;
  pdfConfigCacheTime = 0;
}

/**
 * Obtient le nombre de pages d'un PDF
 * @param {string} pdfPath - Chemin absolu vers le fichier PDF
 * @returns {Promise<number>} - Nombre de pages
 */
export async function getPdfPageCount(pdfPath) {
  const options = {
    density: 72,
    saveFilename: 'page-count-check',
    savePath: os.tmpdir(),
    format: 'png',
    width: 100,
    height: 100,
    graphicsMagick: false, // Utiliser ImageMagick au lieu de GraphicsMagick
  };

  const converter = fromPath(pdfPath, options);

  try {
    const result = await converter.bulk(-1, { responseType: 'buffer' });
    return result.length;
  } catch (error) {
    console.error('[pdfToImages] Erreur lors du comptage des pages:', error.message);
    throw new Error(JSON.stringify({
      translationKey: 'errors.api.openai.pdfConversionFailed',
    }));
  }
}

/**
 * Convertit un PDF en tableau d'images JPEG encodées en base64
 * @param {string} pdfPath - Chemin absolu vers le fichier PDF
 * @param {Object} options - Options de conversion
 * @param {number} options.maxWidth - Largeur maximale en pixels (défaut: 1000)
 * @param {number} options.density - DPI pour la conversion (défaut: 100)
 * @returns {Promise<string[]>} - Tableau de chaînes base64 JPEG
 */
export async function convertPdfToImages(pdfPath, options = {}) {
  const maxWidth = options.maxWidth || PDF_CONVERSION_CONFIG.MAX_WIDTH;
  const density = options.density || PDF_CONVERSION_CONFIG.DENSITY;
  const quality = options.quality || PDF_CONVERSION_CONFIG.QUALITY;

  const converterOptions = {
    density: density,
    saveFilename: `pdf-import-${Date.now()}`,
    savePath: os.tmpdir(),
    format: PDF_CONVERSION_CONFIG.FORMAT,
    width: maxWidth * 2,
    preserveAspectRatio: true,
    graphicsMagick: false, // Utiliser ImageMagick au lieu de GraphicsMagick
  };

  const converter = fromPath(pdfPath, converterOptions);

  try {
    const results = await converter.bulk(-1, { responseType: 'buffer' });

    if (!results || results.length === 0) {
      throw new Error(JSON.stringify({
        translationKey: 'errors.api.openai.pdfNoPages',
      }));
    }

    console.log(`[pdfToImages] ${results.length} page(s) extraite(s) du PDF`);

    const base64Images = await Promise.all(
      results.map(async (result, index) => {
        if (!result.buffer) {
          console.warn(`[pdfToImages] Page ${index + 1}: pas de buffer disponible`);
          return null;
        }

        try {
          const resizedBuffer = await sharp(result.buffer)
            .resize({
              width: maxWidth,
              withoutEnlargement: true,
              fit: 'inside',
            })
            .jpeg({
              quality: quality,
            })
            .toBuffer();

          const base64 = resizedBuffer.toString('base64');
          console.log(`[pdfToImages] Page ${index + 1}: ${Math.round(resizedBuffer.length / 1024)}KB`);

          return base64;
        } catch (sharpError) {
          console.error(`[pdfToImages] Erreur sharp page ${index + 1}:`, sharpError.message);
          return result.buffer.toString('base64');
        }
      })
    );

    const validImages = base64Images.filter((img) => img !== null);

    if (validImages.length === 0) {
      throw new Error(JSON.stringify({
        translationKey: 'errors.api.openai.pdfConversionFailed',
      }));
    }

    const totalSize = validImages.reduce((acc, img) => acc + img.length, 0);
    console.log(`[pdfToImages] Total: ${validImages.length} images, ~${Math.round(totalSize / 1024)}KB base64`);

    return validImages;
  } catch (error) {
    if (error.message.includes('translationKey')) {
      throw error;
    }

    console.error('[pdfToImages] Erreur lors de la conversion:', error.message);
    throw new Error(JSON.stringify({
      translationKey: 'errors.api.openai.pdfConversionFailed',
    }));
  }
}

/**
 * Constantes exportées pour utilisation externe
 */
export const PDF_CONFIG = PDF_CONVERSION_CONFIG;
