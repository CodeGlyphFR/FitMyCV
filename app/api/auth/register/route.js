import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { stripHtml, sanitizeEmail } from "@/lib/security/xssSanitization";
import { validatePassword } from "@/lib/security/passwordPolicy";
import { createVerificationToken, sendVerificationEmail } from "@/lib/email/emailService";
import logger from "@/lib/security/secureLogger";
import { assignDefaultPlan } from "@/lib/subscription/subscriptions";
import { verifyRecaptcha } from "@/lib/recaptcha/verifyRecaptcha";
import { DEFAULT_ONBOARDING_STATE } from "@/lib/onboarding/onboardingState";
import { CommonErrors, AuthErrors } from "@/lib/api/apiErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request){
  const body = await request.json().catch(() => null);
  if (!body) return CommonErrors.invalidPayload();

  const { firstName, lastName, name, email, password, recaptchaToken } = body;

  // Vérification reCAPTCHA (optionnelle pour compatibilité, mais recommandée)
  if (recaptchaToken) {
    const recaptchaResult = await verifyRecaptcha(recaptchaToken, {
      callerName: 'register',
      scoreThreshold: 0.5,
    });

    if (!recaptchaResult.success) {
      return AuthErrors.recaptchaFailed();
    }
  }

  // Vérifier si les inscriptions sont autorisées
  const regSetting = await prisma.setting.findUnique({
    where: { settingName: 'registration_enabled' }
  });
  if (regSetting?.value === '0') {
    logger.context('auth', 'warn', `Tentative d'inscription bloquée (registration_disabled) pour ${email}`);
    return AuthErrors.registrationDisabled();
  }

  // Support both formats: new (firstName/lastName) and legacy (name)
  let fullName;
  if (firstName && lastName) {
    fullName = `${firstName.trim()} ${lastName.trim()}`;
  } else if (name) {
    fullName = name.trim();
  } else {
    return AuthErrors.nameRequired();
  }

  if (!email || !password){
    return AuthErrors.emailAndPasswordRequired();
  }

  // Sanitization XSS
  const cleanName = stripHtml(fullName);
  const normalizedEmail = sanitizeEmail(email);

  if (!normalizedEmail) {
    return AuthErrors.emailInvalid();
  }

  if (!cleanName || cleanName.length < 2) {
    return AuthErrors.nameInvalid();
  }

  // Validation des prénoms/noms séparés si fournis
  if (firstName && lastName) {
    const cleanFirstName = stripHtml(firstName.trim());
    const cleanLastName = stripHtml(lastName.trim());

    if (!cleanFirstName || cleanFirstName.length < 2) {
      return AuthErrors.firstNameInvalid();
    }

    if (!cleanLastName || cleanLastName.length < 2) {
      return AuthErrors.lastNameInvalid();
    }
  }

  // Validation de la force du mot de passe
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return AuthErrors.passwordWeak();
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing){
    // Message générique pour éviter l'énumération des utilisateurs
    return AuthErrors.accountCreateFailed();
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name: cleanName,
      email: normalizedEmail,
      passwordHash,
      emailVerified: null, // Email non vérifié à l'inscription
      onboardingState: DEFAULT_ONBOARDING_STATE, // Initialiser l'état d'onboarding complet
    },
  });

  // Attribuer le plan Gratuit par défaut
  try {
    const subscriptionResult = await assignDefaultPlan(user.id);
    if (subscriptionResult.success) {
      logger.context('register', 'info', `Plan Gratuit attribué à user ${user.id}`);
    } else {
      logger.warn('[register] Échec attribution plan Gratuit:', subscriptionResult.error);
      // Ne pas bloquer l'inscription si l'attribution du plan échoue
    }
  } catch (error) {
    logger.error('[register] Erreur attribution plan:', error);
    // Ne pas bloquer l'inscription
  }

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
