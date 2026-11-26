/**
 * Shared rate-limit building blocks (Upstash Redis with an in-memory fallback).
 *
 * Used by lib/adminLoginRateLimit.ts (failure counting, check-then-record) and by
 * createRateLimiter() below (consume-per-request limits for exam, AI and contact
 * endpoints).
 *
 * Backends:
 *   - Upstash Redis (durable, shared across instances) when UPSTASH_REDIS_REST_URL
 *     and UPSTASH_REDIS_REST_TOKEN are both set.
 *   - In-memory fixed window otherwise (resets on restart, per instance; NOT enough
 *     for production) and per call if Upstash errors, so an outage never locks
 *     users out. Only SHA-256 hashes of keys are sent to Upstash.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export interface LockoutStatus {
  limited: boolean;
  retryAfterSeconds: number;
}

export interface LimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/** The subset of @upstash/ratelimit's Ratelimit used here (lets tests inject a mock). */
export interface UpstashRatelimitLike {
  limit(identifier: string): Promise<{ success?: boolean; reset?: number; pending?: Promise<unknown> }>;
  getRemaining(identifier: string): Promise<{ remaining: number; reset: number }>;
  resetUsedTokens(identifier: string): Promise<void>;
}

type UpstashDuration = `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`;

// ─── In-memory fixed window ─────────────────────────────────────────────────

interface WindowEntry {
  count: number;
  resetAt: number;
}

export class MemoryFixedWindow {
  private readonly entries = new Map<string, WindowEntry>();
  // Plain fields (not TS parameter properties): Node's type stripping can't run those.
  private readonly max: number;
  private readonly windowMs: number;
  private readonly maxTrackedKeys: number;

  constructor(max: number, windowMs: number, maxTrackedKeys = 10_000) {
    this.max = max;
    this.windowMs = windowMs;
    this.maxTrackedKeys = maxTrackedKeys;
  }

  /** Whether `key` has already reached the limit (does not count a hit). */
  check(key: string): LockoutStatus {
    const now = Date.now();
    const entry = this.entries.get(key);
    if (!entry) return { limited: false, retryAfterSeconds: 0 };
    if (entry.resetAt <= now) {
      this.entries.delete(key);
      return { limited: false, retryAfterSeconds: 0 };
    }
    if (entry.count >= this.max) {
      return { limited: true, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
    }
    return { limited: false, retryAfterSeconds: 0 };
  }

  /** Counts one hit; returns the count in the current window. */
  record(key: string): number {
    const now = Date.now();
    const entry = this.entries.get(key);
    let count: number;
    if (!entry || entry.resetAt <= now) {
      this.entries.set(key, { count: 1, resetAt: now + this.windowMs });
      count = 1;
    } else {
      entry.count += 1;
      count = entry.count;
    }
    this.prune(now);
    return count;
  }

  /** Counts one hit and reports whether it was within the limit. */
  consume(key: string): LimitResult {
    const count = this.record(key);
    if (count <= this.max) return { allowed: true, retryAfterSeconds: 0 };
    const entry = this.entries.get(key);
    const retry = entry ? Math.ceil((entry.resetAt - Date.now()) / 1000) : Math.ceil(this.windowMs / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(1, retry) };
  }

  clear(key: string): void {
    this.entries.delete(key);
  }

  private prune(now: number): void {
    if (this.entries.size <= this.maxTrackedKeys) return;
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }
    while (this.entries.size > this.maxTrackedKeys) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}

// ─── Upstash helpers ────────────────────────────────────────────────────────

/** Keys can contain emails / IPs, so only a SHA-256 hex digest goes to Upstash. */
export async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Reads the Upstash env vars; never logs or returns their values beyond this call. */
export function readUpstashEnv(
  env: Record<string, string | undefined>
): { ok: true; url: string; token: string } | { ok: false; missing: string } {
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) return { ok: true, url, token };
  const missing = [!url && 'UPSTASH_REDIS_REST_URL', !token && 'UPSTASH_REDIS_REST_TOKEN'].filter(Boolean).join(', ');
  return { ok: false, missing };
}

export function createUpstashFixedWindow(
  url: string,
  token: string,
  { max, window, prefix }: { max: number; window: UpstashDuration; prefix: string }
): UpstashRatelimitLike {
  return new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.fixedWindow(max, window),
    prefix,
    ephemeralCache: false,
    analytics: false,
  });
}

