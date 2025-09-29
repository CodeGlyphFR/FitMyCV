import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

import prisma from "@/lib/prisma";
import { ensureUserCvDir, listUserCvFiles, readUserCvFile, writeUserCvFile } from "@/lib/cv/storage";
import { registerProcess, clearRegisteredProcess } from "@/lib/backgroundTasks/processRegistry";
import { enqueueJob } from "@/lib/backgroundTasks/jobQueue";

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

function sanitizeLabel(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.slice(0, 200);
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

async function cleanupResources({ uploadDirectory, workspaceDir, tempUploads }) {
  try {
    if (uploadDirectory) {
      await fs.rm(uploadDirectory, { recursive: true, force: true });
    }
  } catch (error) {
    console.error("Impossible de nettoyer le dossier temporaire (uploads)", error);
  }

  try {
    if (workspaceDir) {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error("Impossible de nettoyer le workspace", error);
  }

  if (tempUploads?.length) {
    for (const file of tempUploads) {
      try {
        await fs.rm(file.path, { force: true });
      } catch (error) {}
    }
  }
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

function buildPayload({ links, baseFile, baseFileLabel, analysisLevel, model, savedUploads }) {
  return {
    created_at: new Date().toISOString(),
    links,
    base_file: baseFile,
    base_file_label: baseFileLabel,
    analysis_level: analysisLevel,
    model,
    attachments: savedUploads.map(file => ({
      path: file.path,
      name: file.name,
      size: file.size,
      type: file.type,
    })),
  };
}

async function prepareWorkspace(userId, referenceFile, referenceContent) {
  const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), `cv-gen-work-bg-${userId}-`));

  if (referenceFile && referenceContent) {
    const referencePath = path.join(workspaceDir, referenceFile);
    await fs.writeFile(referencePath, referenceContent, 'utf-8');
  }

  return { workspaceDir };
}

async function persistGeneratedFiles({ userId, workspaceDir, generatedFiles }) {
  const created = [];

  for (const file of generatedFiles) {
    const absolute = path.join(workspaceDir, file);
    try {
      const content = await fs.readFile(absolute, "utf-8");

      let enriched = content;
      try {
        const parsed = JSON.parse(content);
        const isoNow = new Date().toISOString();
        const nextMeta = {
          ...(parsed.meta || {}),
          generator: "cv-adapter",
          source: "cv-adapter",
          updated_at: isoNow,
        };
        if (!nextMeta.created_at) nextMeta.created_at = isoNow;
        parsed.meta = nextMeta;
        enriched = JSON.stringify(parsed, null, 2);
      } catch (metaError) {
        console.error(`Impossible d'enrichir ${file} avec les métadonnées`, metaError);
      }

      await writeUserCvFile(userId, file, enriched);
      created.push(file);

      await prisma.cvFile.upsert({
        where: { userId_filename: { userId, filename: file } },
        update: {},
        create: { userId, filename: file },
      });
    } catch (error) {
      console.error(`Impossible de persister ${file}`, error);
    }
  }

  return created;
}

export function scheduleGenerateCvJob(jobInput) {
  enqueueJob(() => runGenerateCvJob(jobInput));
}

