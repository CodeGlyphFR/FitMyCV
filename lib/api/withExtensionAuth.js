/**
 * Extension Auth Middleware
 *
 * Wraps API route handlers to validate extension JWT tokens.
 * Extracts userId from the Bearer token and passes it to the handler.
 */

import { verifyExtensionToken } from '@/lib/auth/extensionToken';
import prisma from '@/lib/prisma';
import { AuthErrors, CommonErrors } from '@/lib/api/apiErrors';

/**
 * Wrap a route handler with extension token authentication
 * @param {Function} handler - async (request, { userId, user }) => NextResponse
 * @returns {Function} wrapped handler
 */
export function withExtensionAuth(handler) {
  return async function authenticatedHandler(request, routeContext) {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return AuthErrors.tokenRequired();
    }

    const token = authHeader.slice(7);

    let tokenPayload;
    try {
      tokenPayload = await verifyExtensionToken(token);
    } catch (error) {
      const isExpired = error?.code === 'ERR_JWT_EXPIRED';
      console.warn(`[extension-auth] Invalid token: ${isExpired ? 'expired' : 'malformed'}`);
      return isExpired ? AuthErrors.tokenExpired() : AuthErrors.tokenInvalid();
    }

    const user = await prisma.user.findUnique({
      where: { id: tokenPayload.userId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) {
      console.warn(`[extension-auth] Token valid but user not found: ${tokenPayload.userId}`);
      return CommonErrors.notAuthenticated();
    }

    return handler(request, { userId: user.id, user, ...routeContext });
  };
}
