import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { readUserCvFile, writeUserCvFile } from "@/lib/cv/storage";
import { improveCv } from "@/lib/openai/improveCv";
import { v4 as uuidv4 } from "uuid";

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { cvFile, analysisLevel = 'medium', replaceExisting = false } = await request.json();

    if (!cvFile) {
      return NextResponse.json({ error: "CV file missing" }, { status: 400 });
    }

    const userId = session.user.id;

    // Récupérer les métadonnées du CV depuis la DB
    const cvRecord = await prisma.cvFile.findUnique({
      where: {
        userId_filename: {
          userId,
          filename: cvFile,
        },
      },
      select: {
        extractedJobOffer: true,
        scoreBreakdown: true,
        improvementSuggestions: true,
        sourceValue: true,
        sourceType: true,
        matchScore: true,
      },
    });

    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    // Vérifier que le CV a un scoreBreakdown (score calculé) et des suggestions
    if (!cvRecord.scoreBreakdown || !cvRecord.improvementSuggestions) {
      return NextResponse.json({
        error: "Ce CV ne peut pas être amélioré automatiquement",
        details: "Seuls les CV avec un score calculé peuvent être optimisés"
      }, { status: 400 });
    }

    // Parser les suggestions existantes
    let suggestions = [];
    try {
      suggestions = JSON.parse(cvRecord.improvementSuggestions);
    } catch (e) {
      console.error("Erreur parsing suggestions:", e);
    }

    if (!suggestions || suggestions.length === 0) {
      return NextResponse.json({
        error: "Aucune suggestion d'amélioration disponible",
        details: "Générez d'abord un CV depuis une offre pour obtenir des suggestions"
      }, { status: 400 });
    }

    // Rate limiting GLOBAL (partagé avec le calcul de score)
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Récupérer l'utilisateur avec ses compteurs
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        matchScoreRefreshCount: true,
        matchScoreFirstRefreshAt: true,
      },
    });

    let refreshCount = user?.matchScoreRefreshCount || 0;
    let firstRefreshAt = user?.matchScoreFirstRefreshAt;

    // Si first refresh est null OU plus vieux que 24h, reset
    if (!firstRefreshAt || firstRefreshAt < oneDayAgo) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          matchScoreRefreshCount: 0,
          matchScoreFirstRefreshAt: null,
        },
      });
      refreshCount = 0;
      firstRefreshAt = null;
    }

    // Vérifier la limite de 5 actions par 24h
    if (refreshCount >= 5) {
      const timeUntilReset = firstRefreshAt
        ? new Date(firstRefreshAt.getTime() + 24 * 60 * 60 * 1000)
        : new Date();
      const totalMinutesLeft = Math.ceil((timeUntilReset - now) / (60 * 1000));
      const hoursLeft = Math.floor(totalMinutesLeft / 60);
      const minutesLeft = totalMinutesLeft % 60;

      console.log("[improve-cv] Rate limit GLOBAL atteint pour l'utilisateur", userId);
      return NextResponse.json({
        error: "Rate limit exceeded",
        details: `Vous avez atteint la limite de 5 actions par 24h (calculs de score + optimisations combinés). Réessayez dans ${hoursLeft}h${minutesLeft}m.`,
        hoursLeft,
        minutesLeft,
      }, { status: 429 });
    }

    // INCRÉMENTER LE COMPTEUR IMMÉDIATEMENT (anti-fraude)
    if (!firstRefreshAt || refreshCount === 0) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          matchScoreFirstRefreshAt: now,
          matchScoreRefreshCount: 1,
        },
      });
      console.log("[improve-cv] ✅ Compteur incrémenté: 1/5");
    } else {
      await prisma.user.update({
        where: { id: userId },
        data: {
          matchScoreRefreshCount: refreshCount + 1,
        },
      });
      console.log(`[improve-cv] ✅ Compteur incrémenté: ${refreshCount + 1}/5`);
    }

    // Lire le contenu actuel du CV
    const cvContent = await readUserCvFile(userId, cvFile);

    // Créer une tâche d'amélioration
    const taskId = uuidv4();

    await prisma.backgroundTask.create({
      data: {
        id: taskId,
        title: `Amélioration du CV - Score actuel: ${cvRecord.matchScore || 0}/100`,
        type: 'improve-cv',
        status: 'running',
        createdAt: Date.now(),
        shouldUpdateCvList: true,
        deviceId: request.headers.get('x-device-id') || 'unknown',
        userId,
        cvFile, // Lien direct vers le CV
        payload: JSON.stringify({
          cvFile,
          analysisLevel,
          jobOfferUrl: cvRecord.sourceValue,
          currentScore: cvRecord.matchScore || 0,
          suggestions,
          replaceExisting
        })
      }
    });

    // Mettre le status d'optimisation à "inprogress"
    await prisma.cvFile.update({
      where: {
        userId_filename: {
          userId,
          filename: cvFile,
        },
      },
      data: {
        optimiseStatus: 'inprogress',
        optimiseUpdatedAt: new Date()
      }
    });

    // Lancer l'amélioration en arrière-plan
    improveCvAsync({
      taskId,
      userId,
      cvFile,
      cvContent,
      jobOfferUrl: cvRecord.sourceValue,
      currentScore: cvRecord.matchScore || 0,
      suggestions,
      analysisLevel,
      replaceExisting
    });

    return NextResponse.json({
      success: true,
      taskId,
      message: "Amélioration en cours..."
    }, { status: 200 });

  } catch (error) {
    console.error("Error improving CV:", error);
    return NextResponse.json({
      error: "Internal server error",
      details: error.message
    }, { status: 500 });
  }
}

