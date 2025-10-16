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
import ScrollToTopOnMount from "@/components/ScrollToTopOnMount";
import { HighlightProvider } from "@/components/HighlightProvider";

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
  // Ne passer sectionTitles que s'ils sont vraiment personnalisés (non vides et non par défaut)
  const rawSectionTitles = cv.section_titles || {};
  const hasCustomTitles = Object.keys(rawSectionTitles).length > 0;
  const sectionTitles = hasCustomTitles ? rawSectionTitles : {};

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
    <HighlightProvider cv={cv}>
      <main className="max-w-4xl mx-auto p-4 pb-2">
        <ScrollToTopOnMount />

        {order.map(k => (
          <div key={k} className="cv-section">{sections[k]}</div>
        ))}

        <div className="no-print mt-2 mb-0 text-xs text-white/70 text-center space-y-2">
          <div>© 2025 FitMyCv.ai (v1.0.8)</div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-0 sm:gap-1 leading-none -space-y-3 sm:space-y-0">
            <div className="flex items-baseline justify-center gap-1 leading-none">
              <a href="/about" className="hover:text-white transition-colors">
                À propos
              </a>
              <span className="text-white/40">•</span>
              <a href="/cookies" className="hover:text-white transition-colors">
                Cookies
              </a>
              <span className="text-white/40 hidden sm:inline">•</span>
            </div>
            <div className="flex items-baseline justify-center gap-1 leading-none">
              <a href="/terms" className="hover:text-white transition-colors">
                Conditions générales
              </a>
              <span className="text-white/40">•</span>
              <a href="/privacy" className="hover:text-white transition-colors">
                Politique de confidentialité
              </a>
            </div>
          </div>
        </div>
      </main>
    </HighlightProvider>
  );
}