/**
 * POST /api/auth/extension-token
 *
 * Authenticate a user from the browser extension and return a JWT token.
 * Accepts JSON { email, password } — no reCAPTCHA required.
 */

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { signExtensionToken } from '@/lib/auth/extensionToken';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const body = await request.json();
    const email = body?.email?.toLowerCase().trim();
    const password = body?.password ?? '';

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, passwordHash: true, emailVerified: true, role: true },
    });

    // Generic error to avoid revealing which field is wrong
    if (!user || !user.passwordHash) {
      console.warn(`[extension-auth] Failed login attempt: ${email} (user not found or no password)`);
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      console.warn(`[extension-auth] Failed login attempt: ${email} (wrong password)`);
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify email is confirmed
    if (!user.emailVerified) {
      return NextResponse.json(
        { success: false, error: 'Email not verified' },
        { status: 403 }
      );
    }

    // Check maintenance mode
    const maintenanceSetting = await prisma.setting.findUnique({
      where: { settingName: 'maintenance_enabled' },
    });
    if (maintenanceSetting?.value === '1' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Service temporarily unavailable' },
        { status: 503 }
      );
    }

    const token = await signExtensionToken(user.id, {
      name: user.name,
      email: user.email,
    });

    return NextResponse.json({
      success: true,
      token,
      user: {
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('[extension-token] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
