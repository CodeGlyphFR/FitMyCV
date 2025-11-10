import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { ensureUserCvDir } from "@/lib/cv/storage";
import { scheduleCreateTemplateCvJob } from "@/lib/backgroundTasks/createTemplateCvJob";
import { incrementFeatureCounter } from "@/lib/subscription/featureUsage";

function sanitizeLinks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(link => (typeof link === "string" ? link : String(link || "")))
    .map(link => link.trim())
    .filter(link => !!link);
}

async function saveUploads(files) {
  if (!files.length) {
    return { directory: null, saved: [] };
  }

  const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "cv-template-uploads-"));
  const saved = [];

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const originalName = file.name || `offre-${saved.length + 1}`;
    const safeName = originalName.replace(/[^a-z0-9_.-]/gi, "_");
    const targetPath = path.join(uploadDir, safeName || `offre-${saved.length + 1}`);
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

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const rawLinks = formData.get("links");
    const rawAnalysisLevel = formData.get("analysisLevel");
    const rawModel = formData.get("model");
    const deviceId = formData.get("deviceId") || "unknown-device";
    const recaptchaToken = formData.get("recaptchaToken");

    // Vérification reCAPTCHA (optionnelle pour compatibilité, mais recommandée)
    if (recaptchaToken) {
      try {
        const secretKey = process.env.RECAPTCHA_SECRET_KEY;
        if (!secretKey) {
          console.error('[create-template-cv] RECAPTCHA_SECRET_KEY not configured');
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
          console.warn('[create-template-cv] reCAPTCHA verification failed', {
            success: verificationResult.success,
            score: verificationResult.score,
          });
          return NextResponse.json(
            { error: "Échec de la vérification anti-spam. Veuillez réessayer." },
            { status: 403 }
          );
        }
      } catch (error) {
        console.error('[create-template-cv] Error verifying reCAPTCHA:', error);
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
      return NextResponse.json({ error: "Ajoutez au moins un lien ou un fichier (offre d'emploi)." }, { status: 400 });
    }

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

      // Vérifier les limites ET incrémenter le compteur/débiter le crédit
      const usageResult = await incrementFeatureCounter(userId, 'gpt_cv_generation', {
        analysisLevel: requestedAnalysisLevel,
      });

      if (!usageResult.success) {
        if (i === 0 && links.length === 1 && savedUploads.length === 0) {
          return NextResponse.json({
            error: usageResult.error,
            actionRequired: usageResult.actionRequired,
            redirectUrl: usageResult.redirectUrl
          }, { status: 403 });
        }
        console.warn(`[create-template-cv] Limite atteinte pour le lien ${i}, ignoré: ${usageResult.error}`);
        continue;
      }

      const linkTaskId = `task_template_link_${now}_${i}_${Math.random().toString(36).substr(2, 9)}`;

      // Extraire un nom court du lien pour l'affichage
      let linkDisplay = link;
      try {
        const url = new URL(link);
        linkDisplay = url.hostname + (url.pathname !== '/' ? url.pathname.slice(0, 30) : '');
      } catch {
        linkDisplay = link.slice(0, 50);
      }

      const title = `Création de CV modèle depuis ${linkDisplay} ...`;
      const successMessage = "CV modèle créé avec succès (lien)";

      const taskPayload = {
        links: [link],
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
          type: 'template-creation',
          status: 'queued',
          shouldUpdateCvList: true,
          error: null,
          result: null,
          deviceId,
          payload: JSON.stringify(taskPayload),
          creditUsed: usageResult.usedCredit,
          creditTransactionId: usageResult.transactionId || null,
          featureName: usageResult.featureName || null,
          featureCounterPeriodStart: usageResult.periodStart || null,
        },
      });

      scheduleCreateTemplateCvJob({
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

      // Vérifier les limites ET incrémenter le compteur/débiter le crédit
      const usageResult = await incrementFeatureCounter(userId, 'gpt_cv_generation', {
        analysisLevel: requestedAnalysisLevel,
      });

      if (!usageResult.success) {
        if (createdTasks.length === 0 && i === 0 && savedUploads.length === 1) {
          return NextResponse.json({
            error: usageResult.error,
            actionRequired: usageResult.actionRequired,
            redirectUrl: usageResult.redirectUrl
          }, { status: 403 });
        }
        console.warn(`[create-template-cv] Limite atteinte pour le fichier ${i}, ignoré: ${usageResult.error}`);
        continue;
      }

      const attachmentTaskId = `task_template_file_${now}_${i}_${Math.random().toString(36).substr(2, 9)}`;
      const title = `Création de CV modèle depuis ${upload.name} ...`;
      const successMessage = `CV modèle créé avec succès (${upload.name})`;

      const taskPayload = {
        links: [],
        analysisLevel: requestedAnalysisLevel,
        model: requestedModel,
        uploads: [upload],
        uploadDirectory: uploadsDirectory,
      };

      await prisma.backgroundTask.create({
        data: {
          id: attachmentTaskId,
          userId,
          createdAt: BigInt(now + linkOffset + i),
          title,
          successMessage,
          type: 'template-creation',
          status: 'queued',
          shouldUpdateCvList: true,
          error: null,
          result: null,
          deviceId,
          payload: JSON.stringify(taskPayload),
          creditUsed: usageResult.usedCredit,
          creditTransactionId: usageResult.transactionId || null,
          featureName: usageResult.featureName || null,
          featureCounterPeriodStart: usageResult.periodStart || null,
        },
      });

      scheduleCreateTemplateCvJob({
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
    console.error('Erreur lors de la mise en file de la création de CV modèle:', error);
    return NextResponse.json({ error: "Erreur lors de la mise en file de la création." }, { status: 500 });
  }
}
