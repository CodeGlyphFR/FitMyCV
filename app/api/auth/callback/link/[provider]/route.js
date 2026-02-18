import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth/session";
import logger from "@/lib/security/secureLogger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Configuration OAuth par provider pour l'échange de code
const OAUTH_TOKEN_CONFIG = {
  google: {
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
  },
  github: {
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoUrl: "https://api.github.com/user",
    emailsUrl: "https://api.github.com/user/emails",
    clientId: () => process.env.GITHUB_ID,
    clientSecret: () => process.env.GITHUB_SECRET,
  },
  apple: {
    tokenUrl: "https://appleid.apple.com/auth/token",
    clientId: () => process.env.APPLE_CLIENT_ID,
    clientSecret: () => process.env.APPLE_CLIENT_SECRET,
  },
};

/**
 * GET /api/auth/callback/link/[provider]
 * Callback OAuth pour lier un nouveau provider au compte existant
 */
export async function GET(request, { params }) {
  const { provider } = await params;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `http://localhost:${process.env.PORT || 3001}`;

  // Gestion des erreurs OAuth
  if (error) {
    logger.context('link-callback', 'warn', `OAuth error pour ${provider}: ${error}`);
    return NextResponse.redirect(`${baseUrl}/account?linkError=oauth_error&provider=${provider}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/account?linkError=missing_params&provider=${provider}`);
  }

  // Vérifier le state depuis le cookie
  // Next.js 16: cookies() est maintenant async
  const cookieStore = await cookies();
  const storedState = cookieStore.get("oauth_link_state")?.value;

  if (!storedState || storedState !== state) {
    logger.context('link-callback', 'warn', 'State mismatch - possible CSRF');
    return NextResponse.redirect(`${baseUrl}/account?linkError=invalid_state&provider=${provider}`);
  }

  // Décoder et valider le state
  let stateData;
  try {
    stateData = JSON.parse(Buffer.from(state, "base64url").toString());
  } catch {
    return NextResponse.redirect(`${baseUrl}/account?linkError=invalid_state&provider=${provider}`);
  }

  // Vérifier l'expiration
  if (Date.now() > stateData.exp) {
    return NextResponse.redirect(`${baseUrl}/account?linkError=expired&provider=${provider}`);
  }

  // Vérifier que le provider correspond
  if (stateData.provider !== provider) {
    return NextResponse.redirect(`${baseUrl}/account?linkError=provider_mismatch&provider=${provider}`);
  }

  // IMPORTANT: Supprimer le cookie IMMÉDIATEMENT après validation du state
  // Empêche la réutilisation du state token en cas de requêtes parallèles
  cookieStore.delete("oauth_link_state");

  // Vérifier que l'utilisateur est toujours connecté
  const session = await auth();
  if (!session?.user?.id || session.user.id !== stateData.userId) {
    return NextResponse.redirect(`${baseUrl}/account?linkError=session_expired&provider=${provider}`);
  }

  // Configuration du provider
  const config = OAUTH_TOKEN_CONFIG[provider];
  if (!config) {
    return NextResponse.redirect(`${baseUrl}/account?linkError=invalid_provider&provider=${provider}`);
  }

  const redirectUri = `${baseUrl}/api/auth/callback/link/${provider}`;

  try {
    // Échanger le code contre un access token
    const tokenResponse = await exchangeCodeForToken(provider, code, redirectUri, config);
    if (!tokenResponse.access_token) {
      throw new Error("No access token received");
    }

    // Récupérer le profil utilisateur
    const profile = await fetchUserProfile(provider, tokenResponse, config);
    if (!profile.id || !profile.email) {
      throw new Error("Could not get user profile");
    }

    // Vérifier que l'email OAuth correspond à l'email FitMyCV
    const userEmail = stateData.userEmail?.toLowerCase();
    const oauthEmail = profile.email?.toLowerCase();

    if (userEmail !== oauthEmail) {
      logger.context('link-callback', 'warn',
        `Email mismatch: FitMyCV=${userEmail}, OAuth=${oauthEmail}`);
      return NextResponse.redirect(
        `${baseUrl}/account?linkError=email_mismatch&provider=${provider}`
      );
    }

    // Vérifier que ce compte OAuth n'est pas déjà lié à un autre utilisateur
    const existingAccount = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: String(profile.id),
        },
      },
    });

    if (existingAccount) {
      if (existingAccount.userId === session.user.id) {
        // Déjà lié au même utilisateur
        return NextResponse.redirect(`${baseUrl}/account?linkSuccess=already_linked&provider=${provider}`);
      }
      // Lié à un autre utilisateur
      logger.context('link-callback', 'warn',
        `Provider ${provider} déjà lié à user ${existingAccount.userId}`);
      return NextResponse.redirect(
        `${baseUrl}/account?linkError=already_linked_other&provider=${provider}`
      );
    }

    // Créer le lien OAuth
    await prisma.account.create({
      data: {
        userId: session.user.id,
        type: "oauth",
        provider,
        providerAccountId: String(profile.id),
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token || null,
        expires_at: tokenResponse.expires_in
          ? Math.floor(Date.now() / 1000) + tokenResponse.expires_in
          : null,
        token_type: tokenResponse.token_type || null,
        scope: tokenResponse.scope || null,
        id_token: tokenResponse.id_token || null,
      },
    });

    logger.context('link-callback', 'info',
      `Provider ${provider} lié avec succès pour user ${session.user.id}`);

    return NextResponse.redirect(`${baseUrl}/account?linkSuccess=true&provider=${provider}`);

  } catch (error) {
    logger.context('link-callback', 'error', `Erreur liaison ${provider}:`, error);
    return NextResponse.redirect(`${baseUrl}/account?linkError=server_error&provider=${provider}`);
  }
}

