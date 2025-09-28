import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { ensureUserCvDir, listUserCvFiles, readUserCvFile, writeUserCvFile } from "@/lib/cv/storage";

const ANALYSIS_MODEL_MAP = Object.freeze({
  rapid: "gpt-5-nano-2025-08-07",
  medium: "gpt-5-mini-2025-08-07",
  deep: "gpt-5-2025-08-07",
});

const DEFAULT_ANALYSIS_LEVEL = "medium";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function isLikelyGptMeta(meta) {
  if (!meta || typeof meta !== "object") return false;
  const extract = (field) => {
    const raw = meta[field];
    return typeof raw === "string" ? raw.toLowerCase().trim() : "";
  };
  const generator = extract("generator");
  const source = extract("source");
  return generator === "chatgpt" || generator === "openai" || source === "chatgpt" || source === "openai";
}

async function saveUploads(files) {
  if (!files.length) return { directory: null, saved: [] };
  const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "cv-gpt-bg-"));
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

async function cleanupUploads(directory) {
  if (!directory) return;
  try {
    await fs.rm(directory, { recursive: true, force: true });
  } catch (error) {
    console.error("Impossible de nettoyer le dossier temporaire", error);
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
    } catch (_error) {
      // continue to next candidate
    }
  }

  return "python3";
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
      return NextResponse.json({ error: "Ajoutez au moins un lien ou un fichier pour lancer l'assistant." }, { status: 400 });
    }

    const requestedBaseFile = sanitizeFilename(rawBaseFile);
    const requestedBaseFileLabel = sanitizeLabel(rawBaseFileLabel);
    const requestedAnalysisLevel = typeof rawAnalysisLevel === "string" ? rawAnalysisLevel.trim().toLowerCase() : "";
    const requestedModel = typeof rawModel === "string" ? rawModel.trim() : "";

    const { directory, saved } = await saveUploads(files);

    const userId = session.user.id;
    const userCvDir = await ensureUserCvDir(userId);
    const existingFilesBefore = await listUserCvFiles(userId);
    const candidateFiles = existingFilesBefore.filter((name) => name.endsWith(".json"));
    let baseFile = candidateFiles.includes(requestedBaseFile) ? requestedBaseFile : "";
    const manualFiles = [];
    const manualTitles = new Map();

    for (const fileName of candidateFiles) {
      let isGpt = false;
      let parsed;
      let title = "";
      try {
        const raw = await readUserCvFile(userId, fileName);
        parsed = JSON.parse(raw);
        if (isLikelyGptMeta(parsed?.meta)) {
          isGpt = true;
        }
        if (parsed && parsed.header && typeof parsed.header.current_title === "string") {
          title = parsed.header.current_title.trim();
        }
      } catch (_error) {
        // ignore JSON errors; treat as manuel
      }
      if (isGpt) {
        if (fileName === baseFile) baseFile = "";
      } else {
        manualFiles.push(fileName);
        if (title) manualTitles.set(fileName, title);
      }
    }

    if (!baseFile) {
      if (manualFiles.includes("main.json")) baseFile = "main.json";
      else if (manualFiles.length) baseFile = manualFiles[0];
      else if (candidateFiles.includes("main.json")) baseFile = "main.json";
      else baseFile = requestedBaseFile || "main.json";
    }

    const levelKey = ANALYSIS_MODEL_MAP[requestedAnalysisLevel]
      ? requestedAnalysisLevel
      : (Object.entries(ANALYSIS_MODEL_MAP).find(([, value]) => value === requestedModel)?.[0]
        || DEFAULT_ANALYSIS_LEVEL);
    const model = ANALYSIS_MODEL_MAP[levelKey] || ANALYSIS_MODEL_MAP[DEFAULT_ANALYSIS_LEVEL];
    const baseFileLabel = requestedBaseFileLabel || manualTitles.get(baseFile) || "";
    const displayBaseLabel = baseFileLabel || baseFile;

    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), `cv-work-bg-${userId}-`));
    for (const fileName of existingFilesBefore) {
      try {
        const content = await readUserCvFile(userId, fileName);
        await fs.writeFile(path.join(workspaceDir, fileName), content, "utf-8");
      } catch (error) {
        console.error(`Impossible de copier ${fileName} vers l'espace de travail`, error);
      }
    }

    const payload = {
      created_at: new Date().toISOString(),
      links,
      files: saved,
      base_file: baseFile,
      base_file_label: displayBaseLabel,
      analysis_level: levelKey,
      model,
      user: {
        id: userId,
        cv_dir: workspaceDir,
      },
    };

    const scriptPath = path.join(process.cwd(), "scripts", "generate_cv.py");
    try {
      await fs.access(scriptPath);
    } catch (_error) {
      await cleanupUploads(directory);
      return NextResponse.json({ error: "Le script Python generate_cv.py est introuvable." }, { status: 500 });
    }

    const interpreter = await resolvePythonInterpreter();

    // Execute the background task
    try {
      const activeModel = model
        || process.env.GPT_OPENAI_MODEL
        || process.env.OPENAI_MODEL
        || process.env.OPENAI_API_MODEL
        || ANALYSIS_MODEL_MAP[DEFAULT_ANALYSIS_LEVEL];

      const pythonProcess = spawn(interpreter, [scriptPath], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          GPT_GENERATOR_PAYLOAD: JSON.stringify(payload),
          GPT_USER_ID: userId,
          GPT_USER_CV_DIR: workspaceDir,
          GPT_USER_NAME: session.user?.name || "",
          GPT_OPENAI_MODEL: activeModel,
          GPT_ANALYSIS_LEVEL: levelKey,
          GPT_BASE_FILE_LABEL: displayBaseLabel,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      pythonProcess.stdout.on("data", chunk => {
        stdout += chunk.toString();
      });

      pythonProcess.stderr.on("data", chunk => {
        stderr += chunk.toString();
      });

      const exitCode = await new Promise(resolve => {
        pythonProcess.on("close", code => resolve(code));
        pythonProcess.on("error", error => {
          stderr += `\n${error.message || error.toString()}`;
          resolve(-1);
        });
      });

      const trimmedStdout = stdout.trim();
      const lines = trimmedStdout ? trimmedStdout.split(/\r?\n/) : [];
      const sentinelFiles = lines
        .filter(line => line.startsWith("::result::"))
        .map(line => line.replace("::result::", "").trim())
        .filter(Boolean);

      let generatedFiles = [...new Set(sentinelFiles)];

      if (exitCode === 0) {
        const workspaceFiles = (await fs.readdir(workspaceDir).catch(() => []))
          .filter(name => name.endsWith(".json"));
        const existingSet = new Set(existingFilesBefore);
        const persistedSet = new Set(existingFilesBefore);

        for (const file of workspaceFiles) {
          try {
            const absolute = path.join(workspaceDir, file);
            const content = await fs.readFile(absolute, "utf-8");
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
                generator: "chatgpt",
                source: "chatgpt",
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
            await writeUserCvFile(userId, targetFile, enriched);
            generatedFiles.push(targetFile);
            persistedSet.add(targetFile);
            await prisma.cvFile.upsert({
              where: { userId_filename: { userId, filename: targetFile } },
              update: {},
              create: { userId, filename: targetFile },
            });
          } catch (error) {
            console.error(`Impossible de persister ${file}`, error);
          }
        }

        generatedFiles = Array.from(new Set(generatedFiles));
      }

      // Cleanup
      try {
        await cleanupUploads(directory);
        await fs.rm(workspaceDir, { recursive: true, force: true });
      } catch (_err) {}

      if (exitCode !== 0) {
        const message = (stderr.trim() || "Le script Python a échoué.");
        throw new Error(message);
      }

      return NextResponse.json({
        success: true,
        files: generatedFiles,
        file: generatedFiles.length ? generatedFiles[generatedFiles.length - 1] : null,
      });

    } catch (error) {
      // Cleanup on error
      try {
        await cleanupUploads(directory);
        await fs.rm(workspaceDir, { recursive: true, force: true });
      } catch (_err) {}

      throw error;
    }

  } catch (error) {
    console.error("Erreur lors de la génération CV en arrière-plan", error);
    return NextResponse.json({
      error: error.message || "Erreur interne lors de la génération du CV."
    }, { status: 500 });
  }
}