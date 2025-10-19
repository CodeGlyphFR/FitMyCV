import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { stripHtml, sanitizeEmail } from "@/lib/security/xssSanitization";
import { validatePassword } from "@/lib/security/passwordPolicy";
import { createVerificationToken, sendVerificationEmail } from "@/lib/email/emailService";
import logger from "@/lib/security/secureLogger";
import { getDefaultTokenLimit } from "@/lib/settings/settingsUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request){
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Payload invalide." }, { status: 400 });

  const { firstName, lastName, name, email, password, recaptchaToken } = body;

  // Vérification reCAPTCHA (optionnelle pour compatibilité, mais recommandée)
  if (recaptchaToken) {
    try {
      const secretKey = process.env.RECAPTCHA_SECRET_KEY;
      if (!secretKey) {
        logger.error('[register] RECAPTCHA_SECRET_KEY not configured');
        return NextResponse.json({ error: "Configuration serveur manquante" }, { status: 500 });
      }

      const verificationUrl = 'https://www.google.com/recaptcha/api/siteverify';
      const verificationData = new URLSearchParams({
        secret: secretKey,
        response: recaptchaToken,
      });

      const verificationResponse = await fetch(verificationUrl, {
        method: 'POST',
        body: verificationData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const verificationResult = await verificationResponse.json();

      if (!verificationResult.success || (verificationResult.score && verificationResult.score < 0.5)) {
        logger.warn('[register] reCAPTCHA verification failed', {
          success: verificationResult.success,
          score: verificationResult.score,
        });
        return NextResponse.json(
          { error: "Échec de la vérification anti-spam. Veuillez réessayer." },
          { status: 403 }
        );
      }
    } catch (error) {
      logger.error('[register] Error verifying reCAPTCHA:', error);
      return NextResponse.json(
        { error: "Erreur lors de la vérification anti-spam" },
        { status: 500 }
      );
    }
  }

  // Support both formats: new (firstName/lastName) and legacy (name)
  let fullName;
  if (firstName && lastName) {
    fullName = `${firstName.trim()} ${lastName.trim()}`;
  } else if (name) {
    fullName = name.trim();
  } else {
    return NextResponse.json({ error: "Prénom, nom, email et mot de passe sont requis." }, { status: 400 });
  }

  if (!email || !password){
    return NextResponse.json({ error: "Email et mot de passe sont requis." }, { status: 400 });
  }

  // Sanitization XSS
  const cleanName = stripHtml(fullName);
  const normalizedEmail = sanitizeEmail(email);

  if (!normalizedEmail) {
    return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
  }

  if (!cleanName || cleanName.length < 2) {
    return NextResponse.json({ error: "Nom invalide." }, { status: 400 });
  }

  // Validation des prénoms/noms séparés si fournis
  if (firstName && lastName) {
    const cleanFirstName = stripHtml(firstName.trim());
    const cleanLastName = stripHtml(lastName.trim());

    if (!cleanFirstName || cleanFirstName.length < 2) {
      return NextResponse.json({ error: "Prénom invalide." }, { status: 400 });
    }

    if (!cleanLastName || cleanLastName.length < 2) {
      return NextResponse.json({ error: "Nom invalide." }, { status: 400 });
    }
  }

  // Validation de la force du mot de passe
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return NextResponse.json({
      error: "Mot de passe trop faible",
      details: passwordValidation.errors
    }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing){
    // Message générique pour éviter l'énumération des utilisateurs
    return NextResponse.json({ error: "Impossible de créer le compte. Veuillez vérifier vos informations." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Récupérer le nombre de tokens par défaut depuis les settings
  const defaultTokenLimit = await getDefaultTokenLimit();

  const user = await prisma.user.create({
    data: {
      name: cleanName,
      email: normalizedEmail,
      passwordHash,
      emailVerified: null, // Email non vérifié à l'inscription
      matchScoreRefreshCount: defaultTokenLimit, // Initialiser avec le nombre de tokens par défaut
    },
  });

  // Créer un token de vérification
  try {
    const token = await createVerificationToken(user.id);

    // Envoyer l'email de vérification
    const emailResult = await sendVerificationEmail({
      email: normalizedEmail,
      name: cleanName,
      token,
    });

    if (!emailResult.success) {
      logger.warn('[register] Échec envoi email de vérification:', emailResult.error);
      // Ne pas bloquer l'inscription si l'email échoue
    } else {
      logger.context('register', 'info', `Email de vérification envoyé à ${normalizedEmail}`);
    }
  } catch (error) {
    logger.error('[register] Erreur création token:', error);
    // Ne pas bloquer l'inscription
  }

  return NextResponse.json({
    ok: true,
    userId: user.id,
    message: 'Compte créé. Vérifiez votre email pour activer votre compte.'
  });
}
