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
import { ensureUserCvDir, listUserCvFiles, readUserCvFileWithMeta } from "@/lib/cv/storage";
import { getSectionOrder, getSectionTitles } from "@/lib/openai/cvConstants";

export const metadata = {
  title: "Mes CVs - FitMyCV.io",
  description: "Visualisez et gérez vos CV personnalisés",
};

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

  let cvData;
  try {
    // Récupérer le CV avec ses métadonnées depuis la DB
    cvData = await readUserCvFileWithMeta(userId, file);
  } catch (error) {
    // Si le fichier n'existe pas, retourner null
    return null;
  }

  // Récupérer l'ordre des sections depuis Settings (global)
  const orderHint = await getSectionOrder();

  // Langue depuis la DB (ou fallback vers cv.language pour rétrocompatibilité, ou 'fr')
  const language = cvData.language || cvData.content?.language || 'fr';

  // Calculer les titres de sections depuis la langue
  const sectionTitles = getSectionTitles(language);

  return {
    cv: cvData.content,
    language,
    orderHint,
    sectionTitles,
  };
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

  // Extraire les données depuis cvResult
  const { cv, language: cvLanguage, orderHint, sectionTitles } = cvResult;

  const sections = {
    header:     <Header header={cv.header} cvLanguage={cvLanguage} />,
    summary:    <Summary summary={cv.summary} sectionTitles={sectionTitles} cvLanguage={cvLanguage} />,
    skills:     <Skills skills={cv.skills} sectionTitles={sectionTitles} cvLanguage={cvLanguage} />,
    experience: <Experience experience={cv.experience} sectionTitles={sectionTitles} cvLanguage={cvLanguage} />,
    education:  <Education education={cv.education} sectionTitles={sectionTitles} cvLanguage={cvLanguage} />,
    languages:  <Languages languages={cv.languages} sectionTitles={sectionTitles} cvLanguage={cvLanguage} />,
    extras:     <Extras extras={cv.extras} sectionTitles={sectionTitles} cvLanguage={cvLanguage} />,
    projects:   <Projects projects={cv.projects} sectionTitles={sectionTitles} cvLanguage={cvLanguage} />,
  };

  // ---- ORDRE DES SECTIONS (depuis Settings, toujours inclure "projects") ----
  const base = [...orderHint];

  if (!base.includes("projects")) {
    const idx = base.indexOf("extras");
    if (idx >= 0) base.splice(idx + 1, 0, "projects");
    else base.push("projects");
  }

  const order = base;

  return (
    <HighlightProvider cv={cv}>
      <main className="max-w-4xl mx-auto p-4 pb-2 md:pt-8">
        <ScrollToTopOnMount />

        {order.map(k => (
          <div key={k} className="cv-section">{sections[k]}</div>
        ))}

      </main>
    </HighlightProvider>
  );
}
