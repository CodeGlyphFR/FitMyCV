import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

import prisma from "@/lib/prisma";
import { ensureUserCvDir, listUserCvFiles, readUserCvFile, writeUserCvFile } from "@/lib/cv/storage";
import { registerProcess, clearRegisteredProcess } from "@/lib/backgroundTasks/processRegistry";
import { enqueueJob } from "@/lib/backgroundTasks/jobQueue";
import { setCvSource } from "@/lib/cv/source";

const ANALYSIS_MODEL_MAP = Object.freeze({
  rapid: "gpt-5-nano-2025-08-07",
  medium: "gpt-5-mini-2025-08-07",
  deep: "gpt-5-2025-08-07",
});

const DEFAULT_ANALYSIS_LEVEL = "medium";

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

async function resolvePythonInterpreter() {
  const projectRoot = process.cwd();
  const candidates = [
    path.join(projectRoot, ".venv", "bin", "python"),
    path.join(projectRoot, ".venv", "bin", "python3"),
    path.join(projectRoot, ".venv", "Scripts", "python.exe"),
    path.join(projectRoot, ".venv", "Scripts", "python"),
    "python3",
    "python",
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch (_error) {}
  }

  return "python3";
}

async function prepareWorkspace(userId) {
  const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), `cv-pdf-work-bg-${userId}-`));

  const existingFilesBefore = await listUserCvFiles(userId);
  for (const fileName of existingFilesBefore) {
    try {
      const content = await readUserCvFile(userId, fileName);
      await fs.writeFile(path.join(workspaceDir, fileName), content, "utf-8");
    } catch (error) {
      console.error(`Impossible de copier ${fileName} vers l'espace de travail`, error);
    }
  }

  return { workspaceDir, existingFilesBefore };
}

