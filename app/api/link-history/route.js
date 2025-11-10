import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

const MAX_LINKS = 20;

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

    return NextResponse.json({
      success: true,
      links: links.map(link => link.url),
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
    for (const url of links) {
      if (typeof url !== 'string' || !url.trim()) continue;

      await prisma.linkHistory.upsert({
        where: {
          userId_url: {
            userId,
            url: url.trim(),
          },
        },
        update: {
          createdAt: new Date(), // Update timestamp to move to front
        },
        create: {
          userId,
          url: url.trim(),
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