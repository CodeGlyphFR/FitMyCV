import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { ensureUserCvDir } from "@/lib/cv/storage";
import { scheduleGenerateCvJob } from "@/lib/backgroundTasks/generateCvJob";

function sanitizeLinks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(link => (typeof link === "string" ? link : String(link || "")))
    .map(link => link.trim())
    .filter(link => !!link);
}

function sanitizeFilename(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/[\\/]/.test(trimmed)) return "";
  if (trimmed.includes("..")) return "";
  return trimmed;
}

function sanitizeLabel(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.slice(0, 200);
}

async function saveUploads(files) {
  if (!files.length) {
    return { directory: null, saved: [] };
  }

  const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "cv-gen-uploads-"));
  const saved = [];

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const originalName = file.name || `piece-jointe-${saved.length + 1}`;
    const safeName = originalName.replace(/[^a-z0-9_.-]/gi, "_");
    const targetPath = path.join(uploadDir, safeName || `piece-jointe-${saved.length + 1}`);
    await fs.writeFile(targetPath, buffer);
    saved.push({
      path: targetPath,
      name: originalName,
      size: buffer.length,
      type: file.type || "application/octet-stream",
    });
  }

  return { directory: uploadDir, saved };
}

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

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const rawLinks = formData.get("links");
    const rawBaseFile = formData.get("baseFile");
    const rawBaseFileLabel = formData.get("baseFileLabel");
    const rawAnalysisLevel = formData.get("analysisLevel");
    const rawModel = formData.get("model");
    const taskId = formData.get("taskId");
    const deviceId = formData.get("deviceId") || "unknown-device";

    let parsedLinks = [];
    if (rawLinks) {
      try {
        parsedLinks = JSON.parse(rawLinks);
      } catch (_error) {
        return NextResponse.json({ error: "Format des liens invalide." }, { status: 400 });
      }
    }

    const links = sanitizeLinks(parsedLinks);
    const files = formData.getAll("files").filter(Boolean);

    if (!links.length && !files.length) {
      return NextResponse.json({ error: "Ajoutez au moins un lien ou un fichier." }, { status: 400 });
    }

    const requestedBaseFile = sanitizeFilename(rawBaseFile);
    const requestedBaseFileLabel = sanitizeLabel(rawBaseFileLabel);
    const requestedAnalysisLevel = typeof rawAnalysisLevel === "string" ? rawAnalysisLevel.trim().toLowerCase() : "medium";
    const requestedModel = typeof rawModel === "string" ? rawModel.trim() : "";

    const { directory: uploadsDirectory, saved: savedUploads } = await saveUploads(files);

    const userId = session.user.id;
    await ensureUserCvDir(userId);

    const createdTasks = [];
    const now = Date.now();

    // Créer une tâche par lien
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const linkTaskId = `task_link_${now}_${i}_${Math.random().toString(36).substr(2, 9)}`;

      // Extraire un nom court du lien pour l'affichage
      let linkDisplay = link;
      try {
        const url = new URL(link);
        linkDisplay = url.hostname + (url.pathname !== '/' ? url.pathname.slice(0, 30) : '');
      } catch {
        linkDisplay = link.slice(0, 50);
      }

      const title = requestedBaseFileLabel
        ? `Adaptation de '${requestedBaseFileLabel}' ...`
        : `Adaptation du CV avec ${linkDisplay} ...`;

      const successMessage = requestedBaseFileLabel
        ? `CV '${requestedBaseFileLabel}' adapté avec succès`
        : "CV adapté avec succès (lien)";

      const taskPayload = {
        links: [link],
        baseFile: requestedBaseFile,
        baseFileLabel: requestedBaseFileLabel,
        analysisLevel: requestedAnalysisLevel,
        model: requestedModel,
        uploads: [],
        uploadDirectory: null,
      };

      await prisma.backgroundTask.create({
        data: {
          id: linkTaskId,
          userId,
          createdAt: BigInt(now + i),
          title,
          successMessage,
          type: 'generation',
          status: 'queued',
          shouldUpdateCvList: true,
          error: null,
          result: null,
          deviceId,
          payload: JSON.stringify(taskPayload),
        },
      });

      scheduleGenerateCvJob({
        taskId: linkTaskId,
        user: { id: userId, name: session.user?.name || "" },
        payload: taskPayload,
        deviceId,
      });

      createdTasks.push(linkTaskId);
    }

    // Créer une tâche par pièce jointe
    const linkOffset = links.length;
    for (let i = 0; i < savedUploads.length; i++) {
      const upload = savedUploads[i];
      const attachmentTaskId = `task_file_${now}_${i}_${Math.random().toString(36).substr(2, 9)}`;
      const title = requestedBaseFileLabel
        ? `Adaptation de '${requestedBaseFileLabel}' ...`
        : `Adaptation du CV avec ${upload.name} ...`;

      const successMessage = requestedBaseFileLabel
        ? `CV '${requestedBaseFileLabel}' adapté avec succès`
        : `CV adapté avec succès (${upload.name})`;

      const taskPayload = {
        links: [],
        baseFile: requestedBaseFile,
        baseFileLabel: requestedBaseFileLabel,
        analysisLevel: requestedAnalysisLevel,
        model: requestedModel,
        uploads: [upload],
        uploadDirectory: uploadsDirectory,
      };

      await prisma.backgroundTask.create({
        data: {
          id: attachmentTaskId,
          userId,
          createdAt: BigInt(now + linkOffset + i), // Décalage pour l'ordre après les liens
          title,
          successMessage,
          type: 'generation',
          status: 'queued',
          shouldUpdateCvList: true,
          error: null,
          result: null,
          deviceId,
          payload: JSON.stringify(taskPayload),
        },
      });

      scheduleGenerateCvJob({
        taskId: attachmentTaskId,
        user: { id: userId, name: session.user?.name || "" },
        payload: taskPayload,
        deviceId,
      });

      createdTasks.push(attachmentTaskId);
    }

    return NextResponse.json({
      success: true,
      queued: true,
      taskIds: createdTasks,
      tasksCount: createdTasks.length
    }, { status: 202 });
  } catch (error) {
    console.error('Erreur lors de la mise en file de la génération de CV:', error);
    return NextResponse.json({ error: "Erreur lors de la mise en file de la génération." }, { status: 500 });
  }
}
