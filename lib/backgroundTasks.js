// Utility functions for background tasks

export async function executeImportPdfTask(pdfFile, analysisLevel, currentAnalysisOption, abortSignal, taskId) {
  try {
    const formData = new FormData();
    formData.append("pdfFile", pdfFile);
    formData.append("analysisLevel", analysisLevel);
    formData.append("model", currentAnalysisOption.model);
    if (taskId) {
      formData.append("taskId", taskId);
    }

    const response = await fetch("/api/background-tasks/import-pdf", {
      method: "POST",
      body: formData,
      signal: abortSignal,
    });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    // Handle cancellation specifically
    if (response.status === 499 && payload?.cancelled) {
      throw new Error("Task cancelled");
    }
    throw new Error(payload?.error || "Erreur lors de l'import du PDF.");
  }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "L'import du PDF a échoué.");
    }

    return result;
  } catch (error) {
    // Handle AbortSignal cancellation
    if (error.name === 'AbortError' || abortSignal?.aborted) {
      throw new Error("Task cancelled");
    }
    throw error;
  }
}

export async function executeGenerateCvTask(
  linkInputs,
  fileSelection,
  generatorBaseFile,
  generatorBaseItem,
  currentAnalysisOption,
  abortSignal,
  taskId
) {
  try {
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
    if (taskId) {
      formData.append("taskId", taskId);
    }
    (fileSelection || []).forEach((file) => formData.append("files", file));

    const response = await fetch("/api/background-tasks/generate-cv", {
      method: "POST",
      body: formData,
      signal: abortSignal,
    });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    // Handle cancellation specifically
    if (response.status === 499 && payload?.cancelled) {
      throw new Error("Task cancelled");
    }
    throw new Error(payload?.error || "Erreur lors de la génération du CV.");
  }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "La génération du CV a échoué.");
    }

    return result;
  } catch (error) {
    // Handle AbortSignal cancellation
    if (error.name === 'AbortError' || abortSignal?.aborted) {
      throw new Error("Task cancelled");
    }
    throw error;
  }
}