/** Error detail safe to log: the error's name only (never messages, keys, URLs or tokens). */
export function safeErrorName(err: unknown): string {
  return err instanceof Error ? err.name : 'UnknownError';
}

// ─── Consume-per-request limiter ────────────────────────────────────────────

export interface RateLimiter {
  readonly name: string;
  readonly backend: 'upstash' | 'memory';
  /** Counts one request for `key`; `allowed: false` once over the limit. */
  limit(key: string): Promise<LimitResult>;
  reset(key: string): Promise<void>;
}

export interface RateLimiterOptions {
  /** Short identifier, used in log lines and the Upstash key prefix. */
  name: string;
  max: number;
  windowMs: number;
}

export interface RateLimiterDeps {
  createUpstashRatelimit?: (url: string, token: string, opts: { max: number; window: UpstashDuration; prefix: string }) => UpstashRatelimitLike;
  warn?: (message: string) => void;
  logError?: (message: string) => void;
}

let fallbackWarned = false;
const warnOnce = (message: string) => {
  if (fallbackWarned) return;
  fallbackWarned = true;
  console.warn(message);
};

function toUpstashWindow(windowMs: number): UpstashDuration {
  return windowMs % 1000 === 0 ? `${windowMs / 1000} s` : `${windowMs} ms`;
}

export function createRateLimiter(
  options: RateLimiterOptions,
  env: Record<string, string | undefined> = process.env,
  deps: RateLimiterDeps = {}
): RateLimiter {
  const memory = new MemoryFixedWindow(options.max, options.windowMs);
  const memoryLimiter: RateLimiter = {
    name: options.name,
    backend: 'memory',
    limit: async (key) => memory.consume(key),
    reset: async (key) => memory.clear(key),
  };

  const warn = deps.warn ?? warnOnce;
  const logError = deps.logError ?? ((m: string) => console.error(m));
  const cfg = readUpstashEnv(env);
  if (!cfg.ok) {
    warn(
      `[rate-limit] ${cfg.missing} not set. Using IN-MEMORY rate limiting for exam, AI and contact endpoints: ` +
        'it resets on restart and is per-instance. Configure Upstash Redis for production.'
    );
    return memoryLimiter;
  }

  let upstash: UpstashRatelimitLike;
  try {
    upstash = (deps.createUpstashRatelimit ?? createUpstashFixedWindow)(cfg.url, cfg.token, {
      max: options.max,
      window: toUpstashWindow(options.windowMs),
      prefix: `examly:rl:${options.name}`,
    });
  } catch (err) {
    warn(`[rate-limit] Could not initialise Upstash (${safeErrorName(err)}). Using IN-MEMORY rate limiting.`);
    return memoryLimiter;
  }

  return {
    name: options.name,
    backend: 'upstash',
    async limit(key) {
      try {
        const result = await upstash.limit(await hashKey(key));
        if (result.pending) await result.pending;
        if (result.success === false) {
          const reset = typeof result.reset === 'number' ? result.reset : Date.now() + options.windowMs;
          return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((reset - Date.now()) / 1000)) };
        }
        return { allowed: true, retryAfterSeconds: 0 };
      } catch (err) {
        logError(`[rate-limit:${options.name}] Upstash limit failed (${safeErrorName(err)}); using in-memory fallback.`);
        return memory.consume(key);
      }
    },
    async reset(key) {
      try {
        await upstash.resetUsedTokens(await hashKey(key));
      } catch (err) {
        logError(`[rate-limit:${options.name}] Upstash reset failed (${safeErrorName(err)}).`);
      }
      memory.clear(key);
    },
  };
}

const registry = new Map<string, RateLimiter>();

/** Process-wide limiter per name (created once, so the fallback warning is logged once). */
export function getRateLimiter(options: RateLimiterOptions): RateLimiter {
  let limiter = registry.get(options.name);
  if (!limiter) {
    limiter = createRateLimiter(options);
    registry.set(options.name, limiter);
  }
  return limiter;
}

/** Standard 429 body + Retry-After header values. */
export function tooManyRequests(retryAfterSeconds: number, message = 'Too many requests. Please try again later.') {
  return {
    body: { error: message },
    init: { status: 429, headers: { 'Retry-After': String(Math.max(1, retryAfterSeconds)), 'Cache-Control': 'no-store' } },
  };
}