export async function runGenerateCvJob({
  taskId,
  user,
  payload,
  deviceId,
}) {
  const userId = user.id;

  try {
    const record = await prisma.backgroundTask.findUnique({ where: { id: taskId } });
    if (!record || record.status === 'cancelled') {
      await cleanupResources({ uploadDirectory: payload.uploadDirectory, workspaceDir: null, tempUploads: payload.uploads });
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

  const existingFilesBefore = await listUserCvFiles(userId);

  const referenceFile = (payload.baseFile || 'main.json').trim() || 'main.json';
  let referenceContent = null;
  try {
    referenceContent = await readUserCvFile(userId, referenceFile);
  } catch (error) {
    console.error(`Impossible de lire le CV de référence ${referenceFile}:`, error);
  }

  if (Array.isArray(payload.uploads) && payload.uploads.length) {
    console.log(`[generateCvJob] uploads for ${taskId}:`, payload.uploads.map(file => file?.path || 'unknown'));
  }

  if (!referenceContent) {
    await cleanupResources({ uploadDirectory: payload.uploadDirectory, workspaceDir: null, tempUploads: payload.uploads });
    await updateBackgroundTask(taskId, userId, {
      status: 'failed',
      result: null,
      error: `CV de référence '${referenceFile}' introuvable`,
    });
    return;
  }

  const { workspaceDir } = await prepareWorkspace(userId, referenceFile, referenceContent);

  const analysisLevel = payload.analysisLevel || DEFAULT_ANALYSIS_LEVEL;
  const model = payload.model
    || process.env.GPT_OPENAI_MODEL
    || process.env.OPENAI_MODEL
    || process.env.OPENAI_API_MODEL
    || ANALYSIS_MODEL_MAP[DEFAULT_ANALYSIS_LEVEL];

  const pythonProcess = spawn(await resolvePythonInterpreter(), [path.join(process.cwd(), "scripts", "generate_cv.py")], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      GPT_GENERATOR_PAYLOAD: JSON.stringify({
        links: payload.links,
        base_file: payload.baseFile,
        base_file_label: payload.baseFileLabel,
        analysis_level: analysisLevel,
        model,
        attachments: payload.uploads?.map(file => ({
          path: file.path,
          name: file.name,
          size: file.size,
          type: file.type,
        })) || [],
        user: {
          id: userId,
          name: user?.name || "",
          cv_dir: workspaceDir,
        },
      }),
      GPT_USER_ID: userId,
      GPT_USER_NAME: user?.name || "",
      GPT_USER_CV_DIR: workspaceDir,
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
    console.error(`[generateCvJob] stderr for ${taskId}:`, stderr);
  }

  const cleanedStdout = stdout
    .split(/\r?\n/)
    .map(line => line.replace(/^\[INFO\].*/, '').trim())
    .filter(Boolean)
    .join('\n');

  const trimmedStdout = cleanedStdout.trim();
  const lines = trimmedStdout ? trimmedStdout.split(/\r?\n/) : [];
  const sentinelFiles = lines
    .filter(line => line.startsWith('::result::'))
    .map(line => line.replace('::result::', '').trim())
    .filter(Boolean);

  if (exitCode === 0) {
    const generatedFiles = await persistGeneratedFiles({
      userId,
      generatedFiles: sentinelFiles,
      workspaceDir,
    });

    await cleanupResources({ uploadDirectory: payload.uploadDirectory, workspaceDir, tempUploads: payload.uploads });

    await updateBackgroundTask(taskId, userId, {
      status: 'completed',
      result: JSON.stringify({ files: generatedFiles }),
      error: null,
    });
    return;
  }

  await cleanupResources({ uploadDirectory: payload.uploadDirectory, workspaceDir, tempUploads: payload.uploads });

  if (exitCode === -999) {
    await updateBackgroundTask(taskId, userId, {
      status: 'cancelled',
      result: null,
      error: null,
    });
    return;
  }

  const isQuotaExceeded = /insufficient_quota|exceeded your current quota/i.test(stderr);
  await updateBackgroundTask(taskId, userId, {
    status: 'failed',
    result: null,
    error: isQuotaExceeded
      ? "Quota OpenAI dépassé. Vérifiez votre facturation."
      : (stderr || 'Échec lors de la génération du CV'),
  });
}

export function buildGenerateCvPayload({
  links,
  baseFile,
  baseFileLabel,
  analysisLevel,
  model,
  uploads,
}) {
  return {
    links,
    baseFile,
    baseFileLabel: sanitizeLabel(baseFileLabel),
    analysisLevel: analysisLevel || DEFAULT_ANALYSIS_LEVEL,
    model,
    uploads: uploads.map(file => ({
      path: file.path,
      name: file.name,
      size: file.size,
      type: file.type,
    })),
  };
}
