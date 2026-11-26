/**
 * Unit tests for lib/adminLoginRateLimit.ts (admin login brute-force protection).
 * Run with: npm run test:unit   (Node's built-in test runner + native TypeScript stripping)
 *
 * No network: Upstash is always replaced by an in-process mock. Time is frozen with a
 * fixed clock wherever the 15-minute window matters, so results are deterministic.
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type * as RateLimitModule from '../../lib/adminLoginRateLimit';

// Runtime import with an explicit .ts path (required by Node's type stripping); the
// type-only import above keeps full typing for `next build`'s TypeScript check.
const rl: typeof RateLimitModule = await import(new URL('../../lib/adminLoginRateLimit.ts', import.meta.url).href);

// Make sure no real Upstash config can leak in from the environment.
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const WINDOW_MS = 15 * 60 * 1000;
const FIXED_NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
const realNow = Date.now;
let clock = FIXED_NOW;

beforeEach(() => {
  clock = FIXED_NOW;
  Date.now = () => clock;
});
afterEach(() => {
  Date.now = realNow;
});

/** Each test uses its own keys so the shared in-memory map never couples tests. */
const key = (ip: string, email: string) => rl.loginRateLimitKey(ip, email);
const fail = (k: string, times: number) => {
  for (let i = 0; i < times; i++) rl.recordLoginFailure(k);
};

// ── In-memory policy (original 7) ──────────────────────────────────

test('key normalizes email', () => {
  assert.equal(rl.loginRateLimitKey('1.2.3.4', ' Admin@X.com '), '1.2.3.4|admin@x.com');
});

test('4 failures: not limited', () => {
  const k = key('10.0.0.1', 'four@x.com');
  fail(k, 4);
  assert.equal(rl.checkLoginRateLimit(k).limited, false);
});

test('5 failures: limited, retry 900s', () => {
  const k = key('10.0.0.2', 'five@x.com');
  fail(k, 5);
  const s = rl.checkLoginRateLimit(k);
  assert.equal(s.limited, true);
  assert.equal(s.retryAfterSeconds, 900);
});

test('other email same IP unaffected', () => {
  fail(key('10.0.0.3', 'locked@x.com'), 5);
  assert.equal(rl.checkLoginRateLimit(key('10.0.0.3', 'b@x.com')).limited, false);
});

test('other IP same email unaffected', () => {
  fail(key('10.0.0.4', 'shared@x.com'), 5);
  assert.equal(rl.checkLoginRateLimit(key('10.0.0.5', 'shared@x.com')).limited, false);
});

test('cleared after success', () => {
  const k = key('10.0.0.6', 'clear@x.com');
  fail(k, 5);
  rl.clearLoginFailures(k);
  assert.equal(rl.checkLoginRateLimit(k).limited, false);
});

test('window expiry unlocks', () => {
  const k = key('10.0.0.7', 'expiry@x.com');
  fail(k, 5);
  assert.equal(rl.checkLoginRateLimit(k).limited, true);
  clock = FIXED_NOW + WINDOW_MS + 1;
  assert.equal(rl.checkLoginRateLimit(k).limited, false);
});

// ── Trusted client IP (4) ──────────────────────────────────────────

const req = (h: Record<string, string>) => new Request('http://x', { headers: h });

test('ip: Vercel -> platform x-forwarded-for', () => {
  assert.equal(rl.getTrustedClientIp(req({ 'x-forwarded-for': '9.9.9.9' }), { VERCEL: '1' }), '9.9.9.9');
});

test('ip: off Vercel, client XFF ignored', () => {
  assert.equal(rl.getTrustedClientIp(req({ 'x-forwarded-for': '9.9.9.9', 'x-real-ip': '8.8.8.8' }), {}), rl.UNTRUSTED_IP);
});

test('ip: Vercel without header -> untrusted', () => {
  assert.equal(rl.getTrustedClientIp(req({}), { VERCEL: '1' }), rl.UNTRUSTED_IP);
});

