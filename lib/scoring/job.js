import prisma from "@/lib/prisma";
import { readUserCvFile } from "@/lib/cv-core/storage";
import { createJobRunner } from "@/lib/background-jobs/jobRunner";
import { updateCvFile } from "@/lib/events/prismaWithEvents";
import { trackMatchScore } from "@/lib/telemetry/server";

async function getCalculateMatchScoreWithAnalysis() {
  const module = await import("@/lib/scoring/service");
  return module.calculateMatchScoreWithAnalysis;
}

const { schedule: scheduleCalculateMatchScoreJob, run: runCalculateMatchScoreJob } = createJobRunner({
  name: 'calculateMatchScore',

  getService: getCalculateMatchScoreWithAnalysis,

  beforeRun: async ({ user, cvFile }) => {
    // Mettre le status du CV à "calculating"
    await updateCvFile(user.id, cvFile, {
      matchScoreStatus: 'inprogress',
    }).catch(err => console.error(`[calculateMatchScoreJob] Impossible de mettre à jour le status du CV:`, err));
  },

  prepareInput: async ({ user, cvFile, jobOfferUrl }, signal) => {
    const userId = user.id;

    // Lire le CV
    const cvContent = await readUserCvFile(userId, cvFile);
    console.log(`[calculateMatchScoreJob] CV lu avec succès, taille: ${cvContent.length} caractères`);

    // Récupérer le record CvFile pour obtenir jobOffer si disponible
    const cvFileRecord = await prisma.cvFile.findUnique({
      where: { userId_filename: { userId, filename: cvFile } },
      select: {
        jobOffer: true,
        sourceValue: true,
        matchScore: true,
        matchScoreUpdatedAt: true,
        scoreBreakdown: true,
        improvementSuggestions: true,
        missingSkills: true,
        matchingSkills: true,
      },
    }).catch(() => null);

    return {
      cvContent,
      jobOfferUrl,
      cvFile: cvFileRecord,
      signal,
      userId,
    };
  },

  handleResult: async ({ jobInput, result, userId }) => {
    const { cvFile, isAutomatic } = jobInput;

    console.log(`[calculateMatchScoreJob] Score calculé: ${result.matchScore}/100, Suggestions: ${result.suggestions.length}`);

    // Sauvegarder le score et l'analyse complète dans le CV
    await updateCvFile(userId, cvFile, {
      matchScore: result.matchScore,
      matchScoreUpdatedAt: new Date(),
      matchScoreStatus: 'idle',
      scoreBreakdown: JSON.stringify(result.scoreBreakdown),
      improvementSuggestions: JSON.stringify(result.suggestions),
      missingSkills: JSON.stringify(result.missingSkills),
      matchingSkills: JSON.stringify(result.matchingSkills),
      scoreBefore: null,
    });

    console.log(`[calculateMatchScoreJob] ✅ Calcul réussi - Score: ${result.matchScore}/100`);

    return {
      data: {
        score: result.matchScore,
        suggestions: result.suggestions.length,
      },
      successMessage: `Score de match calculé: ${result.matchScore}/100 avec ${result.suggestions.length} suggestions`,
      trackingData: {
        score: result.matchScore,
        isAutomatic,
        suggestionsCount: result.suggestions.length,
      },
    };
  },

  onCancellation: async ({ user, cvFile }) => {
    // Remettre le status du CV en cas d'annulation
    await updateCvFile(user.id, cvFile, {
      matchScoreStatus: null,
    }).catch(() => {});
  },

  trackSuccess: async ({ userId, deviceId, duration, score, isAutomatic }) => {
    await trackMatchScore({
      userId,
      deviceId: deviceId || null,
      score,
      isAutomatic: isAutomatic || false,
      tokensUsed: 0,
      tokensRemaining: 0,
      duration,
      status: 'success',
    });
  },

  trackError: async ({ userId, deviceId, duration, error, isAutomatic }) => {
    await trackMatchScore({
      userId,
      deviceId: deviceId || null,
      score: 0,
      isAutomatic: isAutomatic || false,
      tokensUsed: 0,
      tokensRemaining: 0,
      duration,
      status: 'error',
      error,
    });
  },
});

export { scheduleCalculateMatchScoreJob, runCalculateMatchScoreJob };
