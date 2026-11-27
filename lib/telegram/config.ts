/**
 * Telegram bot configuration. Pure (no Next/Supabase imports) so it is unit-testable.
 *
 * Everything is OFF unless TELEGRAM_BOT_ENABLED is exactly "true": the webhook and the
 * dashboard API answer 404, and the dashboard hides the "Connect Telegram" card.
 * Secrets (TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET) are read here and never logged.
 */

type Env = Record<string, string | undefined>;

export function isTelegramBotEnabled(env: Env = process.env): boolean {
  return env.TELEGRAM_BOT_ENABLED?.trim() === 'true';
}

/** Telegram allows 1-256 chars of A-Z a-z 0-9 _ - for secret_token; we also require >= 16. */
export const WEBHOOK_SECRET_RE = /^[A-Za-z0-9_-]{16,256}$/;

export interface TelegramLimits {
  maxPdfBytes: number;
  maxPdfPages: number;
  maxPdfsPerDay: number;
  /** Updates per chat per minute before the bot silently drops them. */
  maxUpdatesPerMinute: number;
}

export const DEFAULT_LIMITS: TelegramLimits = {
  maxPdfBytes: 10 * 1024 * 1024,
  maxPdfPages: 30,
  maxPdfsPerDay: 5,
  maxUpdatesPerMinute: 30,
};

function intFromEnv(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(value?.trim());
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

/** Limits, with optional overrides: TELEGRAM_MAX_PDFS_PER_DAY (1-100), TELEGRAM_MAX_PDF_PAGES (1-100). */
export function telegramLimits(env: Env = process.env): TelegramLimits {
  return {
    ...DEFAULT_LIMITS,
    maxPdfsPerDay: intFromEnv(env.TELEGRAM_MAX_PDFS_PER_DAY, DEFAULT_LIMITS.maxPdfsPerDay, 1, 100),
    maxPdfPages: intFromEnv(env.TELEGRAM_MAX_PDF_PAGES, DEFAULT_LIMITS.maxPdfPages, 1, 100),
  };
}

/** Public site origin used in links sent to the teacher (no trailing slash). */
export function appBaseUrl(env: Env = process.env): string {
  const raw = env.NEXT_PUBLIC_APP_URL?.trim() || 'https://examly.site';
  return raw.replace(/\/+$/, '');
}

/** Optional public bot username (without @) for the t.me deep link in the dashboard. */
export function botUsername(env: Env = process.env): string | null {
  const u = env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '');
  return u && /^[A-Za-z0-9_]{5,32}$/.test(u) ? u : null;
}

export const LINK_CODE_TTL_MS = 10 * 60 * 1000;
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
/** A "processing" session older than this is treated as failed (the background job died). */
export const PROCESSING_STALE_MS = 10 * 60 * 1000;