/**
 * Échange le code OAuth contre un access token
 */
async function exchangeCodeForToken(provider, code, redirectUri, config) {
  const params = new URLSearchParams({
    client_id: config.clientId(),
    client_secret: config.clientSecret(),
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  // GitHub requiert Accept: application/json
  if (provider === "github") {
    headers["Accept"] = "application/json";
  }

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers,
    body: params,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${text}`);
  }

  return response.json();
}

/**
 * Récupère le profil utilisateur depuis le provider
 */
async function fetchUserProfile(provider, tokenResponse, config) {
  const accessToken = tokenResponse.access_token;

  if (provider === "google") {
    const response = await fetch(config.userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json();
    return { id: data.id, email: data.email, name: data.name };
  }

  if (provider === "github") {
    // GitHub peut avoir l'email privé, il faut aussi appeler /user/emails
    const userResponse = await fetch(config.userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userData = await userResponse.json();

    let email = userData.email;
    if (!email) {
      // Récupérer les emails
      const emailsResponse = await fetch(config.emailsUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const emails = await emailsResponse.json();
      const primaryEmail = emails.find(e => e.primary && e.verified);
      email = primaryEmail?.email || emails[0]?.email;
    }

    return { id: userData.id, email, name: userData.name || userData.login };
  }

  if (provider === "apple") {
    // Apple retourne les infos dans l'id_token (JWT)
    const idToken = tokenResponse.id_token;
    if (!idToken) {
      throw new Error("No id_token from Apple");
    }

    // Vérifier le JWT Apple cryptographiquement avec les clés publiques Apple
    try {
      const { createRemoteJWKSet, jwtVerify } = await import('jose');
      const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
      const { payload } = await jwtVerify(idToken, APPLE_JWKS, {
        issuer: 'https://appleid.apple.com',
        audience: process.env.APPLE_CLIENT_ID,
      });
      return { id: payload.sub, email: payload.email, name: null };
    } catch (verifyError) {
      logger.context('link-callback', 'error', 'Apple JWT verification failed:', verifyError);
      throw new Error("Apple id_token verification failed");
    }
  }

  throw new Error(`Unknown provider: ${provider}`);
}
