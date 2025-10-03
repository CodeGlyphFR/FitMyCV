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
    const { cvFile, analysisLevel = 'medium' } = await request.json();

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
    });

    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    // Vérifier que le CV a été créé depuis un lien et a des suggestions
    if (cvRecord.sourceType !== "link" || !cvRecord.improvementSuggestions) {
      return NextResponse.json({
        error: "Ce CV ne peut pas être amélioré automatiquement",
        details: "Seuls les CV générés depuis une offre d'emploi peuvent être optimisés"
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
        payload: JSON.stringify({
          cvFile,
          analysisLevel,
          jobOfferUrl: cvRecord.sourceValue,
          currentScore: cvRecord.matchScore || 0,
          suggestions
        })
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
      analysisLevel
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
  analysisLevel
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

    // Générer un nouveau nom de fichier pour la version améliorée
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const improvedFilename = `improved_${timestamp}.json`;

    // Enrichir le CV amélioré avec des métadonnées
    const improvedCv = JSON.parse(result.improvedCv);

    // Extraire les sections modifiées depuis changesMade
    const modifiedSections = [...new Set(result.changesMade.map(c => c.section))];

    improvedCv.meta = {
      ...improvedCv.meta,
      improved_from: cvFile,
      improved_at: new Date().toISOString(),
      score_before: currentScore,
      score_estimate: result.newScoreEstimate,
      changes_count: result.changesMade.length,
      changes_made: result.changesMade,
      modified_sections: modifiedSections
    };

    // Sauvegarder le CV amélioré
    await writeUserCvFile(userId, improvedFilename, JSON.stringify(improvedCv, null, 2));

    // Créer l'entrée dans la DB pour le nouveau CV
    await prisma.cvFile.create({
      data: {
        userId,
        filename: improvedFilename,
        sourceType: 'link',
        sourceValue: jobOfferUrl,
        createdBy: 'improve-cv',
        analysisLevel,
        matchScore: result.newScoreEstimate,
        matchScoreUpdatedAt: new Date()
      }
    });

    // Mettre à jour la tâche comme terminée
    await prisma.backgroundTask.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        result: JSON.stringify({
          improvedFile: improvedFilename,
          changesMade: result.changesMade,
          newScore: result.newScoreEstimate,
          improvementDelta: result.improvementDelta
        }),
        successMessage: `CV amélioré ! Score estimé: ${result.newScoreEstimate}/100 (${result.improvementDelta})`
      }
    });

    console.log(`[improve-cv] ✅ Amélioration terminée: ${improvedFilename}`);

  } catch (error) {
    console.error(`[improve-cv] Erreur:`, error);

    // Mettre à jour la tâche comme échouée
    await prisma.backgroundTask.update({
      where: { id: taskId },
      data: {
        status: 'failed',
        error: error.message || 'Échec de l\'amélioration'
      }
    });
  }
}