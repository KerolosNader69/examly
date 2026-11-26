/**
 * Unit tests for lib/adminSession.ts (signed admin session tokens).
 * Run with: npm run test:unit   (Node's built-in test runner + native TypeScript stripping)
 *
 * No real secrets: a fake ADMIN_SESSION_SECRET is generated in this file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type * as AdminSessionModule from '../../lib/adminSession';

// Runtime import with an explicit .ts path (required by Node's type stripping); the
// type-only import above keeps full typing for `next build`'s TypeScript check.
const lib: typeof AdminSessionModule = await import(new URL('../../lib/adminSession.ts', import.meta.url).href);

// Obviously fake test-only secrets (never real values).
const SECRET = 'x'.repeat(40);
const OTHER_SECRET = 'y'.repeat(40);
const ROTATED_SECRET = 'z'.repeat(40);

const useSecret = (value: string | undefined) => {
  if (value === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = value;
};

const b64u = (s: string) => Buffer.from(s).toString('base64url');
const sign = (part: string, secret = SECRET) => createHmac('sha256', secret).update(part).digest('base64url');
const nowSec = () => Math.floor(Date.now() / 1000);
/** Builds a token with a correctly signed arbitrary payload (bypassing createAdminSession). */
const mk = (o: object) => {
  const part = b64u(JSON.stringify(o));
  return `${part}.${sign(part)}`;
};
const splitToken = (t: string): [string, string] => {
  const [p, s] = t.split('.');
  return [p, s];
};

/** Flip one real bit in the decoded signature bytes and re-encode canonically (bytes always differ). */
const flipBit = (sigPart: string, byteIdx = 0, bit = 0) => {
  const b = Buffer.from(sigPart, 'base64url');
  b[byteIdx] ^= 1 << bit;
  return b.toString('base64url');
};

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/**
 * Flip the lowest bit of the last base64url char. For encodings whose length is not a
 * multiple of 4 that bit is unused padding, so the result decodes to IDENTICAL bytes but
 * is a different (non-canonical) string.
 */
const altSpelling = (part: string) => part.slice(0, -1) + ALPHA[ALPHA.indexOf(part.slice(-1)) ^ 1];
const sameBytes = (a: string, b: string) => Buffer.compare(Buffer.from(a, 'base64url'), Buffer.from(b, 'base64url')) === 0;

const FORGED_UNSIGNED = Buffer.from(JSON.stringify({ role: 'admin', uid: 'x', email: 'x' })).toString('base64');

// ── Secret configuration (fail closed) ─────────────────────────────

test('no secret: create throws', async () => {
  useSecret(undefined);
  await assert.rejects(lib.createAdminSession({ uid: 'u', email: 'e' }));
});

test('short secret: verify rejects', async () => {
  useSecret('short');
  assert.equal(await lib.verifyAdminSession('a.b'), null);
});

test('short secret: create throws', async () => {
  useSecret('short');
  await assert.rejects(lib.createAdminSession({ uid: 'u', email: 'e' }));
});

// ── Valid tokens ───────────────────────────────────────────────────

test('valid token verifies', async () => {
  useSecret(SECRET);
  const t = await lib.createAdminSession({ uid: 'uid-1', email: 'a@b.c' });
  const p = await lib.verifyAdminSession(t);
  assert.ok(p);
  assert.equal(p.uid, 'uid-1');
  assert.equal(p.role, 'admin');
  assert.equal(p.exp - p.iat, 8 * 3600);
});

test('signature matches node HMAC (interop)', async () => {
  useSecret(SECRET);
  const [pp, ss] = splitToken(await lib.createAdminSession({ uid: 'uid-1', email: 'a@b.c' }));
  assert.equal(ss, sign(pp));
});

// ── Forged / tampered tokens ───────────────────────────────────────

test('legacy unsigned base64 cookie rejected', async () => {
  useSecret(SECRET);
  assert.equal(await lib.verifyAdminSession(FORGED_UNSIGNED), null);
});

test('tampered payload rejected', async () => {
  useSecret(SECRET);
  const [pp, ss] = splitToken(await lib.createAdminSession({ uid: 'uid-1', email: 'a@b.c' }));
  const tamperedPayload = b64u(JSON.stringify({ ...JSON.parse(Buffer.from(pp, 'base64url').toString()), uid: 'attacker' }));
  assert.equal(await lib.verifyAdminSession(`${tamperedPayload}.${ss}`), null);
});

test('tampered signature rejected (deterministic bit flip)', async () => {
  useSecret(SECRET);
  const [pp, ss] = splitToken(await lib.createAdminSession({ uid: 'uid-1', email: 'a@b.c' }));
  const flipped = flipBit(ss);
  assert.equal(sameBytes(flipped, ss), false, 'flip must change the signature bytes');
  assert.equal(await lib.verifyAdminSession(`${pp}.${flipped}`), null);
});

test('missing signature rejected', async () => {
  useSecret(SECRET);
  const [pp] = splitToken(await lib.createAdminSession({ uid: 'uid-1', email: 'a@b.c' }));
  assert.equal(await lib.verifyAdminSession(`${pp}.`), null);
});

test('extra segment rejected', async () => {
  useSecret(SECRET);
  const t = await lib.createAdminSession({ uid: 'uid-1', email: 'a@b.c' });
  assert.equal(await lib.verifyAdminSession(`${t}.x`), null);
});

