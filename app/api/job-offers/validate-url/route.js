import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { CommonErrors } from '@/lib/api/apiErrors';
import prisma from '@/lib/prisma';
import { normalizeJobUrl } from '@/lib/utils/normalizeJobUrl';
import { fetchHtmlWithFallback } from '@/lib/job-offer/extraction/url';
import { extractJobOfferContent } from '@/lib/utils/htmlToMarkdown/index.js';
import { detectExpiredOrDeletedPage } from '@/lib/utils/htmlToMarkdown/detection';

export const dynamic = 'force-dynamic';

/**
 * POST /api/job-offers/validate-url
 * Exécute le vrai début du pipeline d'extraction (fetch HTML + Puppeteer si nécessaire
 * + conversion markdown) sans l'appel OpenAI. Détecte si le contenu est exploitable.
 */
export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    const { url } = await request.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ extractable: false, reason: 'invalid' });
    }

    // Validation format + SSRF
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return NextResponse.json({ extractable: false, reason: 'invalid' });
      }
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === 'localhost' || hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' || hostname === '[::1]' ||
        hostname.startsWith('10.') || hostname.startsWith('172.') ||
        hostname.startsWith('192.168.') || hostname.startsWith('169.254.') ||
        hostname.endsWith('.local') || hostname.endsWith('.internal')
      ) {
        return NextResponse.json({ extractable: false, reason: 'blocked' });
      }
    } catch {
      return NextResponse.json({ extractable: false, reason: 'invalid' });
    }

    // Vérifier le cache DB (offre déjà extraite pour cet utilisateur)
    const normalizedUrl = normalizeJobUrl(url);
    const cached = await prisma.jobOffer.findUnique({
      where: { userId_sourceValue: { userId: session.user.id, sourceValue: normalizedUrl } },
      select: { id: true },
    });
    if (cached) {
      return NextResponse.json({ extractable: true, cached: true });
    }

    // Exécuter le vrai pipeline : fetch HTML (simple + Puppeteer fallback) + markdown
    const html = await fetchHtmlWithFallback(normalizedUrl);

    const { content: markdown } = extractJobOfferContent(html, url);

    if (!markdown || markdown.length < 200) {
      return NextResponse.json({ extractable: false, reason: 'no_content' });
    }

    // Vérifier si la page est expirée/supprimée
    const expiredCheck = detectExpiredOrDeletedPage(markdown, html, url);
    if (expiredCheck.isExpiredPage) {
      return NextResponse.json({ extractable: false, reason: 'expired' });
    }

    return NextResponse.json({ extractable: true });

  } catch (error) {
    console.error('[validate-url] Error:', error.message);
    // Fail-open : en cas d'erreur, ne pas bloquer l'utilisateur
    return NextResponse.json({ extractable: true });
  }
}
