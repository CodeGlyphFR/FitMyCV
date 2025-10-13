import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { stripHtml, sanitizeUrl } from "@/lib/security/xssSanitization";
import logger from "@/lib/security/secureLogger";

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { rating, comment, isBugReport, currentCvFile, userAgent, pageUrl } = await request.json();

    // Validations
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Note invalide (1-5 requise)" }, { status: 400 });
    }

    // Sanitization XSS du commentaire
    const trimmedComment = comment ? stripHtml(comment.trim()) : "";

    if (trimmedComment.length > 500) {
      return NextResponse.json({ error: "Le commentaire ne peut pas dépasser 500 caractères" }, { status: 400 });
    }

    // Sanitization de l'URL de la page
    const cleanPageUrl = pageUrl ? sanitizeUrl(pageUrl) : null;

    const userId = session.user.id;

    // Rate limiting : max 10 feedbacks par jour par utilisateur
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentFeedbacksCount = await prisma.feedback.count({
      where: {
        userId,
        createdAt: {
          gte: oneDayAgo,
        },
      },
    });

    if (recentFeedbacksCount >= 10) {
      return NextResponse.json({
        error: "Limite atteinte : Vous ne pouvez envoyer que 10 feedbacks par jour"
      }, { status: 429 });
    }

    // Créer le feedback
    const feedback = await prisma.feedback.create({
      data: {
        userId,
        rating: parseInt(rating),
        comment: trimmedComment,
        isBugReport: Boolean(isBugReport),
        currentCvFile: currentCvFile || null,
        userAgent: userAgent || null,
        pageUrl: cleanPageUrl,
      },
    });

    logger.context('Feedback', 'info', 'Nouveau feedback reçu:', {
      userId,
      rating: feedback.rating,
      isBugReport: feedback.isBugReport,
      commentLength: trimmedComment.length,
    });

    return NextResponse.json({
      success: true,
      feedbackId: feedback.id,
    }, { status: 201 });

  } catch (error) {
    logger.error("Error creating feedback:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