test('wrong-secret signature rejected', async () => {
  useSecret(SECRET);
  const [pp] = splitToken(await lib.createAdminSession({ uid: 'uid-1', email: 'a@b.c' }));
  assert.equal(await lib.verifyAdminSession(`${pp}.${sign(pp, OTHER_SECRET)}`), null);
});

// ── Canonical encoding ─────────────────────────────────────────────

test('non-canonical signature (same bytes, different last char) rejected', async () => {
  useSecret(SECRET);
  const [pp, ss] = splitToken(await lib.createAdminSession({ uid: 'uid-1', email: 'a@b.c' }));
  const ncSig = altSpelling(ss);
  assert.notEqual(ncSig, ss);
  assert.ok(sameBytes(ncSig, ss), 'alternate spelling must decode to identical bytes');
  assert.equal(await lib.verifyAdminSession(`${pp}.${ncSig}`), null);
});

/** Payload whose byte length % 3 === 1, so its last base64url char carries unused bits. */
const nonCanonicalPayloadFixture = () => {
  const now = nowSec();
  let pad = '';
  let obj: Record<string, unknown>;
  do {
    obj = { uid: 'u', email: `p${pad}@x.io`, role: 'admin', iat: now, exp: now + 3600 };
    pad += 'a';
  } while (Buffer.byteLength(JSON.stringify(obj)) % 3 !== 1);
  const canonical = b64u(JSON.stringify(obj));
  return { canonical, nonCanonical: altSpelling(canonical) };
};

test('canonical payload control: correctly signed token verifies', async () => {
  useSecret(SECRET);
  const { canonical } = nonCanonicalPayloadFixture();
  assert.notEqual(await lib.verifyAdminSession(`${canonical}.${sign(canonical)}`), null);
});

test('non-canonical payload (same bytes, validly HMAC-signed) rejected', async () => {
  useSecret(SECRET);
  const { canonical, nonCanonical } = nonCanonicalPayloadFixture();
  assert.notEqual(nonCanonical, canonical);
  assert.ok(sameBytes(nonCanonical, canonical), 'alternate spelling must decode to identical bytes');
  assert.equal(await lib.verifyAdminSession(`${nonCanonical}.${sign(nonCanonical)}`), null);
});

test('canonical token from createAdminSession still verifies', async () => {
  useSecret(SECRET);
  const t = await lib.createAdminSession({ uid: 'uid-2', email: 'c@d.e' });
  assert.notEqual(await lib.verifyAdminSession(t), null);
});

test('200 fresh tokens: all verify, all bit-flipped/alt-spelled sigs rejected', async () => {
  useSecret(SECRET);
  for (let i = 0; i < 200; i++) {
    const tok = await lib.createAdminSession({ uid: `uid-${i}`, email: `user${i}@x.io` });
    const [a, s] = splitToken(tok);
    assert.notEqual(await lib.verifyAdminSession(tok), null, `token ${i} should verify`);
    const flipped = flipBit(s, i % 32, i % 8);
    assert.equal(sameBytes(flipped, s), false);
    assert.equal(await lib.verifyAdminSession(`${a}.${flipped}`), null, `bit-flipped token ${i} accepted`);
    const alt = altSpelling(s);
    assert.ok(sameBytes(alt, s));
    assert.equal(await lib.verifyAdminSession(`${a}.${alt}`), null, `alt-spelled token ${i} accepted`);
  }
});

// ── Payload rules ──────────────────────────────────────────────────

test('expired (correctly signed) rejected', async () => {
  useSecret(SECRET);
  const now = nowSec();
  assert.equal(await lib.verifyAdminSession(mk({ uid: 'u', email: 'e', role: 'admin', iat: now - 9 * 3600, exp: now - 3600 })), null);
});

test('lifetime > 8h rejected', async () => {
  useSecret(SECRET);
  const now = nowSec();
  assert.equal(await lib.verifyAdminSession(mk({ uid: 'u', email: 'e', role: 'admin', iat: now, exp: now + 30 * 3600 })), null);
});

test('non-admin role rejected', async () => {
  useSecret(SECRET);
  const now = nowSec();
  assert.equal(await lib.verifyAdminSession(mk({ uid: 'u', email: 'e', role: 'teacher', iat: now, exp: now + 3600 })), null);
});

test('signed but valid payload accepted', async () => {
  useSecret(SECRET);
  const now = nowSec();
  assert.notEqual(await lib.verifyAdminSession(mk({ uid: 'u', email: 'e', role: 'admin', iat: now, exp: now + 3600 })), null);
});

// ── Misc ───────────────────────────────────────────────────────────

test('secret rotation invalidates old tokens', async () => {
  useSecret(SECRET);
  const t = await lib.createAdminSession({ uid: 'uid-1', email: 'a@b.c' });
  useSecret(ROTATED_SECRET);
  assert.equal(await lib.verifyAdminSession(t), null);
});

test('null/undefined/empty rejected', async () => {
  useSecret(SECRET);
  assert.equal(await lib.verifyAdminSession(undefined), null);
  assert.equal(await lib.verifyAdminSession(null), null);
  assert.equal(await lib.verifyAdminSession(''), null);
});

test('cookie opts: httpOnly strict / maxAge 8h, logout maxAge 0', () => {
  const o = lib.adminSessionCookieOptions();
  const z = lib.adminSessionCookieOptions(0);
  assert.equal(o.httpOnly, true);
  assert.equal(o.sameSite, 'strict');
  assert.equal(o.path, '/');
  assert.equal(o.maxAge, 28800);
  assert.equal(z.maxAge, 0);
});
