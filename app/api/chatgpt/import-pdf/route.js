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

async function savePdfUpload(file) {
  if (!file) return { directory: null, saved: null };

  const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "cv-pdf-import-"));
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

function isLikelyGptMeta(meta) {
  if (!meta || typeof meta !== "object") return false;
  const extract = (field) => {
    const raw = meta[field];
    return typeof raw === "string" ? raw.toLowerCase().trim() : "";
  };
  const generator = extract("generator");
  const source = extract("source");
  return generator === "pdf-import" || source === "pdf-import" ||
         generator === "chatgpt" || generator === "openai" ||
         source === "chatgpt" || source === "openai";
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const pdfFile = formData.get("pdfFile");
    const rawAnalysisLevel = formData.get("analysisLevel");
    const rawModel = formData.get("model");

    if (!pdfFile) {
      return NextResponse.json({ error: "Aucun fichier PDF fourni." }, { status: 400 });
    }

    // Vérifier que c'est bien un PDF
    if (pdfFile.type && !pdfFile.type.includes("pdf")) {
      return NextResponse.json({ error: "Le fichier doit être au format PDF." }, { status: 400 });
    }

    const requestedAnalysisLevel = typeof rawAnalysisLevel === "string" ? rawAnalysisLevel.trim().toLowerCase() : "";
    const requestedModel = typeof rawModel === "string" ? rawModel.trim() : "";

    const levelKey = ANALYSIS_MODEL_MAP[requestedAnalysisLevel]
      ? requestedAnalysisLevel
      : (Object.entries(ANALYSIS_MODEL_MAP).find(([, value]) => value === requestedModel)?.[0]
        || DEFAULT_ANALYSIS_LEVEL);
    const model = ANALYSIS_MODEL_MAP[levelKey] || ANALYSIS_MODEL_MAP[DEFAULT_ANALYSIS_LEVEL];

    const { directory, saved } = await savePdfUpload(pdfFile);

    const userId = session.user.id;
    const userCvDir = await ensureUserCvDir(userId);

    // Créer un espace de travail temporaire
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), `cv-pdf-work-${userId}-`));

    // Copier les CVs existants dans l'espace de travail
    const existingFilesBefore = await listUserCvFiles(userId);
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
      pdf_file_path: saved.path,
      pdf_file_name: saved.name,
      analysis_level: levelKey,
      model,
      user: {
        id: userId,
        cv_dir: workspaceDir,
      },
    };

    const scriptPath = path.join(process.cwd(), "scripts", "import_pdf_cv.py");
    try {
      await fs.access(scriptPath);
    } catch (_error) {
      await cleanupUploads(directory);
      return NextResponse.json({ error: "Le script Python import_pdf_cv.py est introuvable." }, { status: 500 });
    }

    const interpreter = await resolvePythonInterpreter();

    let pythonProcess = null;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        const send = payload => controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));

        const activeModel = model
          || process.env.GPT_OPENAI_MODEL
          || process.env.OPENAI_MODEL
          || process.env.OPENAI_API_MODEL
          || ANALYSIS_MODEL_MAP[DEFAULT_ANALYSIS_LEVEL];

        (async () => {
          let stdout = "";
          let stderr = "";
          try {
            send({ type: "status", message: "Analyse du CV PDF en cours..." });
            send({ type: "status", message: `Fichier : ${saved.name}` });
            send({ type: "status", message: `Modèle GPT utilisé : ${activeModel}` });

            pythonProcess = spawn(interpreter, [scriptPath], {
              cwd: process.cwd(),
              env: {
                ...process.env,
                GPT_PDF_IMPORT_PAYLOAD: JSON.stringify(payload),
                GPT_USER_ID: userId,
                GPT_USER_CV_DIR: workspaceDir,
                GPT_USER_NAME: session.user?.name || "",
                GPT_OPENAI_MODEL: activeModel,
                GPT_ANALYSIS_LEVEL: levelKey,
              },
              stdio: ["ignore", "pipe", "pipe"],
            });

            pythonProcess.stdout.on("data", chunk => {
              const text = chunk.toString();
              stdout += text;
              send({ type: "stdout", data: text });
            });

            pythonProcess.stderr.on("data", chunk => {
              const text = chunk.toString();
              stderr += text;
              send({ type: "stderr", data: text });
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

            const cleanOutput = lines
              .filter(line => !line.startsWith("::result::"))
              .join("\n")
              .trim();

            const finalOutput = cleanOutput || "Import PDF exécuté.";

            if (exitCode === 0) {
              // Récupérer les nouveaux fichiers générés
              const workspaceFiles = (await fs.readdir(workspaceDir).catch(() => []))
                .filter(name => name.endsWith(".json"));
              const existingSet = new Set(existingFilesBefore);
              const persistedSet = new Set(existingFilesBefore);

              for (const file of workspaceFiles) {
                try {
                  const absolute = path.join(workspaceDir, file);
                  const content = await fs.readFile(absolute, "utf-8");

                  // Ignorer les fichiers identiques
                  if (existingSet.has(file)) {
                    try {
                      const original = await readUserCvFile(userId, file);
                      if (typeof original === "string" && original.trim() === content.trim()) {
                        continue;
                      }
                    } catch (_err) {}
                  }

                  // Enrichir avec métadonnées si nécessaire
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

                  // Gérer les conflits de noms
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

            if (exitCode !== 0) {
              const message = (stderr.trim() || "Le script Python d'import PDF a échoué.");
              send({ type: "complete", success: false, error: message, output: finalOutput, files: generatedFiles });
            } else {
              send({
                type: "complete",
                success: true,
                output: finalOutput,
                files: generatedFiles,
                file: generatedFiles.length ? generatedFiles[generatedFiles.length - 1] : null,
              });
            }
          } catch (error) {
            send({ type: "error", message: error.message || "Erreur interne lors de l'import du PDF." });
          } finally {
            if (pythonProcess && !pythonProcess.killed) {
              try { pythonProcess.kill("SIGTERM"); } catch (_err) {}
            }
            try {
              await cleanupUploads(directory);
            } catch (_err) {}
            try {
              await fs.rm(workspaceDir, { recursive: true, force: true });
            } catch (_err) {}
            controller.close();
          }
        })();
      },
      cancel() {
        if (pythonProcess && !pythonProcess.killed) {
          try { pythonProcess.kill("SIGTERM"); } catch (_err) {}
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Erreur lors de l'import PDF", error);
    return NextResponse.json({ error: "Erreur interne lors de l'import du PDF." }, { status: 500 });
  }
}