import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Server-only. Vercel Cron calls the path with `Authorization: Bearer <CRON_SECRET>`
 * (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs). Fails closed:
 * no secret or a short one (< 16 chars) rejects every request. Constant-time compare.
 */
export function isCronAuthorized(authorization: string | null | undefined, secret: string | undefined): boolean {
  if (typeof secret !== 'string' || secret.length < 16) return false;
  if (typeof authorization !== 'string') return false;
  const digest = (s: string) => createHash('sha256').update(s, 'utf8').digest();
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`));
}
