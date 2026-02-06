import { NextResponse } from "next/server";
import { Packer } from "docx";
import { auth } from "@/lib/auth/session";
import { readUserCvFileWithMeta } from "@/lib/cv-core/storage";
import { trackCvExport } from "@/lib/telemetry/server";
import { incrementFeatureCounter } from "@/lib/subscription/featureUsage";
import { refundCredit } from "@/lib/subscription/credits";
import { CommonErrors, CvErrors } from "@/lib/api/apiErrors";
import { generateWordDocument } from "./documentBuilder";

/**
 * Sanitize filename for HTTP Content-Disposition header
 */
function sanitizeFilenameForHeader(filename) {
  const asciiSafe = filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_');

  const encoded = encodeURIComponent(filename).replace(/'/g, '%27');

  return { asciiSafe, encoded };
}

export async function POST(request) {
  console.log('[Word Export] Request received');
  const startTime = Date.now();

  let creditTransactionId = null;
  let creditUsed = false;
  let userId = null;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }
    userId = session.user.id;

    const requestData = await request.json();
    let filename = requestData.filename;
    const language = requestData.language || 'fr';
    const selections = requestData.selections || null;
    const sectionsOrder = requestData.sectionsOrder || ['summary', 'skills', 'experience', 'education', 'languages', 'projects', 'extras'];
    const customFilename = requestData.customFilename || null;

    if (typeof filename === 'object' && filename !== null) {
      filename = filename.file || filename.name || filename.filename || String(filename);
    }

    filename = String(filename || '');

    if (!filename || filename === 'undefined') {
      return CvErrors.missingFilename();
    }

    const usageResult = await incrementFeatureCounter(session.user.id, 'export_cv', {});
    if (!usageResult.success) {
      return NextResponse.json({
        error: usageResult.error,
        actionRequired: usageResult.actionRequired,
        redirectUrl: usageResult.redirectUrl
      }, { status: 403 });
    }
    creditTransactionId = usageResult.transactionId;
    creditUsed = usageResult.usedCredit;

    let cvData;
    let cvLanguage;
    try {
      const cvResult = await readUserCvFileWithMeta(session.user.id, filename);
      cvData = cvResult.content;
      cvLanguage = cvResult.language || language || cvData?.language || 'fr';
      console.log('[Word Export] CV loaded successfully for user:', session.user.id);
    } catch (error) {
      console.error('[Word Export] Error loading CV:', error);
      if (creditUsed && creditTransactionId) {
        try {
          await refundCredit(session.user.id, creditTransactionId, 'CV introuvable lors de l\'export');
        } catch (refundError) {
          console.error('[Word Export] Erreur lors du remboursement:', refundError);
        }
      }
      return CvErrors.notFound();
    }

    // Générer le document Word
    console.log('[Word Export] Generating DOCX...');
    const doc = generateWordDocument(cvData, cvLanguage, selections, sectionsOrder);
    const docxBuffer = await Packer.toBuffer(doc);
    console.log('[Word Export] DOCX generated, buffer size:', docxBuffer.length);

    // Tracking
    const duration = Date.now() - startTime;
    try {
      await trackCvExport({
        userId: session.user.id,
        deviceId: null,
        language,
        duration,
        status: 'success',
        format: 'word'
      });
    } catch (trackError) {
      console.error('[Word Export] Erreur tracking télémétrie:', trackError);
    }

    const wordFilename = customFilename || filename.replace('.json', '');
    const { asciiSafe, encoded } = sanitizeFilenameForHeader(wordFilename);

    return new NextResponse(docxBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${asciiSafe}.docx"; filename*=UTF-8''${encoded}.docx`
      }
    });

  } catch (error) {
    console.error("Erreur lors de la génération Word:", error);
    console.error("Stack trace:", error.stack);

    if (creditUsed && creditTransactionId && userId) {
      try {
        await refundCredit(userId, creditTransactionId, `Échec export Word: ${error.message}`);
      } catch (refundError) {
        console.error('[Word Export] Erreur lors du remboursement:', refundError);
      }
    }

    const duration = Date.now() - startTime;
    try {
      const session = await auth();
      if (session?.user?.id) {
        await trackCvExport({
          userId: session.user.id,
          deviceId: null,
          language: 'fr',
          duration,
          status: 'error',
          error: error.message,
          format: 'word'
        });
      }
    } catch (trackError) {
      console.error('[Word Export] Erreur tracking télémétrie:', trackError);
    }

    return NextResponse.json(
      { error: "Erreur lors de la génération du fichier Word" },
      { status: 500 }
    );
  }
}
