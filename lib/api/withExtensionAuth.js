/**
 * Extension Auth Middleware
 *
 * Wraps API route handlers to validate extension JWT tokens.
 * Extracts userId from the Bearer token and passes it to the handler.
 */

import { NextResponse } from 'next/server';
import { verifyExtensionToken } from '@/lib/auth/extensionToken';
import prisma from '@/lib/prisma';

/**
 * Wrap a route handler with extension token authentication
 * @param {Function} handler - async (request, { userId, user }) => NextResponse
 * @returns {Function} wrapped handler
 */
export function withExtensionAuth(handler) {
  return async function authenticatedHandler(request, routeContext) {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);

    let tokenPayload;
    try {
      tokenPayload = await verifyExtensionToken(token);
    } catch (error) {
      const isExpired = error?.code === 'ERR_JWT_EXPIRED';
      console.warn(`[extension-auth] Invalid token: ${isExpired ? 'expired' : 'malformed'}`);
      return NextResponse.json(
        { success: false, error: isExpired ? 'Token expired' : 'Invalid token' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: tokenPayload.userId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) {
      console.warn(`[extension-auth] Token valid but user not found: ${tokenPayload.userId}`);
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 401 }
      );
    }

    return handler(request, { userId: user.id, user, ...routeContext });
  };
}
