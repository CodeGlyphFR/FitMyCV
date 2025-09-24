import React from "react";
import Header from "@/components/Header";
import Summary from "@/components/Summary";
import Skills from "@/components/Skills";
import Experience from "@/components/Experience";
import Education from "@/components/Education";
import Languages from "@/components/Languages";
import Extras from "@/components/Extras";
import Projects from "@/components/Projects";

import fs from "fs/promises";
import path from "path";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { sanitizeInMemory } from "@/lib/sanitize";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/session";
import { ensureUserCvDir, listUserCvFiles, readUserCvFile, writeUserCvFile } from "@/lib/cv/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getCV(userId){
  const cvCookie = (cookies().get("cvFile") || {}).value;
  await ensureUserCvDir(userId);
  const availableFiles = await listUserCvFiles(userId);
  const fallback = availableFiles.includes("main.json") ? "main.json" : (availableFiles[0] || "main.json");
  const file = (cvCookie && availableFiles.includes(cvCookie)) ? cvCookie : fallback;
  const cvPath = path.join(ensureUserCvDirPath(userId), file);

  let raw;
  try {
    raw = await readUserCvFile(userId, file);
  } catch (error) {
    await writeUserCvFile(userId, file, JSON.stringify({ header: { full_name: "" } }, null, 2));
    raw = await readUserCvFile(userId, file);
  }

  let cv = sanitizeInMemory(JSON.parse(raw));
  await writeUserCvFile(userId, file, JSON.stringify(cv, null, 2));

  const schemaRaw = await readSchema();
  const schema = JSON.parse(schemaRaw);

  const ajv = new Ajv({ allErrors:true, allowUnionTypes:true });
  addFormats(ajv);

  const validate = ajv.compile(schema);
  const valid = !!validate(cv);
  const errors = valid ? [] : (validate.errors || []);

  return { cv, valid, errors };
}

function ensureUserCvDirPath(userId){
  const baseDir = process.env.CV_BASE_DIR || "data/users";
  return path.join(process.cwd(), baseDir, userId, "cvs");
}

async function readSchema(){
  return fs.readFile(path.join(process.cwd(), "data", "schema.json"), "utf-8");
}

export default async function Page(){
  const session = await auth();
  if (!session?.user?.id){
    redirect("/auth");
  }

  const { cv, valid, errors } = await getCV(session.user.id);
  const sectionTitles = cv.section_titles || {};

  const sections = {
    header:     <Header header={cv.header} />,
    summary:    <Summary summary={cv.summary} sectionTitles={sectionTitles} />,
    skills:     <Skills skills={cv.skills} sectionTitles={sectionTitles} />,
    experience: <Experience experience={cv.experience} sectionTitles={sectionTitles} />,
    education:  <Education education={cv.education} sectionTitles={sectionTitles} />,
    languages:  <Languages languages={cv.languages} sectionTitles={sectionTitles} />,
    extras:     <Extras extras={cv.extras} sectionTitles={sectionTitles} />,
    projects:   <Projects projects={cv.projects} sectionTitles={sectionTitles} />,
  };

  // ---- ORDRE DES SECTIONS (toujours inclure "projects") ----
  // Si order_hint est présent, on le respecte puis on injecte "projects" s'il manque,
  // idéalement juste après "extras"; sinon en fin.
  const defaultOrder = ["header","summary","skills","experience","education","languages","extras"];
  const base = Array.isArray(cv.order_hint) && cv.order_hint.length ? [...cv.order_hint] : [...defaultOrder];

  if (!base.includes("projects")) {
    const idx = base.indexOf("extras");
    if (idx >= 0) base.splice(idx + 1, 0, "projects");
    else base.push("projects");
  }

  const order = base;

  const showBanner = headers().get("x-debug") === "1";

  return (
    <main className="max-w-4xl mx-auto p-4">
      {(!valid && showBanner) ? (
        <div className="no-print mb-4 rounded-2xl border border-yellow-300 bg-yellow-50 text-yellow-900 p-3">
          <div className="font-semibold">Avertissement: le JSON ne valide pas le schéma</div>
          <ul className="list-disc pl-5 text-sm">
            {errors.map((e, i) => (
              <li key={i}>{(e.instancePath || "(racine)")} — {e.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {order.map(k => (
        <div key={k}>{sections[k]}</div>
      ))}

      <footer className="no-print mt-8 text-xs opacity-60 text-center">
        Next.js (JS) • Erick DE SMET • 2025
      </footer>
    </main>
  );
}
