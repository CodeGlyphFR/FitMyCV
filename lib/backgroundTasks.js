// Utility functions for background tasks

export async function executeImportPdfTask(pdfFile, analysisLevel, currentAnalysisOption) {
  const formData = new FormData();
  formData.append("pdfFile", pdfFile);
  formData.append("analysisLevel", analysisLevel);
  formData.append("model", currentAnalysisOption.model);

  const response = await fetch("/api/background-tasks/import-pdf", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || "Erreur lors de l'import du PDF.");
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "L'import du PDF a échoué.");
  }

  return result;
}

export async function executeGenerateCvTask(
  linkInputs,
  fileSelection,
  generatorBaseFile,
  generatorBaseItem,
  currentAnalysisOption
) {
  const cleanedLinks = linkInputs
    .map((l) => (l || "").trim())
    .filter(Boolean);

  const formData = new FormData();
  formData.append("links", JSON.stringify(cleanedLinks));
  formData.append("baseFile", generatorBaseFile);
  const baseFileLabel = generatorBaseItem?.displayTitle || generatorBaseItem?.title || "";
  formData.append("baseFileLabel", baseFileLabel);
  formData.append("analysisLevel", currentAnalysisOption.id);
  formData.append("model", currentAnalysisOption.model);
  (fileSelection || []).forEach((file) => formData.append("files", file));

  const response = await fetch("/api/background-tasks/generate-cv", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || "Erreur lors de la génération du CV.");
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "La génération du CV a échoué.");
  }

  return result;
}