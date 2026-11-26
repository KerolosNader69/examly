/**
 * Brute-force protection for POST /api/admin/auth/login.
 *
 * Policy: after MAX_FAILURES failed attempts for the same IP + email within a 15-minute
 * window, further attempts get HTTP 429 (with Retry-After) until the window expires.
 * A successful login clears the count.
 *
 * Backends:
 *   - Upstash Redis (durable, shared across instances): used when UPSTASH_REDIS_REST_URL
 *     and UPSTASH_REDIS_REST_TOKEN are both set.
 *   - In-memory fallback: used when they are missing (one warning is logged). It resets
 *     on restart and is per-instance, so it is NOT sufficient for production. It is also
 *     used per-call if Upstash errors, so an Upstash outage doesn't lock admins out.
 *
 * Client IP: only trusted on Vercel, whose edge overwrites x-forwarded-for so clients
 * can't spoof it. Anywhere else no header is trusted and the limit applies per email.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILURES = 5;
const MAX_TRACKED_KEYS = 10_000; // memory cap for the in-memory backend
const UPSTASH_PREFIX = 'examly:admin-login-failures';

/** IP placeholder used when no trusted IP header is available (limit becomes per email). */
export const UNTRUSTED_IP = 'ip-unverified';

export interface LockoutStatus {
  limited: boolean;
  retryAfterSeconds: number;
}

export interface LoginRateLimiter {
  readonly backend: 'upstash' | 'memory';
  check(key: string): Promise<LockoutStatus>;
  recordFailure(key: string): Promise<void>;
  clear(key: string): Promise<void>;
}

// ─── Client IP ──────────────────────────────────────────────────────────────

/**
 * Returns a client IP only from a header the hosting platform sets and clients can't spoof.
 * Vercel overwrites x-forwarded-for at its edge ("to prevent IP spoofing", per Vercel docs),
 * so on Vercel (VERCEL=1) its value is platform-supplied, not client-supplied.
 * Everywhere else every IP header is client-controlled, so none is trusted.
 */
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

export function loginRateLimitKey(ip: string, email: string): string {
  return `${ip}|${email.trim().toLowerCase()}`;
}

// ─── In-memory backend (fallback) ───────────────────────────────────────────

interface FailureEntry {
  count: number;
  resetAt: number;
}

const failures = new Map<string, FailureEntry>();

function prune(now: number): void {
  if (failures.size <= MAX_TRACKED_KEYS) return;
  for (const [key, entry] of failures) {
    if (entry.resetAt <= now) failures.delete(key);
  }
  // Still over the cap: drop the oldest entries (Map keeps insertion order)
  while (failures.size > MAX_TRACKED_KEYS) {
    const oldest = failures.keys().next().value;
    if (oldest === undefined) break;
    failures.delete(oldest);
  }
}