test('ip: x-vercel-forwarded-for / x-real-ip not trusted alone', () => {
  assert.equal(rl.getTrustedClientIp(req({ 'x-vercel-forwarded-for': '7.7.7.7', 'x-real-ip': '6.6.6.6' }), { VERCEL: '1' }), rl.UNTRUSTED_IP);
});

// ── Upstash mock (no network) ──────────────────────────────────────

type MockUpstash = RateLimitModule.UpstashRatelimitLike & { ids: string[]; store: Map<string, { used: number; reset: number }> };

function makeMock(failWith?: Error): MockUpstash {
  const store = new Map<string, { used: number; reset: number }>();
  const ids: string[] = [];
  const windowEnd = () => Date.now() + WINDOW_MS;
  return {
    ids,
    store,
    async limit(id) {
      if (failWith) throw failWith;
      ids.push(id);
      const e = store.get(id) ?? { used: 0, reset: windowEnd() };
      e.used++;
      store.set(id, e);
      return { pending: Promise.resolve() };
    },
    async getRemaining(id) {
      if (failWith) throw failWith;
      const e = store.get(id);
      return e ? { remaining: Math.max(0, 5 - e.used), reset: e.reset } : { remaining: 5, reset: windowEnd() };
    },
    async resetUsedTokens(id) {
      if (failWith) throw failWith;
      store.delete(id);
    },
  };
}

// Fake, obviously non-real config values used only to check they never get logged.
const FAKE_URL = 'https://fake-test-host.invalid';
const FAKE_TOKEN = 'fake_test_token_not_real';

// ── Backend selection / fallback (6) ───────────────────────────────

test('no env -> memory backend', () => {
  let created = 0;
  const lim = rl.resolveLoginRateLimiter({}, { warn: () => {}, createUpstashRatelimit: () => { created++; return makeMock(); } });
  assert.equal(lim.backend, 'memory');
  assert.equal(created, 0);
});

test('no env -> exactly one warning naming both vars', () => {
  const warnings: string[] = [];
  rl.resolveLoginRateLimiter({}, { warn: (m) => warnings.push(m), createUpstashRatelimit: () => makeMock() });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /UPSTASH_REDIS_REST_URL/);
  assert.match(warnings[0], /UPSTASH_REDIS_REST_TOKEN/);
});

test('only URL set -> memory, warns about TOKEN only, no values logged', () => {
  const warnings: string[] = [];
  const lim = rl.resolveLoginRateLimiter({ UPSTASH_REDIS_REST_URL: FAKE_URL }, { warn: (m) => warnings.push(m), createUpstashRatelimit: () => makeMock() });
  assert.equal(lim.backend, 'memory');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /UPSTASH_REDIS_REST_TOKEN/);
  assert.doesNotMatch(warnings[0], /UPSTASH_REDIS_REST_URL,/);
  assert.ok(!warnings[0].includes(FAKE_URL));
});

test('blank URL treated as missing; token never logged', () => {
  const warnings: string[] = [];
  const lim = rl.resolveLoginRateLimiter({ UPSTASH_REDIS_REST_URL: '  ', UPSTASH_REDIS_REST_TOKEN: FAKE_TOKEN }, { warn: (m) => warnings.push(m), createUpstashRatelimit: () => makeMock() });
  assert.equal(lim.backend, 'memory');
  assert.ok(!warnings.join().includes(FAKE_TOKEN));
});

test('both set -> upstash backend, no warning', () => {
  const warnings: string[] = [];
  let created = 0;
  const lim = rl.resolveLoginRateLimiter(
    { UPSTASH_REDIS_REST_URL: FAKE_URL, UPSTASH_REDIS_REST_TOKEN: FAKE_TOKEN },
    { warn: (m) => warnings.push(m), createUpstashRatelimit: () => { created++; return makeMock(); } }
  );
  assert.equal(lim.backend, 'upstash');
  assert.equal(warnings.length, 0);
  assert.equal(created, 1);
});

