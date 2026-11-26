/**
 * Client IP for rate limiting, from a header clients cannot spoof.
 *
 * Vercel overwrites x-forwarded-for at its edge ("to prevent IP spoofing", per Vercel
 * docs), so on Vercel (VERCEL=1) its value is platform-supplied. Everywhere else every
 * IP header is client-controlled, so none is trusted and UNTRUSTED_IP is returned
 * (limits keyed on it then act per account/email instead of per IP).
 */

/** IP placeholder used when no trusted IP header is available. */
export const UNTRUSTED_IP = 'ip-unverified';

export function getTrustedClientIp(
  request: Request,
  env: Record<string, string | undefined> = process.env
): string {
  if (env.VERCEL === '1') {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (ip) return ip;
  }
  return UNTRUSTED_IP;
}
