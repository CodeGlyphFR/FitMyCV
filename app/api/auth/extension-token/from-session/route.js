/**
 * GET /api/auth/extension-token/from-session
 *
 * Generates an extension JWT from an existing NextAuth session.
 * Used by the OAuth flow: user logs in via the web app, then this
 * endpoint provides a token the extension can store.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { signExtensionToken } from '@/lib/auth/extensionToken';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const token = await signExtensionToken(session.user.id, {
      name: session.user.name,
      email: session.user.email,
    });

    return NextResponse.json({
      success: true,
      token,
      user: {
        name: session.user.name || null,
        email: session.user.email || null,
      },
    });
  } catch (error) {
    console.error('[from-session] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
