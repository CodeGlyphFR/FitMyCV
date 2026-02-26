import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth/session";
import logger from "@/lib/security/secureLogger";
import { verifyRecaptcha } from "@/lib/recaptcha/verifyRecaptcha";
import { CommonErrors, AuthErrors } from "@/lib/api/apiErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Configuration OAuth par provider
const OAUTH_CONFIG = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    scope: "openid email profile",
    extraParams: { prompt: "select_account" },
  },
  github: {
    authUrl: "https://github.com/login/oauth/authorize",
    clientId: () => process.env.GITHUB_ID,
    scope: "read:user user:email",
    extraParams: { prompt: "select_account" },
  },
  apple: {
    authUrl: "https://appleid.apple.com/auth/authorize",
    clientId: () => process.env.APPLE_CLIENT_ID,
    scope: "name email",
    extraParams: { response_mode: "form_post" },
  },
};

/**
 * POST /api/account/link-oauth
 * Initie le flow OAuth pour lier un nouveau provider
 * Génère un state token sécurisé et retourne l'URL d'auth
 */
export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return CommonErrors.notAuthenticated();
  }

  const body = await request.json().catch(() => null);
  const provider = body?.provider?.toLowerCase();
  const recaptchaToken = body?.recaptchaToken;

  if (!provider) {
    return AuthErrors.providerRequired();
  }

  // Vérification reCAPTCHA
  const recaptchaResult = await verifyRecaptcha(recaptchaToken, {
    callerName: 'link-oauth',
    scoreThreshold: 0.5,
  });

  if (!recaptchaResult.success) {
    return AuthErrors.recaptchaFailed();
  }

  // Vérifier les providers valides
  const validProviders = ["google", "github", "apple"];
  if (!validProviders.includes(provider)) {
    return AuthErrors.providerInvalid();
  }

  // Vérifier que le provider est configuré
  const config = OAUTH_CONFIG[provider];
  const clientId = config.clientId();
  if (!clientId) {
    return AuthErrors.providerNotConfigured();
  }

  // Vérifier que l'utilisateur n'a pas déjà ce provider lié
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      accounts: {
        select: { provider: true },
      },
    },
  });

  if (!user) {
    return CommonErrors.notFound('user');
  }

  const alreadyLinked = user.accounts.some(acc => acc.provider === provider);
  if (alreadyLinked) {
    return AuthErrors.providerAlreadyLinked();
  }

  // Générer un state token sécurisé
  const nonce = crypto.randomBytes(32).toString("hex");
  const stateData = {
    linking: true,
    userId: session.user.id,
    userEmail: user.email,
    provider,
    nonce,
    exp: Date.now() + 10 * 60 * 1000, // Expire dans 10 minutes
  };

  // Encoder le state en base64 et signer avec HMAC pour empêcher la falsification
  const statePayload = Buffer.from(JSON.stringify(stateData)).toString("base64url");
  const hmac = crypto.createHmac("sha256", process.env.NEXTAUTH_SECRET).update(statePayload).digest("hex");
  const state = `${statePayload}.${hmac}`;

  // Stocker le state dans un cookie sécurisé (pour vérification au callback)
  const cookieStore = await cookies();
  cookieStore.set("oauth_link_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60, // 10 minutes
  });

  // Construire l'URL de callback
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `http://localhost:${process.env.PORT || 3001}`;
  const redirectUri = `${baseUrl}/api/auth/callback/link/${provider}`;

  // Construire l'URL OAuth
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: config.scope,
    state,
    response_type: "code",
    ...config.extraParams,
  });

  const authUrl = `${config.authUrl}?${params.toString()}`;

  logger.context('link-oauth', 'info', `Initiation liaison ${provider} pour user ${session.user.id}`);

  return NextResponse.json({ authUrl, provider });
}
