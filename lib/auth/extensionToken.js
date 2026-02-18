/**
 * Extension JWT Token Management
 *
 * Sign and verify JWT tokens for the browser extension.
 * Uses the same NEXTAUTH_SECRET as the web app for key management.
 */

import { SignJWT, jwtVerify } from 'jose';

const EXTENSION_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days (aligned with web session)

function getSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not set');
  }
  return new TextEncoder().encode(secret);
}

/**
 * Sign a JWT token for extension authentication
 * @param {string} userId
 * @param {{ name?: string, email?: string, tokenVersion?: number }} userInfo
 * @returns {Promise<string>} signed JWT
 */
export async function signExtensionToken(userId, userInfo = {}) {
  const token = await new SignJWT({
    sub: userId,
    type: 'extension',
    name: userInfo.name || null,
    email: userInfo.email || null,
    tv: userInfo.tokenVersion ?? 0,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${EXTENSION_TOKEN_MAX_AGE}s`)
    .sign(getSecret());

  return token;
}

/**
 * Verify an extension JWT token
 * @param {string} token
 * @returns {Promise<{ userId: string, name: string|null, email: string|null }>}
 * @throws {Error} if token is invalid or expired
 */
export async function verifyExtensionToken(token) {
  const { payload } = await jwtVerify(token, getSecret());

  if (payload.type !== 'extension') {
    throw new Error('Invalid token type');
  }

  return {
    userId: payload.sub,
    name: payload.name || null,
    email: payload.email || null,
    tokenVersion: payload.tv ?? 0,
  };
}
