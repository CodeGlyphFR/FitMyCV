/**
 * POST /api/auth/extension-token
 *
 * Authenticate a user from the browser extension and return a JWT token.
 * Accepts JSON { email, password } — no reCAPTCHA required.
 * Protected by per-account brute-force lockout (5 failed attempts = 15min lockout).
 */

import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { signExtensionToken } from '@/lib/auth/extensionToken';
import { AuthErrors, ExtensionErrors, CommonErrors } from '@/lib/api/apiErrors';
import logger from '@/lib/security/secureLogger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// --- Brute-force protection (per-account) ---
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const loginAttempts = new Map();

function checkAndRecordAttempt(email, success) {
  const now = Date.now();
  const record = loginAttempts.get(email) || { count: 0, firstAttempt: now };

  // Reset si la fenêtre de lockout est expirée
  if (now - record.firstAttempt > LOCKOUT_DURATION_MS) {
    record.count = 0;
    record.firstAttempt = now;
  }

  if (success) {
    loginAttempts.delete(email);
    return { locked: false };
  }

  record.count++;
  loginAttempts.set(email, record);

  // Cleanup anciennes entrées (éviter memory leak)
  if (loginAttempts.size > 5000) {
    const cutoff = now - LOCKOUT_DURATION_MS;
    for (const [k, v] of loginAttempts.entries()) {
      if (v.firstAttempt < cutoff) loginAttempts.delete(k);
    }
  }

  return {
    locked: record.count >= MAX_FAILED_ATTEMPTS,
    remaining: Math.max(0, MAX_FAILED_ATTEMPTS - record.count),
    retryAfter: Math.ceil((record.firstAttempt + LOCKOUT_DURATION_MS - now) / 1000),
  };
}

function isAccountLocked(email) {
  const record = loginAttempts.get(email);
  if (!record) return false;
  const now = Date.now();
  if (now - record.firstAttempt > LOCKOUT_DURATION_MS) {
    loginAttempts.delete(email);
    return false;
  }
  return record.count >= MAX_FAILED_ATTEMPTS;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const email = body?.email?.toLowerCase().trim();
    const password = body?.password ?? '';

    if (!email || !password) {
      return AuthErrors.emailAndPasswordRequired();
    }

    // Vérifier le lockout avant toute opération coûteuse (bcrypt)
    if (isAccountLocked(email)) {
      logger.context('extension-auth', 'warn', `Account locked due to too many failed attempts: ${email}`);
      return ExtensionErrors.tooManyAttempts?.() ||
        Response.json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' }, { status: 429 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, passwordHash: true, emailVerified: true, role: true },
    });

    // Generic error to avoid revealing which field is wrong
    if (!user || !user.passwordHash) {
      checkAndRecordAttempt(email, false);
      logger.context('extension-auth', 'warn', `Failed login attempt (user not found or no password): ${email}`);
      return ExtensionErrors.invalidCredentials();
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const attempt = checkAndRecordAttempt(email, false);
      logger.context('extension-auth', 'warn', `Failed login attempt (wrong password): ${email}`);
      if (attempt.locked) {
        return ExtensionErrors.tooManyAttempts?.() ||
          Response.json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' }, { status: 429 });
      }
      return ExtensionErrors.invalidCredentials();
    }

    // Login réussi — reset le compteur
    checkAndRecordAttempt(email, true);

    // Verify email is confirmed
    if (!user.emailVerified) {
      return ExtensionErrors.emailNotVerified();
    }

    // Check maintenance mode
    const maintenanceSetting = await prisma.setting.findUnique({
      where: { settingName: 'maintenance_enabled' },
    });
    if (maintenanceSetting?.value === '1' && user.role !== 'ADMIN') {
      return ExtensionErrors.serviceUnavailable();
    }

    const token = await signExtensionToken(user.id, {
      name: user.name,
      email: user.email,
    });

    return Response.json({
      success: true,
      token,
      user: {
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    logger.context('extension-token', 'error', 'Error:', error);
    return CommonErrors.serverError();
  }
}
