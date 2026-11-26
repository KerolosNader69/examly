/**
 * Brute-force protection for POST /api/admin/auth/login.
 *
 * Policy: after MAX_FAILURES failed attempts for the same IP + email within a 15-minute
 * window, further attempts get HTTP 429 (with Retry-After) until the window expires.
 * A successful login clears the count.
 *
 * Backends (shared building blocks in lib/rateLimit.ts):
 *   - Upstash Redis (durable, shared across instances): used when UPSTASH_REDIS_REST_URL
 *     and UPSTASH_REDIS_REST_TOKEN are both set.
 *   - In-memory fallback: used when they are missing (one warning is logged). It resets
 *     on restart and is per-instance, so it is NOT sufficient for production. It is also
 *     used per-call if Upstash errors, so an Upstash outage doesn't lock admins out.
 *
 * Client IP: only trusted on Vercel, whose edge overwrites x-forwarded-for so clients
 * can't spoof it. Anywhere else no header is trusted and the limit applies per email.
 */

import {
  MemoryFixedWindow,
  createUpstashFixedWindow,
  hashKey,
  readUpstashEnv,
  safeErrorName,
  type LockoutStatus,
  type UpstashRatelimitLike,
} from './rateLimit.ts';
import { UNTRUSTED_IP, getTrustedClientIp } from './clientIp.ts';

export type { LockoutStatus, UpstashRatelimitLike };
export { UNTRUSTED_IP, getTrustedClientIp };

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILURES = 5;
const UPSTASH_PREFIX = 'examly:admin-login-failures';

export interface LoginRateLimiter {
  readonly backend: 'upstash' | 'memory';
  check(key: string): Promise<LockoutStatus>;
  recordFailure(key: string): Promise<void>;
  clear(key: string): Promise<void>;
}

export function loginRateLimitKey(ip: string, email: string): string {
  return `${ip}|${email.trim().toLowerCase()}`;
}

// ─── In-memory backend (fallback) ───────────────────────────────────────────

const failures = new MemoryFixedWindow(MAX_FAILURES, WINDOW_MS);

/** In-memory: returns whether this key is currently locked out and for how long. */
export function checkLoginRateLimit(key: string): LockoutStatus {
  return failures.check(key);
}

/** In-memory: counts one failed attempt. */
export function recordLoginFailure(key: string): void {
  failures.record(key);
}

/** In-memory: clears the count (after a successful login). */
export function clearLoginFailures(key: string): void {
  failures.clear(key);
}

export const memoryLoginRateLimiter: LoginRateLimiter = {
  backend: 'memory',
  check: async (key) => checkLoginRateLimit(key),
  recordFailure: async (key) => recordLoginFailure(key),
  clear: async (key) => clearLoginFailures(key),
};

// ─── Upstash backend ────────────────────────────────────────────────────────

export function createUpstashLoginRateLimiter(
  ratelimit: UpstashRatelimitLike,
  fallback: LoginRateLimiter = memoryLoginRateLimiter,
  logError: (message: string) => void = (m) => console.error(m)
): LoginRateLimiter {
  const onError = (operation: string, err: unknown) => {
    // Log only the error type, never keys, URLs or tokens
    logError(`[admin-login-rate-limit] Upstash ${operation} failed (${safeErrorName(err)}); using in-memory fallback for this request.`);
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
  const cfg = readUpstashEnv(env);

  if (!cfg.ok) {
    warn(
      `[admin-login-rate-limit] ${cfg.missing} not set. Using the IN-MEMORY login rate limiter: ` +
        'it resets on restart and is per-instance. Configure Upstash Redis for production.'
    );
    return memoryLoginRateLimiter;
  }

  try {
    const ratelimit = deps.createUpstashRatelimit
      ? deps.createUpstashRatelimit(cfg.url, cfg.token)
      : createUpstashFixedWindow(cfg.url, cfg.token, { max: MAX_FAILURES, window: '15 m', prefix: UPSTASH_PREFIX });
    return createUpstashLoginRateLimiter(ratelimit, memoryLoginRateLimiter, deps.logError);
  } catch (err) {
    warn(
      `[admin-login-rate-limit] Could not initialise Upstash (${safeErrorName(err)}). Using the IN-MEMORY login rate limiter: ` +
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
