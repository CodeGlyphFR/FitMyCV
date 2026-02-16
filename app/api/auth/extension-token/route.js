/**
 * POST /api/auth/extension-token
 *
 * Authenticate a user from the browser extension and return a JWT token.
 * Accepts JSON { email, password } — no reCAPTCHA required.
 */

import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { signExtensionToken } from '@/lib/auth/extensionToken';
import { AuthErrors, ExtensionErrors, CommonErrors } from '@/lib/api/apiErrors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const body = await request.json();
    const email = body?.email?.toLowerCase().trim();
    const password = body?.password ?? '';

    if (!email || !password) {
      return AuthErrors.emailAndPasswordRequired();
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, passwordHash: true, emailVerified: true, role: true },
    });

    // Generic error to avoid revealing which field is wrong
    if (!user || !user.passwordHash) {
      console.warn(`[extension-auth] Failed login attempt: ${email} (user not found or no password)`);
      return ExtensionErrors.invalidCredentials();
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      console.warn(`[extension-auth] Failed login attempt: ${email} (wrong password)`);
      return ExtensionErrors.invalidCredentials();
    }

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
    console.error('[extension-token] Error:', error);
    return CommonErrors.serverError();
  }
}
