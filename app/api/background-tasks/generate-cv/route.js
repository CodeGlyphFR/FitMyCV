import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { ensureUserCvDir } from "@/lib/cv/storage";
import { scheduleGenerateCvJob } from "@/lib/backgroundTasks/generateCvJob";
import { validateUploadedFile, sanitizeFilename } from "@/lib/security/fileValidation";

function sanitizeLinks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(link => (typeof link === "string" ? link : String(link || "")))
    .map(link => link.trim())
    .filter(link => !!link);
}

// Fonction simplifiée (la vraie sanitization est dans lib/security/fileValidation)
function sanitizeFilenameLocal(value) {
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
    return { directory: null, saved: [], errors: [] };
  }

  const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "cv-gen-uploads-"));
  const saved = [];
  const errors = [];

  for (const file of files) {
    // Validation sécurisée du fichier
    const validation = await validateUploadedFile(file, {
      allowedTypes: ['application/pdf'],
      maxSize: 10 * 1024 * 1024, // 10 MB
    });

    if (!validation.valid) {
      console.warn(`[generate-cv] Validation échouée pour ${file.name}: ${validation.error}`);
      errors.push({ file: file.name, error: validation.error });
      continue;
    }

    const originalName = file.name || `piece-jointe-${saved.length + 1}`;
    const safeName = sanitizeFilename(originalName);
    const targetPath = path.join(uploadDir, safeName || `piece-jointe-${saved.length + 1}`);
    await fs.writeFile(targetPath, validation.buffer);
    saved.push({
      path: targetPath,
      name: originalName,
      size: validation.buffer.length,
      type: file.type || "application/pdf",
    });
  }

  return { directory: uploadDir, saved, errors };
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
    const recaptchaToken = formData.get("recaptchaToken");

    // Vérification reCAPTCHA (optionnelle pour compatibilité, mais recommandée)
    if (recaptchaToken) {
      try {
        const secretKey = process.env.RECAPTCHA_SECRET_KEY;
        if (!secretKey) {
          console.error('[generate-cv] RECAPTCHA_SECRET_KEY not configured');
          return NextResponse.json({ error: "Configuration serveur manquante" }, { status: 500 });
        }

        const verificationUrl = 'https://www.google.com/recaptcha/api/siteverify';
        const verificationData = new URLSearchParams({
          secret: secretKey,
          response: recaptchaToken,
        });

        const verificationResponse = await fetch(verificationUrl, {
          method: 'POST',
          body: verificationData,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        const verificationResult = await verificationResponse.json();

        if (!verificationResult.success || (verificationResult.score && verificationResult.score < 0.5)) {
          console.warn('[generate-cv] reCAPTCHA verification failed', {
            success: verificationResult.success,
            score: verificationResult.score,
          });
          return NextResponse.json(
            { error: "Échec de la vérification anti-spam. Veuillez réessayer." },
            { status: 403 }
          );
        }
      } catch (error) {
        console.error('[generate-cv] Error verifying reCAPTCHA:', error);
        return NextResponse.json(
          { error: "Erreur lors de la vérification anti-spam" },
          { status: 500 }
        );
      }
    }

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

    const requestedBaseFile = rawBaseFile ? sanitizeFilenameLocal(rawBaseFile) : "";
    const requestedBaseFileLabel = sanitizeLabel(rawBaseFileLabel);
    const requestedAnalysisLevel = typeof rawAnalysisLevel === "string" ? rawAnalysisLevel.trim().toLowerCase() : "medium";
    const requestedModel = typeof rawModel === "string" ? rawModel.trim() : "";

    const { directory: uploadsDirectory, saved: savedUploads, errors: uploadErrors } = await saveUploads(files);

    // Si tous les fichiers ont échoué, retourner une erreur
    if (files.length > 0 && savedUploads.length === 0) {
      return NextResponse.json({
        error: "Tous les fichiers ont échoué la validation.",
        details: uploadErrors
      }, { status: 400 });
    }

    // Si certains fichiers ont échoué, logger mais continuer
    if (uploadErrors.length > 0) {
      console.warn(`[generate-cv] ${uploadErrors.length} fichier(s) rejeté(s):`, uploadErrors);
    }

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
