/**
 * Unit tests for small security helpers: open-redirect validator, contact-form HTML
 * escaping/validation, PostgREST filter sanitising, and Gemini model config.
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as SafeRedirectModule from '../../lib/safeRedirect';
import type * as EmailTemplatesModule from '../../lib/emailTemplates';
import type * as ContactInputModule from '../../lib/contactInput';
import type * as PostgrestFilterModule from '../../lib/postgrestFilter';
import type * as GeminiModule from '../../lib/gemini';

const load = async <T>(p: string): Promise<T> => import(new URL(p, import.meta.url).href) as Promise<T>;
const sr = await load<typeof SafeRedirectModule>('../../lib/safeRedirect.ts');
const et = await load<typeof EmailTemplatesModule>('../../lib/emailTemplates.ts');
const ci = await load<typeof ContactInputModule>('../../lib/contactInput.ts');
const pf = await load<typeof PostgrestFilterModule>('../../lib/postgrestFilter.ts');
const gm = await load<typeof GeminiModule>('../../lib/gemini.ts');

// ── Open redirect ──────────────────────────────────────────────────

test('safeNextPath: keeps same-origin relative paths (with query/hash)', () => {
  assert.equal(sr.safeNextPath('/dashboard'), '/dashboard');
  assert.equal(sr.safeNextPath('/dashboard/exams/123?tab=results#top'), '/dashboard/exams/123?tab=results#top');
  assert.equal(sr.safeNextPath('/a/../dashboard'), '/dashboard');
});

test('safeNextPath: rejects every off-site / scheme / trick form', () => {
  const attacks = [
    '//evil.com', '///evil.com', '////evil.com/path',
    '/\\evil.com', '\\\\evil.com', '/\\/evil.com', '\\/evil.com',
    'https://evil.com', 'http://evil.com/dashboard', 'HTTPS://evil.com',
    'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:x',
    'evil.com', 'dashboard', '', ' /dashboard', '/dashboard ',
    '/\t/evil.com', '/\n/evil.com', '/\r\n//evil.com', '/%09/evil.com'.replace('%09', '\t'),
    '/%2F%2Fevil.com', '/%2fevil.com', '/%5Cevil.com', '/%5c%5cevil.com',
    '/@evil.com'.replace('/', '//'), '//user:pass@evil.com', '/'.repeat(3000),
  ];
  for (const a of attacks) {
    assert.equal(sr.safeNextPath(a), '/dashboard', `should reject ${JSON.stringify(a)}`);
  }
  assert.equal(sr.safeNextPath(null), '/dashboard');
  assert.equal(sr.safeNextPath(undefined, '/login'), '/login');
  assert.equal(sr.safeNextPath(42 as unknown as string), '/dashboard');
});

test('safeNextPath: never yields a value that resolves off-origin', () => {
  const origin = 'https://examly.site';
  for (const a of ['//evil.com', '/\\evil.com', '/dashboard', '/%2F%2Fevil.com', '/x?next=//evil.com']) {
    const out = sr.safeNextPath(a);
    assert.equal(new URL(`${origin}${out}`).origin, origin, `${a} -> ${out}`);
  }
});

// ── Contact form: HTML escaping ────────────────────────────────────

const XSS = `<img src=x onerror="alert('x')">&<script>`;

test('escapeHtml escapes &, <, >, ", \'', () => {
  assert.equal(et.escapeHtml(`<a href="x" title='y'>&</a>`), '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  assert.equal(et.escapeHtml(null), '');
});

test('contact notification email escapes every user value', () => {
  const html = et.getContactNotificationEmailHtml({ name: XSS, email: `a"onmouseover="x@b.co`, subject: XSS, message: XSS });
  // (The template has its own <img> logo, so look for the injected payload specifically.)
  assert.ok(!html.includes('<img src=x'), 'raw injected <img> leaked');
  assert.ok(!html.includes('onerror="alert'), 'raw onerror leaked');
  assert.ok(!html.includes('<script>'), 'raw <script> leaked');
  assert.ok(!html.includes('"onmouseover="'), 'attribute injection leaked');
  assert.ok(html.includes('&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;'));
});

test('contact auto-reply escapes name and subject', () => {
  const html = et.getContactAutoReplyEmailHtml(XSS, XSS);
  assert.ok(!html.includes('<img src=x') && !html.includes('onerror="alert') && !html.includes('<script>'));
  assert.ok(html.includes('&lt;img src=x'));
});

// ── Contact form: validation and caps ──────────────────────────────

test('validateContactInput: accepts a normal message and caps field lengths', () => {
  const r = ci.validateContactInput({ name: 'N'.repeat(500), email: 'Teacher@School.edu', subject: 'S'.repeat(500), message: 'Hello there, I have a question.' });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.name.length, ci.CONTACT_LIMITS.name);
    assert.equal(r.value.subject.length, ci.CONTACT_LIMITS.subject);
    assert.equal(r.value.email, 'teacher@school.edu');
  }
});

test('validateContactInput: strips CR/LF from single-line fields (header injection)', () => {
  const r = ci.validateContactInput({ name: 'Bob\r\nBcc: victim@x.com', email: 'a@b.co', subject: 'Hi\nBcc: x@y.z', message: 'A long enough message.' });
  assert.ok(r.ok);
  if (r.ok) {
    assert.ok(!/[\r\n]/.test(r.value.name) && !/[\r\n]/.test(r.value.subject));
  }
});

test('validateContactInput: rejects bad emails, short and oversized messages', () => {
  for (const email of ['', 'no-at-sign', 'a@b', 'a b@c.de', 'a@b.c\r\nBcc: x@y.z', '<a@b.co>', `${'a'.repeat(250)}@b.co`, 'a@-b.co']) {
    assert.equal(ci.validateContactInput({ name: 'A', email, message: 'Long enough message' }).ok, false, email);
  }
  assert.equal(ci.validateContactInput({ name: 'A', email: 'a@b.co', message: 'short' }).ok, false);
  assert.equal(ci.validateContactInput({ name: 'A', email: 'a@b.co', message: 'x'.repeat(ci.CONTACT_LIMITS.message + 1) }).ok, false);
  assert.equal(ci.validateContactInput({ email: 'a@b.co', message: 'Long enough message' }).ok, false, 'name required');
  assert.equal(ci.validateContactInput(null).ok, false);
});

// ── PostgREST filter injection ─────────────────────────────────────

test('ilikeAnyFilter: normal search builds quoted ilike filters', () => {
  assert.equal(pf.ilikeAnyFilter(['name', 'email'], 'ahmed@school.edu'), 'name.ilike."%ahmed@school.edu%",email.ilike."%ahmed@school.edu%"');
});

test('ilikeAnyFilter: strips filter syntax so input cannot add conditions', () => {
  const attacks = [
    'x%,plan.eq.pro', 'x),or(id.not.is.null', 'a",status.eq.active,"', 'a\\",b', '*,id.neq.0', 'a:b(c)',
  ];
  for (const a of attacks) {
    const f = pf.ilikeAnyFilter(['name'], a)!;
    assert.ok(f.startsWith('name.ilike."%') && f.endsWith('%"'), f);
    const inner = f.slice('name.ilike."%'.length, -'%"'.length);
    assert.doesNotMatch(inner, /[,()"\\:*%]/, `${a} -> ${inner}`);
  }
});

test('ilikeAnyFilter: empty/whitespace/symbol-only -> null; long input capped; bad column throws', () => {
  assert.equal(pf.ilikeAnyFilter(['name'], ''), null);
  assert.equal(pf.ilikeAnyFilter(['name'], '   '), null);
  assert.equal(pf.ilikeAnyFilter(['name'], '(),"'), null);
  assert.equal(pf.ilikeAnyFilter(['name'], 123), null);
  assert.equal(pf.sanitizeSearchTerm('a'.repeat(500)).length, 100);
  assert.throws(() => pf.ilikeAnyFilter(['name,plan'], 'x'));
});

// ── Gemini model config ────────────────────────────────────────────

test('geminiModels: verified defaults, env overrides, invalid env ignored', () => {
  assert.deepEqual(gm.geminiModels({}), ['gemini-3.6-flash', 'gemini-3.5-flash-lite']);
  assert.deepEqual(gm.geminiModels({ GEMINI_MODEL_PRIMARY: 'gemini-3.8-flash' }), ['gemini-3.8-flash', 'gemini-3.5-flash-lite']);
  assert.deepEqual(gm.geminiModels({ GEMINI_MODEL_PRIMARY: 'x', GEMINI_MODEL_FALLBACK: 'bad model!' }), ['gemini-3.6-flash', 'gemini-3.5-flash-lite']);
  assert.deepEqual(gm.geminiModels({ GEMINI_MODEL_PRIMARY: 'gemini-3.6-flash', GEMINI_MODEL_FALLBACK: 'gemini-3.6-flash' }), ['gemini-3.6-flash']);
});

test('stripJsonFence removes ```json fences', () => {
  assert.equal(gm.stripJsonFence('```json\n{"a":1}\n```'), '{"a":1}');
  assert.equal(gm.stripJsonFence('```\n{"a":1}\n```'), '{"a":1}');
  assert.equal(gm.stripJsonFence(' {"a":1} '), '{"a":1}');
});

test('describeGeminiModels: admin label follows the configured models, not a hard-coded name', () => {
  assert.equal(gm.describeGeminiModels({}), 'gemini-3.6-flash (primary), gemini-3.5-flash-lite (fallback)');
  assert.equal(gm.describeGeminiModels({ GEMINI_MODEL_PRIMARY: 'gemini-3.8-flash' }), 'gemini-3.8-flash (primary), gemini-3.5-flash-lite (fallback)');
  assert.equal(gm.describeGeminiModels({ GEMINI_MODEL_PRIMARY: 'gemini-3.5-flash-lite' }), 'gemini-3.5-flash-lite (primary, no separate fallback)');
});
