import React, { Suspense } from "react";
import Header from "@/components/Header";
import Summary from "@/components/Summary";
import Skills from "@/components/Skills";
import Experience from "@/components/Experience";
import Education from "@/components/Education";
import Languages from "@/components/Languages";
import Extras from "@/components/Extras";
import Projects from "@/components/Projects";
import EmptyState from "@/components/EmptyState";

import { sanitizeInMemory } from "@/lib/sanitize";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/session";
import { ensureUserCvDir, listUserCvFiles, readUserCvFile } from "@/lib/cv/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getCV(userId){
  const cvCookie = (cookies().get("cvFile") || {}).value;
  await ensureUserCvDir(userId);
  const availableFiles = await listUserCvFiles(userId);

  // Si aucun CV n'existe, retourner null
  if (availableFiles.length === 0) {
    return null;
  }

  const file = (cvCookie && availableFiles.includes(cvCookie)) ? cvCookie : availableFiles[0];

  let raw;
  try {
    raw = await readUserCvFile(userId, file);
  } catch (error) {
    // Si le fichier n'existe pas, retourner null
    return null;
  }

  // Pas de sanitize ni validation à l'affichage - uniquement parsing
  const cv = JSON.parse(raw);

  return { cv };
}

export default async function Page(){
  const session = await auth();
  if (!session?.user?.id){
    redirect("/auth");
  }

  const cvResult = await getCV(session.user.id);

  // Si aucun CV n'existe, afficher l'EmptyState
  if (!cvResult) {
    return <EmptyState />;
  }

  const { cv } = cvResult;
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
  const defaultOrder = ["header","summary","skills","experience","education","languages","extras"];
  const base = Array.isArray(cv.order_hint) && cv.order_hint.length ? [...cv.order_hint] : [...defaultOrder];

  if (!base.includes("projects")) {
    const idx = base.indexOf("extras");
    if (idx >= 0) base.splice(idx + 1, 0, "projects");
    else base.push("projects");
  }

  const order = base;

  return (
    <main className="max-w-4xl mx-auto p-4 min-h-[calc(100vh-116px)]">

      {order.map(k => (
        <div key={k} className="cv-section">{sections[k]}</div>
      ))}

      <div className="no-print mt-8 text-xs opacity-60 text-center">
        Next.js (JS) • Erick DE SMET • 2025
      </div>
    </main>
  );
}