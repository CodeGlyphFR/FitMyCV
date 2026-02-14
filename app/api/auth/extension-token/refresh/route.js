/**
 * POST /api/auth/extension-token/refresh
 *
 * Renew an extension JWT token. The current token must still be valid.
 * Returns a fresh 7-day token with the same user context.
 */

import { verifyExtensionToken, signExtensionToken } from '@/lib/auth/extensionToken';
import prisma from '@/lib/prisma';
import { AuthErrors, CommonErrors, ExtensionErrors } from '@/lib/api/apiErrors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
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
    console.warn(`[extension-token/refresh] Invalid token: ${isExpired ? 'expired' : 'malformed'}`);
    return isExpired ? AuthErrors.tokenExpired() : AuthErrors.tokenInvalid();
  }

  const user = await prisma.user.findUnique({
    where: { id: tokenPayload.userId },
    select: { id: true, name: true, email: true, emailVerified: true, role: true },
  });

  if (!user) {
    return CommonErrors.notAuthenticated();
  }

  // Check maintenance mode
  const maintenanceSetting = await prisma.setting.findUnique({
    where: { settingName: 'maintenance_enabled' },
  });
  if (maintenanceSetting?.value === '1' && user.role !== 'ADMIN') {
    return ExtensionErrors.serviceUnavailable();
  }

  const newToken = await signExtensionToken(user.id, {
    name: user.name,
    email: user.email,
  });

  return Response.json({
    success: true,
    token: newToken,
    user: {
      name: user.name,
      email: user.email,
    },
  });
}
