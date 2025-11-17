import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { scheduleImportPdfJob } from "@/lib/backgroundTasks/importPdfJob";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { validateUploadedFile, sanitizeFilename } from "@/lib/security/fileValidation";
import { incrementFeatureCounter } from "@/lib/subscription/featureUsage";
import { verifyRecaptcha } from "@/lib/recaptcha/verifyRecaptcha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function updateBackgroundTask(taskId, userId, data) {
  if (!taskId) return;
  try {
    await prisma.backgroundTask.updateMany({
      where: { id: taskId, userId },
      data,
    });
  } catch (error) {
    console.warn(`Impossible de mettre à jour la tâche ${taskId}`, error);
  }
}

async function savePdfUpload(file, validatedBuffer) {
  if (!file) return { directory: null, saved: null };

  const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "cv-pdf-import-bg-"));
  const originalName = file.name || "cv-import.pdf";
  const safeName = sanitizeFilename(originalName);
  const targetPath = path.join(uploadDir, safeName);

  // Utiliser le buffer déjà validé pour éviter une double lecture
  await fs.writeFile(targetPath, validatedBuffer);

  return {
    directory: uploadDir,
    saved: {
      path: targetPath,
      name: originalName,
      size: validatedBuffer.length,
      type: file.type || "application/pdf",
    }
  };
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let tempDirectory = null;

  try {
    const formData = await request.formData();
    const pdfFile = formData.get("pdfFile");
    const taskId = formData.get("taskId");
    const deviceId = formData.get("deviceId") || "unknown-device";
    const recaptchaToken = formData.get("recaptchaToken");

    // Vérification reCAPTCHA (optionnelle pour compatibilité, mais recommandée)
    if (recaptchaToken) {
      const recaptchaResult = await verifyRecaptcha(recaptchaToken, {
        callerName: 'import-pdf',
        scoreThreshold: 0.5,
      });

      if (!recaptchaResult.success) {
        return NextResponse.json(
          { error: recaptchaResult.error || "Échec de la vérification anti-spam. Veuillez réessayer." },
          { status: recaptchaResult.statusCode || 403 }
        );
      }
    }

    if (!pdfFile) {
      return NextResponse.json({ error: "Aucun fichier PDF fourni." }, { status: 400 });
    }

    // Validation sécurisée du fichier PDF
    const validation = await validateUploadedFile(pdfFile, {
      allowedTypes: ['application/pdf'],
      maxSize: 10 * 1024 * 1024, // 10 MB
    });

    if (!validation.valid) {
      console.warn(`[import-pdf] Validation échouée pour ${pdfFile.name}: ${validation.error}`);
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { directory, saved } = await savePdfUpload(pdfFile, validation.buffer);
    if (!saved) {
      return NextResponse.json({ error: "Impossible d'enregistrer le fichier PDF." }, { status: 500 });
    }

    tempDirectory = directory;

    const userId = session.user.id;

    // Vérifier les limites ET incrémenter le compteur/débiter le crédit
    const usageResult = await incrementFeatureCounter(userId, 'import_pdf', {});

    if (!usageResult.success) {
      // Nettoyer le fichier temporaire
      if (tempDirectory) {
        try {
          await fs.rm(tempDirectory, { recursive: true, force: true });
        } catch (_err) {}
      }
      return NextResponse.json({
        error: usageResult.error,
        actionRequired: usageResult.actionRequired,
        redirectUrl: usageResult.redirectUrl
      }, { status: 403 });
    }

    const taskIdentifier = typeof taskId === "string" && taskId.trim() ? taskId.trim() : `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const existingTask = await prisma.backgroundTask.findUnique({ where: { id: taskIdentifier } });
    const payload = {
      savedName: saved.name,
    };

    const taskData = {
      title: `Import en cours ...`,
      successMessage: `'${saved.name}' importé avec succès`,
      type: 'import',
      status: 'queued',
      shouldUpdateCvList: true,
      error: null,
      result: null,
      deviceId,
      payload: JSON.stringify(payload),
      creditUsed: usageResult.usedCredit,
      creditTransactionId: usageResult.transactionId || null,
      featureName: usageResult.featureName || null,
      featureCounterPeriodStart: usageResult.periodStart || null,
    };

    if (!existingTask) {
      await prisma.backgroundTask.create({
        data: {
          id: taskIdentifier,
          userId,
          createdAt: BigInt(Date.now()),
          ...taskData,
        },
      });
    } else {
      await updateBackgroundTask(taskIdentifier, userId, taskData);
    }

    scheduleImportPdfJob({
      taskId: taskIdentifier,
      user: { id: userId, name: session.user?.name || "" },
      upload: { directory, saved },
      deviceId,
    });

    return NextResponse.json({
      success: true,
      queued: true,
      taskId: taskIdentifier,
    }, { status: 202 });
  } catch (error) {
    console.error('Erreur lors de la mise en file de l\'import PDF:', error);
    if (tempDirectory) {
      try {
        await fs.rm(tempDirectory, { recursive: true, force: true });
      } catch (_err) {}
    }
    return NextResponse.json({ error: "Erreur lors de la mise en file de l'import." }, { status: 500 });
  }
}