async function cleanupResources({ uploadDirectory, workspaceDir }) {
  try {
    if (uploadDirectory) {
      await fs.rm(uploadDirectory, { recursive: true, force: true });
    }
  } catch (error) {
    console.error("Impossible de nettoyer le dossier temporaire (upload)", error);
  }

  try {
    if (workspaceDir) {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error("Impossible de nettoyer le workspace", error);
  }
}

function buildPayload({ savedPdf, analysisLevel, model }) {
  return {
    created_at: new Date().toISOString(),
    pdf_file_path: savedPdf.path,
    pdf_file_name: savedPdf.name,
    pdf_file_size: savedPdf.size,
    analysis_level: analysisLevel,
    model,
  };
}

async function shouldTerminate(taskId, userId) {
  try {
    const task = await prisma.backgroundTask.findFirst({
      where: { id: taskId, userId },
      select: { status: true },
    });
    return task?.status === "cancelled";
  } catch (error) {
    console.warn('Failed to check task cancellation status:', error);
  }
  return false;
}

async function persistGeneratedFiles({ userId, generatedFiles, workspaceDir, existingFilesBefore, pdfFileName }) {
  const filesToProcess = generatedFiles.length
    ? generatedFiles
    : (await fs.readdir(workspaceDir).catch(() => [])).filter(name => name.endsWith(".json"));

  const existingSet = new Set(existingFilesBefore);
  const persistedSet = new Set(existingFilesBefore);
  const created = [];

  for (const file of filesToProcess) {
    try {
      const absolute = path.join(workspaceDir, file);
      const content = await fs.readFile(absolute, "utf-8").catch(() => null);
      if (!content) {
        continue;
      }

      if (existingSet.has(file)) {
        try {
          const original = await readUserCvFile(userId, file);
          if (typeof original === "string" && original.trim() === content.trim()) {
            continue;
          }
        } catch (_err) {}
      }

      let enriched = content;
      try {
        const parsed = JSON.parse(content);
        const isoNow = new Date().toISOString();
        const nextMeta = {
          ...(parsed.meta || {}),
          generator: "pdf-import",
          source: "pdf-import",
          updated_at: isoNow,
        };
        if (!nextMeta.created_at) nextMeta.created_at = isoNow;
        parsed.meta = nextMeta;
        enriched = JSON.stringify(parsed, null, 2);
      } catch (metaError) {
        console.error(`Impossible d'enrichir ${file} avec les métadonnées`, metaError);
      }

      let targetFile = file;
      if (persistedSet.has(targetFile)) {
        const dot = targetFile.lastIndexOf(".");
        const base = dot >= 0 ? targetFile.slice(0, dot) : targetFile;
        const ext = dot >= 0 ? targetFile.slice(dot) : "";
        let suffix = 1;
        while (persistedSet.has(targetFile)) {
          targetFile = `${base}-${suffix}${ext}`;
          suffix += 1;
        }
      }

      const absoluteTarget = await writeUserCvFile(userId, targetFile, enriched);
      console.log(`[importPdfJob] wrote file ${absoluteTarget}`);
      created.push(targetFile);
      persistedSet.add(targetFile);

      await prisma.cvFile.upsert({
        where: { userId_filename: { userId, filename: targetFile } },
        update: {},
        create: { userId, filename: targetFile },
      });

      // Enregistrer la source PDF
      if (pdfFileName) {
        try {
          await setCvSource(userId, targetFile, 'pdf', pdfFileName);
        } catch (sourceError) {
          console.error(`Impossible d'enregistrer la source pour ${targetFile}:`, sourceError);
        }
      }
    } catch (error) {
      console.error(`Impossible de persister ${file}`, error);
    }
  }

  return Array.from(new Set(created.length ? created : generatedFiles));
}

export function scheduleImportPdfJob(jobInput) {
  enqueueJob(() => runImportPdfJob(jobInput));
}

export async function runImportPdfJob({
  taskId,
  user,
  upload,
  analysisLevel,
  requestedModel,
  deviceId,
}) {
  const userId = user.id;

  console.log(`[importPdfJob] starting job ${taskId} for user ${userId} (cwd=${process.cwd()})`);

  try {
    const record = await prisma.backgroundTask.findUnique({ where: { id: taskId } });
    if (!record || record.status === 'cancelled') {
      await cleanupResources({ uploadDirectory: upload.directory, workspaceDir: null });
      return;
    }
  } catch (error) {
    console.warn(`Impossible de vérifier la tâche ${taskId} avant démarrage`, error);
  }

  await updateBackgroundTask(taskId, userId, {
    status: 'running',
    error: null,
    deviceId,
  });

  await ensureUserCvDir(userId);
  const { workspaceDir, existingFilesBefore } = await prepareWorkspace(userId);
  console.log(`[importPdfJob] workspaceDir for ${taskId}: ${workspaceDir}`);

  const payload = buildPayload({
    savedPdf: upload.saved,
    analysisLevel,
    model: requestedModel,
  });

  const interpreter = await resolvePythonInterpreter();
  const scriptPath = path.join(process.cwd(), "scripts", "import_pdf_cv.py");
  try {
    await fs.access(scriptPath);
  } catch (_error) {
    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      error: "Le script Python import_pdf_cv.py est introuvable.",
    });
    await cleanupResources({ uploadDirectory: upload.directory, workspaceDir });
    return;
  }

  const model = requestedModel
    || process.env.GPT_OPENAI_MODEL
    || process.env.OPENAI_MODEL
    || process.env.OPENAI_API_MODEL
    || ANALYSIS_MODEL_MAP[DEFAULT_ANALYSIS_LEVEL];

  const pythonProcess = spawn(interpreter, [scriptPath], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      GPT_PDF_IMPORT_PAYLOAD: JSON.stringify(payload),
      GPT_USER_ID: userId,
      GPT_USER_CV_DIR: workspaceDir,
      GPT_USER_NAME: user?.name || "",
      GPT_OPENAI_MODEL: model,
      GPT_ANALYSIS_LEVEL: analysisLevel,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  registerProcess(taskId, pythonProcess);

  let stdout = "";
  let stderr = "";
  let cancelled = false;

  pythonProcess.stdout.on("data", chunk => {
    stdout += chunk.toString();
  });

  pythonProcess.stderr.on("data", chunk => {
    stderr += chunk.toString();
  });

  const cancellationInterval = setInterval(async () => {
    if (await shouldTerminate(taskId, userId)) {
      cancelled = true;
      clearInterval(cancellationInterval);
      pythonProcess.kill('SIGTERM');
      setTimeout(() => {
        if (!pythonProcess.killed) {
          pythonProcess.kill('SIGKILL');
        }
      }, 5000);
    }
  }, 1000);

  const exitCode = await new Promise(resolve => {
    const off = () => {
      clearInterval(cancellationInterval);
      clearRegisteredProcess(taskId);
    };
    pythonProcess.on("close", (code, signal) => {
      if (!cancelled && signal && signal.toLowerCase().includes('term')) {
        cancelled = true;
      }
      off();
      resolve(cancelled ? -999 : code);
    });
    pythonProcess.on("error", error => {
      if (!cancelled) {
        cancelled = true;
      }
      off();
      stderr += `\n${error.message || error.toString()}`;
      resolve(cancelled ? -999 : -1);
    });
  });

  if (stderr.trim()) {
    console.error(`[importPdfJob] stderr for ${taskId}:`, stderr);
  }

  const cleanedStdout = stdout
    .split(/\r?\n/)
    .map(line => line.replace(/^\[INFO\].*/, '').trim())
    .filter(Boolean)
    .join('\n');

  const trimmedStdout = cleanedStdout.trim();
  const lines = trimmedStdout ? trimmedStdout.split(/\r?\n/) : [];
  const sentinelFiles = lines
    .filter(line => line.startsWith("::result::"))
    .map(line => line.replace("::result::", "").trim())
    .filter(Boolean);

  let generatedFiles = await persistGeneratedFiles({
    userId,
    generatedFiles: sentinelFiles,
    workspaceDir,
    existingFilesBefore,
    pdfFileName: upload.saved?.name || upload.name,
  });

  console.log(`[importPdfJob] persisted files for ${taskId}:`, generatedFiles);

  await cleanupResources({ uploadDirectory: upload.directory, workspaceDir });

  const isQuotaExceeded = /insufficient_quota|exceeded your current quota/i.test(stderr);

  if (exitCode === 0) {
    await updateBackgroundTask(taskId, userId, {
      status: 'completed',
      result: JSON.stringify({ files: generatedFiles }),
      error: null,
    });
    return;
  }

  if (exitCode === -999) {
    await updateBackgroundTask(taskId, userId, {
      status: 'cancelled',
      result: null,
      error: null,
    });
    return;
  }

  const isLikelyCancellation = cancelled || (stderr && /cancelled|terminated/i.test(stderr));
  await updateBackgroundTask(taskId, userId, {
    status: isLikelyCancellation ? 'cancelled' : 'failed',
    result: null,
    error: isLikelyCancellation
      ? null
      : (isQuotaExceeded
        ? "Quota OpenAI dépassé. Vérifiez votre facturation."
        : (stderr || 'Échec lors de l\'import du PDF')),
  });
}
