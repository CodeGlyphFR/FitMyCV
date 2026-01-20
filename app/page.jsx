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
import OrphanedChangesDisplay from "@/components/OrphanedChangesDisplay";

import { sanitizeInMemory } from "@/lib/sanitize";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/session";
import { ensureUserCvDir, listUserCvFiles, readUserCvFileWithMeta } from "@/lib/cv-core/storage";
import { getCvVersionContent } from "@/lib/cv-core/versioning";
import { getSectionOrder, getSectionTitles } from "@/lib/cv-core/constants";

export const metadata = {
  title: "Mes CVs - FitMyCV.io",
  description: "Visualisez et gérez vos CV personnalisés",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getCV(userId, versionNumber = null){
  const cookieStore = await cookies();
  const cvCookie = (cookieStore.get("cvFile") || {}).value;
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

  // Si une version spécifique est demandée, charger son contenu
  let cvContent = cvData.content;
  let isViewingVersion = false;

  if (versionNumber !== null && versionNumber >= 0) {
    const versionContent = await getCvVersionContent(userId, file, versionNumber);
    if (versionContent) {
      cvContent = versionContent;
      isViewingVersion = true;
    }
  }

  // Récupérer l'ordre des sections depuis Settings (global)
  const orderHint = await getSectionOrder();

  // Langue depuis la DB (ou fallback vers cv.language pour rétrocompatibilité, ou 'fr')
  const language = cvData.language || cvContent?.language || 'fr';

  // Calculer les titres de sections depuis la langue
  const sectionTitles = getSectionTitles(language);

  return {
    cv: cvContent,
    filename: file,
    language,
    orderHint,
    sectionTitles,
    isViewingVersion,
    viewingVersionNumber: versionNumber,
    contentVersion: cvData.contentVersion || 1,
  };
}

export default async function Page(props){
  const session = await auth();
  if (!session?.user?.id){
    redirect("/auth");
  }

  // Next.js 16: searchParams est maintenant async
  const searchParams = await props.searchParams;

  // Extraire le paramètre version de l'URL (?version=2)
  const versionParam = searchParams?.version;
  const versionNumber = versionParam ? parseInt(versionParam, 10) : null;

  // Extraire le paramètre cv de l'URL (?cv=filename.json) pour ouvrir un CV spécifique
  const cvParam = searchParams?.cv;

  const cvResult = await getCV(session.user.id, versionNumber, cvParam);

  // Si aucun CV n'existe, afficher l'EmptyState
  if (!cvResult) {
    return <EmptyState />;
  }

  // Extraire les données depuis cvResult
  const { cv, filename, language: cvLanguage, orderHint, sectionTitles, isViewingVersion, viewingVersionNumber, contentVersion } = cvResult;

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
    <HighlightProvider cv={cv} filename={filename} initialVersion={isViewingVersion ? viewingVersionNumber : 'latest'} contentVersion={contentVersion}>
      <main className="max-w-4xl mx-auto p-4 pb-2 md:pt-8">
        <ScrollToTopOnMount />

        {order.map(k => (
          <React.Fragment key={k}>
            <div className="cv-section">{sections[k]}</div>
            {/* Affiche les changements orphelins juste après le header */}
            {k === "header" && <OrphanedChangesDisplay />}
          </React.Fragment>
        ))}

      </main>
    </HighlightProvider>
  );
}
