import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Rate limiting store (in-memory, consider Redis for production)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = {
  '/api/auth/register': 5,
  '/api/auth/signin': 10,
  '/api/admin/users': 60, // Limite plus haute pour l'admin des utilisateurs
  '/api/admin': 40, // Augmenté pour les autres routes admin
  '/api/background-tasks/sync': 120, // Polling fréquent + événements temps réel
  '/api/background-tasks': 30, // Autres endpoints de création de tâches
  '/api/feedback': 10,
  '/api/cv': 60,
  default: 100,
};

function getRateLimitKey(ip, pathname) {
  return `${ip}:${pathname}`;
}

function checkRateLimit(ip, pathname) {
  // Déterminer la limite pour ce path
  let maxRequests = RATE_LIMIT_MAX_REQUESTS.default;
  for (const [path, limit] of Object.entries(RATE_LIMIT_MAX_REQUESTS)) {
    if (path !== 'default' && pathname.startsWith(path)) {
      maxRequests = limit;
      break;
    }
  }

  const key = getRateLimitKey(ip, pathname);
  const now = Date.now();
  const record = rateLimitStore.get(key) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };

  // Reset si la fenêtre est expirée
  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + RATE_LIMIT_WINDOW;
  }

  record.count++;
  rateLimitStore.set(key, record);

  // Cleanup old entries (éviter memory leak)
  if (rateLimitStore.size > 10000) {
    const cutoff = now - RATE_LIMIT_WINDOW;
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetTime < cutoff) {
        rateLimitStore.delete(k);
      }
    }
  }

  return {
    allowed: record.count <= maxRequests,
    remaining: Math.max(0, maxRequests - record.count),
    resetTime: record.resetTime,
  };
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // ⚡ CRITICAL: Bypass ALL proxy logic for WebSocket HMR
  // WebSocket upgrade requests cannot handle redirects or extra headers
  if (pathname.startsWith('/_next/webpack-hmr')) {
    return NextResponse.next();
  }

  // Obtenir l'IP du client (compatible avec proxies)
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    request.ip ||
    '127.0.0.1';

  // Routes exemptées de la vérification email
  const publicPaths = [
    '/auth',
    '/api/auth',
    '/_next',
    '/favicon.ico',
  ];

  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  const isApiRoute = pathname.startsWith('/api/');

  // Vérification email pour les utilisateurs connectés (sauf routes publiques et API)
  if (!isPublicPath && !isApiRoute) {
    try {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
      });

      if (token?.id && !token?.emailVerified) {
        // Rediriger vers la page de vérification email
        // Le paramètre ?new=true est géré par AuthScreen lors de l'inscription
        const url = request.nextUrl.clone();
        url.pathname = '/auth/verify-email-required';
        return NextResponse.redirect(url);
      }
    } catch (error) {
      console.error('[middleware] Erreur vérification email:', error);
      // Ne pas bloquer en cas d'erreur
    }
  }

  // Rate limiting pour les routes API
  if (pathname.startsWith('/api/')) {
    const rateLimit = checkRateLimit(ip, pathname);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Trop de requêtes. Veuillez réessayer plus tard.',
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS.default),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': String(rateLimit.resetTime),
          },
        }
      );
    }
  }

  const response = NextResponse.next();

  // Construction du connect-src CSP selon l'environnement
  const connectSrcSources = ["'self'"];

  if (process.env.NODE_ENV === 'development') {
    // WebSocket pour HMR en développement
    const customDevDomain = process.env.NEXT_PUBLIC_DEV_WS_DOMAIN;
    if (customDevDomain) {
      connectSrcSources.push(customDevDomain);
    }
    connectSrcSources.push('ws://localhost:3001', 'wss://localhost:3001');
  }

  // Sources communes (API externes)
  connectSrcSources.push(
    'https://api.openai.com',
    'https://www.google.com',
    'https://www.gstatic.com'
  );

  // Headers de sécurité pour toutes les réponses
  const securityHeaders = {
    // Protection contre le clickjacking
    'X-Frame-Options': 'DENY',

    // Empêche le navigateur de détecter le MIME type
    'X-Content-Type-Options': 'nosniff',

    // Active la protection XSS du navigateur
    'X-XSS-Protection': '1; mode=block',

    // Politique de referrer stricte
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Isolation cross-origin (protection contre les attaques Spectre/side-channel)
    'Cross-Origin-Opener-Policy': 'same-origin',

    // Permissions Policy (anciennement Feature-Policy)
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',

    // Content Security Policy
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.google.com https://www.gstatic.com https://editor.unlayer.com", // Next.js + reCAPTCHA + Unlayer
      "style-src 'self' 'unsafe-inline'", // Tailwind nécessite unsafe-inline
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      `connect-src ${connectSrcSources.join(' ')} https://editor.unlayer.com https://api.unlayer.com`,
      "frame-src https://www.google.com https://editor.unlayer.com", // reCAPTCHA + Unlayer frames
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  };

  // Ajouter HSTS en production uniquement
  if (process.env.NODE_ENV === 'production') {
    securityHeaders['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload';
  }

  // Appliquer les headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Ajouter les headers de rate limiting
  if (pathname.startsWith('/api/')) {
    const rateLimit = checkRateLimit(ip, pathname);
    response.headers.set('X-RateLimit-Remaining', String(rateLimit.remaining));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - _next/webpack-hmr (WebSocket HMR)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
