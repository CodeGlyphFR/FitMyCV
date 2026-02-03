import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { normalizeJobUrl } from '@/lib/utils/normalizeJobUrl';

const MAX_LINKS = 20;

/**
 * Extrait le nom de domaine simplifié d'une URL
 * Ex: "https://www.indeed.com/job/123" -> "Indeed"
 * Ex: "https://fr.indeed.com/job/123" -> "Indeed"
 * Ex: "https://apec.fr/candidat/offre" -> "Apec"
 * Ex: "https://www.welcometothejungle.com/fr/companies" -> "Welcome"
 */
function extractDomainName(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    // Enlever www. et les sous-domaines de langue (fr, en, de, es, it, etc.)
    const langSubdomains = ['www', 'fr', 'en', 'de', 'es', 'it', 'pt', 'nl', 'pl', 'ru', 'jp', 'cn', 'uk', 'm', 'mobile'];
    const parts = hostname.split('.');

    // Filtrer les sous-domaines de langue/www du début
    while (parts.length > 2 && langSubdomains.includes(parts[0])) {
      parts.shift();
    }

    // Prendre le premier segment restant (le nom du site)
    const name = parts[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const links = await prisma.linkHistory.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: MAX_LINKS,
      select: {
        id: true,
        url: true,
        createdAt: true,
      },
    });

    // Récupérer les offres d'emploi correspondantes pour avoir les titres
    // On normalise les URLs car JobOffer stocke les URLs normalisées
    const normalizedUrls = links.map(link => normalizeJobUrl(link.url));
    const jobOffers = await prisma.jobOffer.findMany({
      where: {
        userId: session.user.id,
        sourceType: 'url',
        sourceValue: { in: normalizedUrls },
      },
      select: {
        sourceValue: true,
        content: true,
      },
    });

    // Créer une map URL normalisée -> {title, company, language}
    const urlToData = new Map();
    for (const offer of jobOffers) {
      const content = offer.content;
      const title = content?.title || null;
      const company = content?.company || null;
      const language = content?.language || null;
      if (title || company || language) {
        urlToData.set(offer.sourceValue, { title, company, language });
      }
    }

    // Enrichir les liens avec id, titre, company, language et domaine
    // On utilise l'URL normalisée pour chercher les données
    const enrichedLinks = links.map(link => {
      const data = urlToData.get(normalizeJobUrl(link.url)) || {};
      return {
        id: link.id,
        url: link.url,
        title: data.title || null,
        company: data.company || null,
        language: data.language || null,
        domain: extractDomainName(link.url),
      };
    });

    return NextResponse.json({
      success: true,
      links: enrichedLinks,
    });
  } catch (error) {
    console.error('Error fetching link history:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'historique' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { links } = body;

    if (!Array.isArray(links) || links.length === 0) {
      return NextResponse.json(
        { error: 'Aucun lien fourni' },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    // Add links to history (using upsert to avoid duplicates)
    // Normalize URLs for consistency with JobOffer storage
    for (const url of links) {
      if (typeof url !== 'string' || !url.trim()) continue;

      const normalizedUrl = normalizeJobUrl(url.trim());

      await prisma.linkHistory.upsert({
        where: {
          userId_url: {
            userId,
            url: normalizedUrl,
          },
        },
        update: {
          createdAt: new Date(), // Update timestamp to move to front
        },
        create: {
          userId,
          url: normalizedUrl,
        },
      });
    }

    // Keep only the most recent MAX_LINKS
    const allLinks = await prisma.linkHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (allLinks.length > MAX_LINKS) {
      const idsToDelete = allLinks.slice(MAX_LINKS).map(link => link.id);
      await prisma.linkHistory.deleteMany({
        where: {
          id: { in: idsToDelete },
          userId,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving link history:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la sauvegarde de l\'historique' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get('id');

    if (!linkId) {
      return NextResponse.json(
        { error: 'ID du lien requis' },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    // Récupérer le lien pour avoir l'URL
    const linkRecord = await prisma.linkHistory.findFirst({
      where: { id: linkId, userId },
    });

    if (!linkRecord) {
      return NextResponse.json(
        { error: 'Lien non trouvé' },
        { status: 404 }
      );
    }

    // Supprimer l'offre d'emploi associée (si elle existe)
    // Utiliser l'URL normalisée car JobOffer stocke les URLs normalisées
    const normalizedUrl = normalizeJobUrl(linkRecord.url);
    await prisma.jobOffer.deleteMany({
      where: {
        userId,
        sourceType: 'url',
        sourceValue: normalizedUrl,
      },
    });

    // Supprimer le lien de l'historique
    await prisma.linkHistory.delete({
      where: { id: linkId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting link history:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression' },
      { status: 500 }
    );
  }
}