/** In-memory: returns whether this key is currently locked out and for how long. */
export function checkLoginRateLimit(key: string): LockoutStatus {
  const now = Date.now();
  const entry = failures.get(key);
  if (!entry) return { limited: false, retryAfterSeconds: 0 };
  if (entry.resetAt <= now) {
    failures.delete(key);
    return { limited: false, retryAfterSeconds: 0 };
  }
  if (entry.count >= MAX_FAILURES) {
    return { limited: true, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { limited: false, retryAfterSeconds: 0 };
}

/** In-memory: counts one failed attempt. */
export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const entry = failures.get(key);
  if (!entry || entry.resetAt <= now) {
    failures.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
  prune(now);
}

/** In-memory: clears the count (after a successful login). */
export function clearLoginFailures(key: string): void {
  failures.delete(key);
}

export const memoryLoginRateLimiter: LoginRateLimiter = {
  backend: 'memory',
  check: async (key) => checkLoginRateLimit(key),
  recordFailure: async (key) => recordLoginFailure(key),
  clear: async (key) => clearLoginFailures(key),
};

// ─── Upstash backend ────────────────────────────────────────────────────────

/** The subset of @upstash/ratelimit's Ratelimit used here (lets tests inject a mock). */
export interface UpstashRatelimitLike {
  limit(identifier: string): Promise<{ pending?: Promise<unknown> }>;
  getRemaining(identifier: string): Promise<{ remaining: number; reset: number }>;
  resetUsedTokens(identifier: string): Promise<void>;
}

/** Keys contain an email (and IP), so only a SHA-256 hash is stored in Upstash. */
async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function createUpstashLoginRateLimiter(
  ratelimit: UpstashRatelimitLike,
  fallback: LoginRateLimiter = memoryLoginRateLimiter,
  logError: (message: string) => void = (m) => console.error(m)
): LoginRateLimiter {
  const onError = (operation: string, err: unknown) => {
    // Log only the error type/message, never keys, URLs or tokens
    const detail = err instanceof Error ? err.name : 'UnknownError';
    logError(`[admin-login-rate-limit] Upstash ${operation} failed (${detail}); using in-memory fallback for this request.`);
  };

  return {
    backend: 'upstash',
    async check(key) {
      try {
        const { remaining, reset } = await ratelimit.getRemaining(await hashKey(key));
        if (remaining <= 0) {
          return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil((reset - Date.now()) / 1000)) };
        }
        return { limited: false, retryAfterSeconds: 0 };
      } catch (err) {
        onError('check', err);
        return fallback.check(key);
      }
    },
    async recordFailure(key) {
      try {
        const result = await ratelimit.limit(await hashKey(key));
        if (result.pending) await result.pending;
      } catch (err) {
        onError('recordFailure', err);
        await fallback.recordFailure(key);
      }
    },
    async clear(key) {
      try {
        await ratelimit.resetUsedTokens(await hashKey(key));
      } catch (err) {
        onError('clear', err);
      }
      await fallback.clear(key);
    },
  };
}

function createDefaultUpstashRatelimit(url: string, token: string): UpstashRatelimitLike {
  return new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.fixedWindow(MAX_FAILURES, '15 m'),
    prefix: UPSTASH_PREFIX,
    ephemeralCache: false,
    analytics: false,
  });
}

// ─── Backend selection ──────────────────────────────────────────────────────

export interface ResolveLimiterDeps {
  createUpstashRatelimit?: (url: string, token: string) => UpstashRatelimitLike;
  warn?: (message: string) => void;
  logError?: (message: string) => void;
}

/** Picks the Upstash backend when both env vars are set, else the in-memory fallback. */
export function resolveLoginRateLimiter(
  env: Record<string, string | undefined>,
  deps: ResolveLimiterDeps = {}
): LoginRateLimiter {
  const warn = deps.warn ?? ((m: string) => console.warn(m));
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    const missing = [!url && 'UPSTASH_REDIS_REST_URL', !token && 'UPSTASH_REDIS_REST_TOKEN'].filter(Boolean).join(', ');
    warn(
      `[admin-login-rate-limit] ${missing} not set. Using the IN-MEMORY login rate limiter: ` +
        'it resets on restart and is per-instance. Configure Upstash Redis for production.'
    );
    return memoryLoginRateLimiter;
  }

  try {
    const ratelimit = (deps.createUpstashRatelimit ?? createDefaultUpstashRatelimit)(url, token);
    return createUpstashLoginRateLimiter(ratelimit, memoryLoginRateLimiter, deps.logError);
  } catch (err) {
    const detail = err instanceof Error ? err.name : 'UnknownError';
    warn(
      `[admin-login-rate-limit] Could not initialise Upstash (${detail}). Using the IN-MEMORY login rate limiter: ` +
        'it resets on restart and is per-instance.'
    );
    return memoryLoginRateLimiter;
  }
}

let cachedLimiter: LoginRateLimiter | null = null;

/** Process-wide limiter, resolved once (so the fallback warning is logged once). */
export function getLoginRateLimiter(): LoginRateLimiter {
  if (!cachedLimiter) cachedLimiter = resolveLoginRateLimiter(process.env);
  return cachedLimiter;
}
