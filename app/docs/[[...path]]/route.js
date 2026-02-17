import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

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
    const resolvedParams = await params;
    const pathSegments = resolvedParams.path || [];
    const relativePath = pathSegments.length > 0 ? pathSegments.join('/') : 'index.html';

    const docsRoot = path.join(process.cwd(), 'docs', 'html-docs-public');
    const filePath = path.join(docsRoot, relativePath);

    // Sécurité : vérifier que le chemin reste dans docs/html-docs-public
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(docsRoot)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!existsSync(normalizedPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const content = await readFile(normalizedPath);
    const ext = path.extname(normalizedPath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

    if (ext === '.html') {
      let html = content.toString('utf-8');
      const currentDir = path.dirname(relativePath);

      // Injecter <base href="/docs/"> pour que les fetch() JS résolvent correctement
      html = html.replace('<head>', '<head>\n  <base href="/docs/">');

      // Réécrire les chemins relatifs en chemins absolus sous /docs/
      html = html.replace(
        /(href|src)="(?!http|\/\/|#|javascript:|data:)([^"]+)"/g,
        (match, attr, url) => {
          if (url.startsWith('/')) return match;

          let absoluteUrl;
          if (url.startsWith('./')) {
            absoluteUrl = path.join(currentDir, url.substring(2));
          } else if (url.startsWith('../')) {
            absoluteUrl = path.normalize(path.join(currentDir, url));
          } else {
            absoluteUrl = url;
          }

          absoluteUrl = absoluteUrl.replace(/\\/g, '/');
          return `${attr}="/docs/${absoluteUrl}"`;
        }
      );

      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Error serving public docs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
