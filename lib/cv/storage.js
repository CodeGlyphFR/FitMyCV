import fs from "fs/promises";
import path from "path";
import { encryptString, decryptString } from "@/lib/cv/crypto";

const BASE_DIR = process.env.CV_BASE_DIR || "data/users";

export function getUserCvDir(userId){
  if (!userId) throw new Error("Utilisateur requis");
  return path.join(process.cwd(), BASE_DIR, userId, "cvs");
}

export async function ensureUserCvDir(userId){
  const dir = getUserCvDir(userId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function listUserCvFiles(userId){
  const dir = getUserCvDir(userId);
  await ensureUserCvDir(userId);
  const entries = await fs.readdir(dir).catch(() => []);
  return entries.filter(name => name.endsWith(".json"));
}

export async function readUserCvFile(userId, filename){
  const dir = getUserCvDir(userId);
  const target = path.join(dir, filename);
  const data = await fs.readFile(target, "utf-8");
  try {
    return decryptString(data);
  } catch (error) {
    // fallback for legacy non chiffré
    return data;
  }
}

export async function writeUserCvFile(userId, filename, content){
  const dir = await ensureUserCvDir(userId);
  const target = path.join(dir, filename);
  const payload = encryptString(content);
  await fs.writeFile(target, payload, "utf-8");
  return target;
}

export async function detectNewFiles(userId, before){
  const after = await listUserCvFiles(userId);
  const beforeSet = new Set(before);
  return after.filter(name => !beforeSet.has(name));
}
