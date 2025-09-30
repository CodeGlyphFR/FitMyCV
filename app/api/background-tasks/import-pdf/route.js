import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { scheduleImportPdfJob } from "@/lib/backgroundTasks/importPdfJob";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const ANALYSIS_MODEL_MAP = Object.freeze({
  rapid: "gpt-5-nano-2025-08-07",
  medium: "gpt-5-mini-2025-08-07",
  deep: "gpt-5-2025-08-07",
});

const DEFAULT_ANALYSIS_LEVEL = "medium";

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

async function savePdfUpload(file) {
  if (!file) return { directory: null, saved: null };

  const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "cv-pdf-import-bg-"));
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const originalName = file.name || "cv-import.pdf";
  const safeName = originalName.replace(/[^a-z0-9_.-]/gi, "_");
  const targetPath = path.join(uploadDir, safeName);

  await fs.writeFile(targetPath, buffer);

  return {
    directory: uploadDir,
    saved: {
      path: targetPath,
      name: originalName,
      size: buffer.length,
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
    const rawAnalysisLevel = formData.get("analysisLevel");
    const rawModel = formData.get("model");
    const taskId = formData.get("taskId");
    const deviceId = formData.get("deviceId") || "unknown-device";

    if (!pdfFile) {
      return NextResponse.json({ error: "Aucun fichier PDF fourni." }, { status: 400 });
    }

    if (pdfFile.type && !pdfFile.type.includes("pdf")) {
      return NextResponse.json({ error: "Le fichier doit être au format PDF." }, { status: 400 });
    }

    const requestedAnalysisLevel = typeof rawAnalysisLevel === "string" ? rawAnalysisLevel.trim().toLowerCase() : "";
    const requestedModel = typeof rawModel === "string" ? rawModel.trim() : "";

    const levelKey = ANALYSIS_MODEL_MAP[requestedAnalysisLevel]
      ? requestedAnalysisLevel
      : (Object.entries(ANALYSIS_MODEL_MAP).find(([, value]) => value === requestedModel)?.[0]
        || DEFAULT_ANALYSIS_LEVEL);

    const { directory, saved } = await savePdfUpload(pdfFile);
    if (!saved) {
      return NextResponse.json({ error: "Impossible d'enregistrer le fichier PDF." }, { status: 500 });
    }

    tempDirectory = directory;

    const userId = session.user.id;
    const taskIdentifier = typeof taskId === "string" && taskId.trim() ? taskId.trim() : `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const existingTask = await prisma.backgroundTask.findUnique({ where: { id: taskIdentifier } });
    const payload = {
      analysisLevel: levelKey,
      model: requestedModel,
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
      analysisLevel: levelKey,
      requestedModel,
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