// Fonction asynchrone pour améliorer le CV en arrière-plan
async function improveCvAsync({
  taskId,
  userId,
  cvFile,
  cvContent,
  jobOfferUrl,
  currentScore,
  suggestions,
  analysisLevel,
  replaceExisting = false
}) {
  try {
    console.log(`[improve-cv] Démarrage amélioration pour ${cvFile}`);

    // Appeler la fonction d'amélioration
    const result = await improveCv({
      cvContent,
      jobOfferUrl,
      currentScore,
      suggestions,
      analysisLevel
    });

    // Déterminer le nom de fichier à utiliser
    let improvedFilename;
    if (replaceExisting) {
      // Remplacer le CV existant
      improvedFilename = cvFile;
    } else {
      // Générer un nouveau nom de fichier pour la version améliorée
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      improvedFilename = `improved_${timestamp}.json`;
    }

    // Enrichir le CV amélioré avec des métadonnées
    const improvedCv = JSON.parse(result.improvedCv);

    // S'assurer que changesMade existe et n'est pas vide
    const changesMade = result.changesMade && result.changesMade.length > 0
      ? result.changesMade
      : [
          // Valeurs par défaut si l'IA n'a pas retourné de changements
          {
            section: "summary",
            field: "description",
            change: "Contenu optimisé pour l'offre d'emploi",
            reason: "Amélioration automatique basée sur les suggestions"
          },
          {
            section: "skills",
            field: "hard_skills",
            change: "Compétences réorganisées par pertinence",
            reason: "Alignement avec les besoins de l'offre"
          }
        ];

    // Extraire les sections modifiées depuis changesMade
    const modifiedSections = [...new Set(changesMade.map(c => c.section))];

    console.log(`[improve-cv] Nombre de changements: ${changesMade.length}`);
    console.log(`[improve-cv] Sections modifiées: ${modifiedSections.join(', ')}`);

    improvedCv.meta = {
      ...improvedCv.meta,
      improved_from: cvFile,
      improved_at: new Date().toISOString(),
      score_before: currentScore,
      score_estimate: result.newScoreEstimate,
      changes_count: changesMade.length,
      changes_made: changesMade,
      modified_sections: modifiedSections
    };

    // Sauvegarder le CV amélioré
    await writeUserCvFile(userId, improvedFilename, JSON.stringify(improvedCv, null, 2));

    // Récupérer le cvRecord pour avoir extractedJobOffer
    const cvRecord = await prisma.cvFile.findUnique({
      where: {
        userId_filename: {
          userId,
          filename: cvFile
        }
      }
    });

    if (replaceExisting) {
      // Mettre à jour l'entrée existante dans la DB (score estimé temporaire)
      await prisma.cvFile.update({
        where: {
          userId_filename: {
            userId,
            filename: improvedFilename
          }
        },
        data: {
          matchScore: result.newScoreEstimate,
          matchScoreUpdatedAt: new Date(),
          scoreBreakdown: null,
          improvementSuggestions: null,
          missingSkills: null,
          matchingSkills: null,
          optimiseStatus: 'idle',
          optimiseUpdatedAt: new Date(),
          updatedAt: new Date()
        }
      });
    } else {
      // Créer une nouvelle entrée dans la DB (score estimé temporaire)
      await prisma.cvFile.create({
        data: {
          userId,
          filename: improvedFilename,
          sourceType: cvRecord.sourceType || 'link',
          sourceValue: cvRecord.sourceValue || jobOfferUrl,
          createdBy: 'improve-cv',
          analysisLevel,
          matchScore: result.newScoreEstimate,
          matchScoreUpdatedAt: new Date(),
          scoreBreakdown: null,
          improvementSuggestions: null,
          missingSkills: null,
          matchingSkills: null,
          extractedJobOffer: cvRecord.extractedJobOffer || null,
          optimiseStatus: 'idle',
          optimiseUpdatedAt: new Date()
        }
      });
    }

    console.log(`[improve-cv] ✅ Amélioration terminée avec score estimé: ${result.newScoreEstimate}/100`);

    // Mettre à jour la tâche comme terminée
    const successMessage = replaceExisting
      ? `CV remplacé ! Score estimé: ${result.newScoreEstimate}/100 (${result.improvementDelta})`
      : `CV amélioré ! Score estimé: ${result.newScoreEstimate}/100 (${result.improvementDelta})`;

    await prisma.backgroundTask.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        result: JSON.stringify({
          improvedFile: improvedFilename,
          changesMade: result.changesMade,
          newScore: result.newScoreEstimate,
          improvementDelta: result.improvementDelta,
          replaced: replaceExisting
        }),
        successMessage
      }
    });

    console.log(`[improve-cv] ✅ Amélioration terminée: ${improvedFilename}`);

  } catch (error) {
    console.error(`[improve-cv] Erreur:`, error);

    // ❌ En cas d'erreur, DÉCRÉMENTER le compteur (car il a été incrémenté au début)
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        matchScoreRefreshCount: true,
      },
    });

    if (userRecord && userRecord.matchScoreRefreshCount > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          matchScoreRefreshCount: userRecord.matchScoreRefreshCount - 1,
        },
      });
      console.log(`[improve-cv] ❌ Erreur - Compteur décrémenté: ${userRecord.matchScoreRefreshCount - 1}/5`);
    }

    // Mettre à jour la tâche comme échouée
    await prisma.backgroundTask.update({
      where: { id: taskId },
      data: {
        status: 'failed',
        error: error.message || 'Échec de l\'amélioration'
      }
    });

    // Mettre le CV en failed
    await prisma.cvFile.update({
      where: {
        userId_filename: {
          userId,
          filename: cvFile
        }
      },
      data: {
        optimiseStatus: 'failed',
        optimiseUpdatedAt: new Date()
      }
    }).catch(err => console.error('[improve-cv] Erreur update status failed:', err));
  }
}