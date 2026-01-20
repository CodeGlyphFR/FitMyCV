import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { auth } from "@/lib/auth/session";
import { readUserCvFileWithMeta } from "@/lib/cv-core/storage";
import { trackCvExport } from "@/lib/telemetry/server";
import { incrementFeatureCounter } from "@/lib/subscription/featureUsage";
import { refundCredit } from "@/lib/subscription/credits";
import { CommonErrors, CvErrors, OtherErrors } from "@/lib/api/apiErrors";
import {
  getTranslation,
  prepareCvData,
  sanitizeFilenameForHeader,
  DEFAULT_SECTION_ORDER,
  getExportStyles,
  generateHeaderSection,
  createSectionGenerators,
  generateSectionsHtml
} from "@/lib/pdf";

export async function POST(request) {
  console.log('[PDF Export] Request received');
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
    const sectionsOrder = requestData.sectionsOrder || DEFAULT_SECTION_ORDER;
    const customFilename = requestData.customFilename || null;

    if (typeof filename === 'object' && filename !== null) {
      filename = filename.file || filename.name || filename.filename || String(filename);
    }
    filename = String(filename || '');

    if (!filename || filename === 'undefined') {
      return CvErrors.missingFilename();
    }

    // Verify limits and increment counter
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

    // Load CV data
    let cvData;
    let cvLanguage;
    try {
      const cvResult = await readUserCvFileWithMeta(session.user.id, filename);
      cvData = cvResult.content;
      cvLanguage = cvResult.language || language || cvData?.language || 'fr';
      console.log('[PDF Export] CV loaded successfully for user:', session.user.id);
    } catch (error) {
      console.error('[PDF Export] Error loading CV:', error);
      if (creditUsed && creditTransactionId) {
        try {
          await refundCredit(session.user.id, creditTransactionId, 'CV introuvable lors de l\'export');
          console.log('[PDF Export] Crédit remboursé suite à CV introuvable');
        } catch (refundError) {
          console.error('[PDF Export] Erreur lors du remboursement:', refundError);
        }
      }
      return CvErrors.notFound();
    }

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection'
      ],
      executablePath: puppeteer.executablePath(),
      timeout: 60000
    });

    const page = await browser.newPage();
    const htmlContent = generateCvHtml(cvData, cvLanguage, selections, sectionsOrder);

    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        right: '12mm',
        bottom: '15mm',
        left: '12mm'
      },
      preferCSSPageSize: true,
      displayHeaderFooter: false
    });

    await browser.close();

    // Telemetry tracking - Success
    const duration = Date.now() - startTime;
    try {
      await trackCvExport({
        userId: session.user.id,
        deviceId: null,
        language,
        duration,
        status: 'success',
      });
    } catch (trackError) {
      console.error('[PDF Export] Erreur tracking télémétrie:', trackError);
    }

    // Return PDF
    const pdfFilename = customFilename || filename.replace('.json', '');
    const { asciiSafe, encoded } = sanitizeFilenameForHeader(pdfFilename);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${asciiSafe}.pdf"; filename*=UTF-8''${encoded}.pdf`
      }
    });

  } catch (error) {
    console.error("Erreur lors de la génération PDF:", error);
    console.error("Stack trace:", error.stack);

    if (creditUsed && creditTransactionId && userId) {
      try {
        await refundCredit(userId, creditTransactionId, `Échec export PDF: ${error.message}`);
        console.log('[PDF Export] Crédit remboursé suite à erreur:', error.message);
      } catch (refundError) {
        console.error('[PDF Export] Erreur lors du remboursement:', refundError);
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
        });
      }
    } catch (trackError) {
      console.error('[PDF Export] Erreur tracking télémétrie:', trackError);
    }

    return OtherErrors.exportPdfFailed();
  }
}

function generateCvHtml(cvData, language = 'fr', selections = null, sectionsOrder = null) {
  const t = (path) => getTranslation(language, path);
  const order = sectionsOrder || DEFAULT_SECTION_ORDER;

  // Page break function - disabled, let Puppeteer handle naturally
  const shouldBreakBefore = () => false;

  // Prepare CV data
  const data = prepareCvData(cvData, selections);

  // Create section generators
  const sectionGenerators = createSectionGenerators(data, language, selections, {
    isExport: true,
    shouldBreakBefore
  });

  // Generate header
  const headerHtml = generateHeaderSection(data.header, data.contact, selections, language);

  // Generate sections
  const sectionsHtml = generateSectionsHtml(sectionGenerators, order);

  return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CV - ${data.header.full_name || t('cvSections.header')}</title>
  <style>
    ${getExportStyles()}
  </style>
</head>
<body>
  <div class="cv-container">
    ${headerHtml}
    ${sectionsHtml}
  </div>
</body>
</html>
  `;
}
