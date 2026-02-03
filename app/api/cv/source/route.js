import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { CommonErrors, CvErrors } from "@/lib/api/apiErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return CommonErrors.notAuthenticated();
  }

  try {
    // Paramètre pour retourner les détails complets de l'offre
    const { searchParams } = new URL(request.url);
    const fullDetails = searchParams.get('full') === 'true';

    // Next.js 16: cookies() est maintenant async
    const cookieStore = await cookies();
    const cvCookie = (cookieStore.get("cvFile") || {}).value;

    if (!cvCookie) {
      return NextResponse.json({
        sourceType: null,
        sourceValue: null,
        hasJobOffer: false,
      });
    }

    const cvFile = await prisma.cvFile.findUnique({
      where: {
        userId_filename: {
          userId: session.user.id,
          filename: cvCookie,
        },
      },
      select: {
        id: true,
        sourceType: true,
        sourceValue: true,
        jobOfferId: true, // Vérifier si un JobOffer est associé
        jobOfferSnapshot: true, // Snapshot pour fallback si offre supprimée
        jobOffer: {
          select: {
            id: true, // ID pour le mode full
            sourceType: true,
            sourceValue: true, // URL ou nom fichier PDF de l'offre
            content: true, // Contenu JSON pour récupérer le titre
          },
        },
      },
    });

    if (!cvFile) {
      return NextResponse.json({
        sourceType: null,
        sourceValue: null,
        hasJobOffer: false,
        jobOfferInfo: null,
        sourceCvInfo: null,
      });
    }

    // Récupérer les infos du CV source depuis la version 0 (créée lors de la génération)
    let sourceCvInfo = null;
    const version0 = await prisma.cvVersion.findUnique({
      where: {
        cvFileId_version: {
          cvFileId: cvFile.id,
          version: 0,
        },
      },
      select: {
        sourceFile: true,
      },
    });

    if (version0?.sourceFile) {
      // Récupérer les détails du CV source
      const sourceCv = await prisma.cvFile.findUnique({
        where: {
          userId_filename: {
            userId: session.user.id,
            filename: version0.sourceFile,
          },
        },
        select: {
          filename: true,
          content: true,
          createdAt: true,
        },
      });

      if (sourceCv) {
        // Extraire le titre du CV depuis le contenu JSON
        const cvContent = sourceCv.content;
        const title = cvContent?.header?.current_title || cvContent?.header?.name || version0.sourceFile.replace(/\.json$/, '');

        sourceCvInfo = {
          filename: version0.sourceFile,
          title: title,
          createdAt: sourceCv.createdAt,
        };
      } else {
        // Le CV source n'existe plus, afficher juste le nom du fichier
        sourceCvInfo = {
          filename: version0.sourceFile,
          title: version0.sourceFile.replace(/\.json$/, ''),
          createdAt: null,
        };
      }
    }

    // Infos de l'offre d'emploi (titre + URL ou détails complets)
    // Priorité: jobOffer (live) > jobOfferSnapshot (si offre supprimée)
    let jobOfferInfo = null;
    if (fullDetails && cvFile.jobOffer) {
      // Retourner le contenu complet pour le modal de détails (offre live)
      jobOfferInfo = {
        id: cvFile.jobOffer.id,
        sourceType: cvFile.jobOffer.sourceType,
        sourceValue: cvFile.jobOffer.sourceValue,
        content: cvFile.jobOffer.content,
      };
    } else if (fullDetails && cvFile.jobOfferSnapshot) {
      // Fallback: utiliser le snapshot si l'offre a été supprimée
      jobOfferInfo = {
        id: null, // Pas d'ID car l'offre n'existe plus
        sourceType: cvFile.jobOfferSnapshot.sourceType,
        sourceValue: cvFile.jobOfferSnapshot.sourceValue,
        content: cvFile.jobOfferSnapshot.content,
        isSnapshot: true, // Flag pour indiquer que c'est un snapshot
      };
    } else if (cvFile.jobOffer) {
      // Mode non-full: juste titre + URL (offre live)
      const jobContent = cvFile.jobOffer.content;
      const jobTitle = jobContent?.title || null;
      const jobUrl = cvFile.jobOffer.sourceType === 'url' ? cvFile.jobOffer.sourceValue : null;

      jobOfferInfo = {
        title: jobTitle,
        url: jobUrl,
      };
    } else if (cvFile.jobOfferSnapshot) {
      // Mode non-full: fallback sur snapshot
      const snapshotContent = cvFile.jobOfferSnapshot.content;
      const jobTitle = snapshotContent?.title || null;
      const jobUrl = cvFile.jobOfferSnapshot.sourceType === 'url' ? cvFile.jobOfferSnapshot.sourceValue : null;

      jobOfferInfo = {
        title: jobTitle,
        url: jobUrl,
        isSnapshot: true,
      };
    } else if (cvFile.sourceType === 'link' && cvFile.sourceValue) {
      // Dernier fallback si pas de JobOffer ni snapshot mais sourceType est link
      jobOfferInfo = {
        title: null,
        url: cvFile.sourceValue,
      };
    }

    return NextResponse.json({
      sourceType: cvFile.sourceType,
      sourceValue: cvFile.sourceValue,
      hasJobOffer: !!cvFile.jobOfferId || !!cvFile.jobOfferSnapshot,
      jobOfferInfo,
      sourceCvInfo,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération de la source du CV:", error);
    return CvErrors.sourceError();
  }
}