test('upstash init throws -> memory, warning without values', () => {
  const warnings: string[] = [];
  const lim = rl.resolveLoginRateLimiter(
    { UPSTASH_REDIS_REST_URL: FAKE_URL, UPSTASH_REDIS_REST_TOKEN: FAKE_TOKEN },
    { warn: (m) => warnings.push(m), createUpstashRatelimit: () => { throw new TypeError(`bad url ${FAKE_URL}`); } }
  );
  assert.equal(lim.backend, 'memory');
  assert.equal(warnings.length, 1);
  assert.ok(!warnings[0].includes(FAKE_URL));
});

// ── Upstash backend behaviour (7) ──────────────────────────────────

test('upstash: 4 failures not limited', async () => {
  const up = rl.createUpstashLoginRateLimiter(makeMock(), rl.memoryLoginRateLimiter, () => {});
  const k = key('3.3.3.1', 'up4@x.com');
  for (let i = 0; i < 4; i++) await up.recordFailure(k);
  assert.equal((await up.check(k)).limited, false);
});

test('upstash: 5 failures limited with Retry-After', async () => {
  const up = rl.createUpstashLoginRateLimiter(makeMock(), rl.memoryLoginRateLimiter, () => {});
  const k = key('3.3.3.2', 'up5@x.com');
  for (let i = 0; i < 5; i++) await up.recordFailure(k);
  const s = await up.check(k);
  assert.equal(s.limited, true);
  assert.equal(s.retryAfterSeconds, 900);
});

test('upstash: identifier is SHA-256 hash, no email/IP stored', async () => {
  const mock = makeMock();
  const up = rl.createUpstashLoginRateLimiter(mock, rl.memoryLoginRateLimiter, () => {});
  await up.recordFailure(key('3.3.3.3', 'hashme@x.com'));
  assert.equal(mock.ids.length, 1);
  assert.match(mock.ids[0], /^[0-9a-f]{64}$/);
  assert.ok(!mock.ids[0].includes('hashme@x.com') && !mock.ids[0].includes('3.3.3.3'));
});

test('upstash: clear resets count', async () => {
  const mock = makeMock();
  const up = rl.createUpstashLoginRateLimiter(mock, rl.memoryLoginRateLimiter, () => {});
  const k = key('3.3.3.4', 'upclear@x.com');
  for (let i = 0; i < 5; i++) await up.recordFailure(k);
  await up.clear(k);
  assert.equal((await up.check(k)).limited, false);
  assert.equal(mock.store.size, 0);
});

test('upstash outage: falls back to memory and still limits', async () => {
  const broken = rl.createUpstashLoginRateLimiter(makeMock(new Error('ECONNRESET')), rl.memoryLoginRateLimiter, () => {});
  const k = key('4.4.4.1', 'outage@x.com');
  for (let i = 0; i < 5; i++) await broken.recordFailure(k);
  assert.equal((await broken.check(k)).limited, true);
});

test('upstash outage: errors logged without token/key', async () => {
  const errs: string[] = [];
  const broken = rl.createUpstashLoginRateLimiter(makeMock(new Error(`ECONNRESET ${FAKE_TOKEN}`)), rl.memoryLoginRateLimiter, (m) => errs.push(m));
  await broken.recordFailure(key('4.4.4.2', 'outage-log@x.com'));
  await broken.check(key('4.4.4.2', 'outage-log@x.com'));
  assert.ok(errs.length > 0);
  for (const m of errs) {
    assert.ok(!m.includes(FAKE_TOKEN), 'token leaked into log');
    assert.ok(!m.includes('outage-log@x.com'), 'key leaked into log');
  }
});

test('upstash outage: clear still clears memory fallback', async () => {
  const broken = rl.createUpstashLoginRateLimiter(makeMock(new Error('ECONNRESET')), rl.memoryLoginRateLimiter, () => {});
  const k = key('4.4.4.3', 'outage-clear@x.com');
  for (let i = 0; i < 5; i++) await broken.recordFailure(k);
  await broken.clear(k);
  assert.equal((await broken.check(k)).limited, false);
});
