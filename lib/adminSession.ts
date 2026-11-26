/**
 * Signed admin session tokens (HMAC-SHA256 via the Web Crypto API).
 *
 * Works in both the Edge runtime (middleware.ts) and Node.js route handlers,
 * so it must not import Node-only modules (Buffer, node:crypto) or next/headers.
 *
 * Token format: base64url(JSON payload) + "." + base64url(HMAC-SHA256(payloadPart))
 *
 * Fails closed: if ADMIN_SESSION_SECRET is missing or shorter than 32 characters,
 * no token can be created and every token is rejected.
 */

export const ADMIN_SESSION_COOKIE = 'examly_admin_session';
export const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours

const MIN_SECRET_LENGTH = 32;
const MAX_TOKEN_LENGTH = 4096;
const CLOCK_SKEW_SECONDS = 60;

export interface AdminSessionPayload {
  uid: string;
  email: string;
  role: 'admin';
  iat: number;
  exp: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) return null;
  return secret;
}

export function isAdminSessionConfigured(): boolean {
  return getSecret() !== null;
}

let cachedKey: { secret: string; key: Promise<CryptoKey> } | null = null;

function getHmacKey(secret: string): Promise<CryptoKey> {
  if (!cachedKey || cachedKey.secret !== secret) {
    cachedKey = {
      secret,
      key: crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      ),
    };
  }
  return cachedKey.key;
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await getHmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return new Uint8Array(signature);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Decodes base64url only if `value` is the canonical (unpadded) encoding of its bytes.
 * The final character of a base64url string can carry unused low bits, so several
 * spellings decode to the same bytes; re-encoding and requiring an exact match rejects
 * every spelling except the one we would have produced ourselves.
 */
function decodeCanonicalBase64Url(value: string): Uint8Array | null {
  const bytes = base64UrlToBytes(value);
  if (!bytes) return null;
  return bytesToBase64Url(bytes) === value ? bytes : null;
}

/** Constant-time comparison: always inspects every byte of equal-length inputs. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Creates a signed admin session token valid for 8 hours.
 * Throws if ADMIN_SESSION_SECRET is not configured (fail closed).
 */
export async function createAdminSession({ uid, email }: { uid: string; email: string }): Promise<string> {
  const secret = getSecret();
  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET is missing or shorter than 32 characters.');
  }
  if (!uid || !email) {
    throw new Error('Admin session requires uid and email.');
  }

  const iat = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    uid,
    email,
    role: 'admin',
    iat,
    exp: iat + ADMIN_SESSION_TTL_SECONDS,
  };

  const payloadPart = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const signaturePart = bytesToBase64Url(await hmacSha256(secret, payloadPart));
  return `${payloadPart}.${signaturePart}`;
}

/**
 * Verifies a signed admin session token.
 * Returns the payload only if the signature is valid, the token is unexpired,
 * and the payload is well-formed with role "admin". Otherwise returns null.
 */
export async function verifyAdminSession(token: string | null | undefined): Promise<AdminSessionPayload | null> {
  const secret = getSecret();
  if (!secret) return null;
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadPart, signaturePart] = parts;

  // Canonical encoding only: a second spelling of the same bytes is rejected.
  const providedSignature = decodeCanonicalBase64Url(signaturePart);
  if (!providedSignature) return null;

  try {
    const expectedSignature = await hmacSha256(secret, payloadPart);
    if (!timingSafeEqual(providedSignature, expectedSignature)) return null;

    const payloadBytes = decodeCanonicalBase64Url(payloadPart);
    if (!payloadBytes) return null;

    const payload = JSON.parse(decoder.decode(payloadBytes)) as Partial<AdminSessionPayload> | null;
    if (
      !payload ||
      payload.role !== 'admin' ||
      typeof payload.uid !== 'string' ||
      !payload.uid ||
      typeof payload.email !== 'string' ||
      !payload.email ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) return null;
    if (payload.iat > now + CLOCK_SKEW_SECONDS) return null;
    if (payload.exp - payload.iat > ADMIN_SESSION_TTL_SECONDS) return null;

    return {
      uid: payload.uid,
      email: payload.email,
      role: 'admin',
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

/** Cookie attributes shared by login (set) and logout (clear). */
export function adminSessionCookieOptions(maxAge: number = ADMIN_SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
  };
}
