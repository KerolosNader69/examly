/**
 * Unit tests for lib/rateLimit.ts (shared limiter used by exam, AI and contact routes;
 * the admin login limiter has its own tests in adminLoginRateLimit.test.ts).
 * No network: Upstash is always a mock. Time is frozen.
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type * as RateLimitModule from '../../lib/rateLimit';

const rl: typeof RateLimitModule = await import(new URL('../../lib/rateLimit.ts', import.meta.url).href);

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

const FAKE_URL = 'https://fake-test-host.invalid';
const FAKE_TOKEN = 'fake_test_token_not_real';
const quiet = { warn: () => {}, logError: () => {} };

test('MemoryFixedWindow.consume: allows max, then blocks with Retry-After, then resets after the window', () => {
  const w = new rl.MemoryFixedWindow(3, 60_000);
  assert.deepEqual([w.consume('k'), w.consume('k'), w.consume('k')].map((r) => r.allowed), [true, true, true]);
  const blocked = w.consume('k');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 60);
  assert.equal(w.consume('other').allowed, true, 'keys are independent');
  clock = FIXED_NOW + 60_001;
  assert.equal(w.consume('k').allowed, true);
});

test('MemoryFixedWindow.check/record/clear keep admin semantics (check does not count)', () => {
  const w = new rl.MemoryFixedWindow(2, 60_000);
  assert.equal(w.check('k').limited, false);
  w.record('k');
  assert.equal(w.check('k').limited, false);
  w.record('k');
  assert.equal(w.check('k').limited, true);
  w.clear('k');
  assert.equal(w.check('k').limited, false);
});

test('MemoryFixedWindow caps tracked keys', () => {
  const w = new rl.MemoryFixedWindow(1, 60_000, 50);
  for (let i = 0; i < 500; i++) w.consume(`k${i}`);
  // Oldest keys evicted -> they are allowed again (bounded memory instead of growth).
  assert.equal(w.consume('k0').allowed, true);
});

test('createRateLimiter: no Upstash env -> memory backend with a warning that names vars, not values', () => {
  const warnings: string[] = [];
  const lim = rl.createRateLimiter({ name: 't1', max: 2, windowMs: 60_000 }, { UPSTASH_REDIS_REST_URL: FAKE_URL }, { warn: (m) => warnings.push(m) });
  assert.equal(lim.backend, 'memory');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /UPSTASH_REDIS_REST_TOKEN/);
  assert.ok(!warnings[0].includes(FAKE_URL));
});

test('createRateLimiter (memory): enforces the limit', async () => {
  const lim = rl.createRateLimiter({ name: 't2', max: 2, windowMs: 60_000 }, {}, quiet);
  assert.equal((await lim.limit('ip')).allowed, true);
  assert.equal((await lim.limit('ip')).allowed, true);
  const third = await lim.limit('ip');
  assert.equal(third.allowed, false);
  assert.equal(third.retryAfterSeconds, 60);
  await lim.reset('ip');
  assert.equal((await lim.limit('ip')).allowed, true);
});

function upstashMock(opts: { max: number; failWith?: Error }) {
  const counts = new Map<string, number>();
  const ids: string[] = [];
  const mock: RateLimitModule.UpstashRatelimitLike = {
    async limit(id) {
      if (opts.failWith) throw opts.failWith;
      ids.push(id);
      const n = (counts.get(id) ?? 0) + 1;
      counts.set(id, n);
      return { success: n <= opts.max, reset: Date.now() + 30_000, pending: Promise.resolve() };
    },
    async getRemaining(id) {
      return { remaining: Math.max(0, opts.max - (counts.get(id) ?? 0)), reset: Date.now() + 30_000 };
    },
    async resetUsedTokens(id) {
      counts.delete(id);
    },
  };
  return { mock, ids };
}

test('createRateLimiter (upstash mock): uses Upstash, hashes keys, honours success=false and reset', async () => {
  const { mock, ids } = upstashMock({ max: 1 });
  let createdWith: { max: number; prefix: string } | null = null;
  const lim = rl.createRateLimiter(
    { name: 'contact-ip', max: 1, windowMs: 3_600_000 },
    { UPSTASH_REDIS_REST_URL: FAKE_URL, UPSTASH_REDIS_REST_TOKEN: FAKE_TOKEN },
    { ...quiet, createUpstashRatelimit: (_u, _t, o) => { createdWith = { max: o.max, prefix: o.prefix }; return mock; } }
  );
  assert.equal(lim.backend, 'upstash');
  assert.deepEqual(createdWith, { max: 1, prefix: 'examly:rl:contact-ip' });
  assert.equal((await lim.limit('teacher@x.com')).allowed, true);
  const blocked = await lim.limit('teacher@x.com');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 30);
  assert.ok(ids.every((id) => /^[0-9a-f]{64}$/.test(id) && !id.includes('teacher@x.com')));
});

test('createRateLimiter (upstash outage): falls back to memory and still limits; logs no secrets', async () => {
  const errors: string[] = [];
  const { mock } = upstashMock({ max: 100, failWith: new Error(`ECONNRESET ${FAKE_TOKEN}`) });
  const lim = rl.createRateLimiter(
    { name: 't3', max: 2, windowMs: 60_000 },
    { UPSTASH_REDIS_REST_URL: FAKE_URL, UPSTASH_REDIS_REST_TOKEN: FAKE_TOKEN },
    { warn: () => {}, logError: (m) => errors.push(m), createUpstashRatelimit: () => mock }
  );
  assert.equal((await lim.limit('k')).allowed, true);
  assert.equal((await lim.limit('k')).allowed, true);
  assert.equal((await lim.limit('k')).allowed, false);
  assert.ok(errors.length > 0);
  for (const m of errors) assert.ok(!m.includes(FAKE_TOKEN) && !m.includes(FAKE_URL));
});

test('createRateLimiter: Upstash init failure -> memory backend', () => {
  const warnings: string[] = [];
  const lim = rl.createRateLimiter(
    { name: 't4', max: 1, windowMs: 1000 },
    { UPSTASH_REDIS_REST_URL: FAKE_URL, UPSTASH_REDIS_REST_TOKEN: FAKE_TOKEN },
    { warn: (m) => warnings.push(m), createUpstashRatelimit: () => { throw new TypeError(FAKE_URL); } }
  );
  assert.equal(lim.backend, 'memory');
  assert.ok(!warnings.join().includes(FAKE_URL));
});

test('readUpstashEnv: both vars required; blank counts as missing', () => {
  assert.deepEqual(rl.readUpstashEnv({}), { ok: false, missing: 'UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN' });
  assert.deepEqual(rl.readUpstashEnv({ UPSTASH_REDIS_REST_URL: ' ', UPSTASH_REDIS_REST_TOKEN: FAKE_TOKEN }), { ok: false, missing: 'UPSTASH_REDIS_REST_URL' });
  assert.equal(rl.readUpstashEnv({ UPSTASH_REDIS_REST_URL: FAKE_URL, UPSTASH_REDIS_REST_TOKEN: FAKE_TOKEN }).ok, true);
});

test('tooManyRequests: 429 with Retry-After >= 1', () => {
  const r = rl.tooManyRequests(0);
  assert.equal(r.init.status, 429);
  assert.equal(r.init.headers['Retry-After'], '1');
});
