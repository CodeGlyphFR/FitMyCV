import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { ensureUserCvDir, listUserCvFiles, readUserCvFile, writeUserCvFile } from "@/lib/cv/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeLinks(raw){
  if (!Array.isArray(raw)) return [];
  return raw
    .map(link => (typeof link === "string" ? link : String(link || "")))
    .map(link => link.trim())
    .filter(link => !!link);
}

async function saveUploads(files){
  if (!files.length) return { directory: null, saved: [] };
  const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "cv-gpt-"));
  const saved = [];

  for (const file of files){
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

async function cleanupUploads(directory){
  if (!directory) return;
  try {
    await fs.rm(directory, { recursive: true, force: true });
  } catch (error) {
    console.error("Impossible de nettoyer le dossier temporaire", error);
  }
}

async function resolvePythonInterpreter(){
  const projectRoot = process.cwd();
  const candidates = [
    path.join(projectRoot, ".venv", "bin", "python"),
    path.join(projectRoot, ".venv", "bin", "python3"),
    path.join(projectRoot, ".venv", "Scripts", "python.exe"),
    path.join(projectRoot, ".venv", "Scripts", "python"),
    "python3",
    "python",
  ];

  for (const candidate of candidates){
    try {
      await fs.access(candidate);
      return candidate;
    } catch (_error) {
      // continue to next candidate
    }
  }

  return "python3";
}

export async function POST(request){
  const session = await auth();
  if (!session?.user?.id){
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const rawLinks = formData.get("links");
    let parsedLinks = [];

    if (rawLinks){
      try {
        parsedLinks = JSON.parse(rawLinks);
      } catch (_error) {
        return NextResponse.json({ error: "Format des liens invalide." }, { status: 400 });
      }
    }

    const links = sanitizeLinks(parsedLinks);
    const files = formData.getAll("files").filter(Boolean);

    if (!links.length && !files.length){
      return NextResponse.json({ error: "Ajoutez au moins un lien ou un fichier pour lancer l'assistant." }, { status: 400 });
    }

    const { directory, saved } = await saveUploads(files);

    const userId = session.user.id;
    const userCvDir = await ensureUserCvDir(userId);
    const existingFilesBefore = await listUserCvFiles(userId);
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), `cv-work-${userId}-`));
    for (const fileName of existingFilesBefore){
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

    let pythonProcess = null;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        const send = payload => controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));

        const model = process.env.GPT_OPENAI_MODEL
          || process.env.OPENAI_MODEL
          || process.env.OPENAI_API_MODEL
          || "gpt-4.1-mini";

        (async () => {
          let stdout = "";
          let stderr = "";
          try {
            send({ type: "status", message: "Analyse en cours..." });
            send({ type: "status", message: `Modèle GPT utilisé : ${model}` });
            pythonProcess = spawn(interpreter, [scriptPath], {
              cwd: process.cwd(),
              env: {
                ...process.env,
                GPT_GENERATOR_PAYLOAD: JSON.stringify(payload),
                GPT_USER_ID: userId,
                GPT_USER_CV_DIR: workspaceDir,
                GPT_USER_NAME: session.user?.name || "",
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

            const finalOutput = cleanOutput || "Script exécuté.";

            if (exitCode === 0){
              const workspaceFiles = (await fs.readdir(workspaceDir).catch(() => []))
                .filter(name => name.endsWith(".json"));
              const existingSet = new Set(existingFilesBefore);
              const persistedSet = new Set(existingFilesBefore);

              for (const file of workspaceFiles){
                try {
                  const absolute = path.join(workspaceDir, file);
                  const content = await fs.readFile(absolute, "utf-8");
                  if (existingSet.has(file)){
                    try {
                      const original = await readUserCvFile(userId, file);
                      if (typeof original === "string" && original.trim() === content.trim()){
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
                  if (persistedSet.has(targetFile)){
                    const dot = targetFile.lastIndexOf(".");
                    const base = dot >= 0 ? targetFile.slice(0, dot) : targetFile;
                    const ext = dot >= 0 ? targetFile.slice(dot) : "";
                    let suffix = 1;
                    while (persistedSet.has(targetFile)){
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

            if (exitCode !== 0){
              const message = (stderr.trim() || "Le script Python a échoué.");
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
            send({ type: "error", message: error.message || "Erreur interne lors de l'exécution du script." });
          } finally {
            if (pythonProcess && !pythonProcess.killed){
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
      cancel(){
        if (pythonProcess && !pythonProcess.killed){
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
    console.error("Erreur lors de la génération GPT", error);
    return NextResponse.json({ error: "Erreur interne lors de la préparation du prompt GPT." }, { status: 500 });
  }
}
