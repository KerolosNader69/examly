/**
 * Webhook secret check and one-time link codes. Pure, server-only.
 */
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { WEBHOOK_SECRET_RE } from './config.ts';

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest();

/**
 * Constant-time compare of the X-Telegram-Bot-Api-Secret-Token header with
 * TELEGRAM_WEBHOOK_SECRET. Fails closed when the secret is missing or malformed.
 */
export function isValidWebhookSecret(header: string | null | undefined, secret: string | undefined): boolean {
  if (typeof secret !== 'string' || !WEBHOOK_SECRET_RE.test(secret)) return false;
  if (typeof header !== 'string' || header.length === 0) return false;
  return timingSafeEqual(sha256(header), sha256(secret));
}

/** No 0/O/1/I/L: easy to read off a screen and type on a phone. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LINK_CODE_LENGTH = 8;

export function generateLinkCode(): string {
  let out = '';
  for (let i = 0; i < LINK_CODE_LENGTH; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

/** Uppercases and drops spaces/dashes; null if it cannot be a code. */
export function normalizeLinkCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const c = raw.trim().toUpperCase().replace(/[\s-]/g, '');
  if (c.length !== LINK_CODE_LENGTH) return null;
  for (const ch of c) if (!CODE_ALPHABET.includes(ch)) return null;
  return c;
}

/** Only this hash is stored in telegram_link_codes. */
export function hashLinkCode(code: string): string {
  return sha256(`examly-telegram-link:${code}`).toString('hex');
}
