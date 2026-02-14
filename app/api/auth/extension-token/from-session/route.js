/**
 * GET /api/auth/extension-token/from-session
 *
 * Generates an extension JWT from an existing NextAuth session.
 * Used by the OAuth flow: user logs in via the web app, then this
 * endpoint provides a token the extension can store.
 */

import { auth } from '@/lib/auth/session';
import { signExtensionToken } from '@/lib/auth/extensionToken';
import { CommonErrors } from '@/lib/api/apiErrors';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    const token = await signExtensionToken(session.user.id, {
      name: session.user.name,
      email: session.user.email,
    });

    return Response.json({
      success: true,
      token,
      user: {
        name: session.user.name || null,
        email: session.user.email || null,
      },
    });
  } catch (error) {
    console.error('[from-session] Error:', error);
    return CommonErrors.serverError();
  }
}
