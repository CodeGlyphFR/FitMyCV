import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Mapping des extensions vers les content-types
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

export async function GET(request, { params }) {
  try {
    const session = await auth();

    // Vérifier l'authentification admin
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Récupérer le chemin demandé (params est une Promise dans Next.js 15+)
    const resolvedParams = await params;
    const pathSegments = resolvedParams.path || [];
    const relativePath = pathSegments.length > 0 ? pathSegments.join('/') : 'index.html';

    // Construire le chemin absolu vers le fichier
    const docsRoot = path.join(process.cwd(), 'docs', 'html-docs');
    const filePath = path.join(docsRoot, relativePath);

    // Sécurité : vérifier que le chemin reste dans docs/html-docs
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(docsRoot)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Vérifier que le fichier existe
    if (!existsSync(normalizedPath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Lire le fichier
    const content = await readFile(normalizedPath);

    // Déterminer le content-type
    const ext = path.extname(normalizedPath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

    // Pour les fichiers HTML, réécrire les chemins pour qu'ils soient absolus
    if (ext === '.html') {
      let html = content.toString('utf-8');
      const currentDir = path.dirname(relativePath);

      // Réécrire les chemins href et src relatifs en chemins absolus
      html = html.replace(
        /(href|src)="(?!http|\/\/|#|javascript:|data:)([^"]+)"/g,
        (match, attr, url) => {
          // Ignorer les chemins déjà absolus
          if (url.startsWith('/')) {
            return match;
          }

          // Calculer le chemin absolu depuis la racine des docs
          let absoluteUrl;
          if (url.startsWith('./')) {
            absoluteUrl = path.join(currentDir, url.substring(2));
          } else if (url.startsWith('../')) {
            absoluteUrl = path.normalize(path.join(currentDir, url));
          } else {
            // Chemin relatif simple - résoudre depuis la racine (pas le dossier courant)
            // car les fichiers HTML ont des liens relatifs à la racine
            absoluteUrl = url;
          }

          // Normaliser les séparateurs de chemin pour les URL
          absoluteUrl = absoluteUrl.replace(/\\/g, '/');

          return `${attr}="/api/admin/docs/${absoluteUrl}"`;
        }
      );

      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    // Pour les autres fichiers, renvoyer directement
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Error serving docs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
