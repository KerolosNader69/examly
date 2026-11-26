/**
 * Unit tests for lib/mediaCapture.ts and lib/deepgram.ts (recording formats, mic
 * errors, silence detection, size budget, transcribe outcomes, retries, Deepgram).
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as MediaModule from '../../lib/mediaCapture';
import type * as DeepgramModule from '../../lib/deepgram';
import type * as LanguageModule from '../../lib/examLanguage';

const mc: typeof MediaModule = await import(new URL('../../lib/mediaCapture.ts', import.meta.url).href);
const dg: typeof DeepgramModule = await import(new URL('../../lib/deepgram.ts', import.meta.url).href);
const lang: typeof LanguageModule = await import(new URL('../../lib/examLanguage.ts', import.meta.url).href);

const supports = (list: string[]) => (t: string) => list.includes(t);

test('pickRecorderMimeType: Chrome/Firefox webm, Safari mp4, no webm -> next best, none -> undefined', () => {
  assert.equal(mc.pickRecorderMimeType(supports(['audio/webm;codecs=opus', 'audio/webm']), 'audio'), 'audio/webm;codecs=opus');
  assert.equal(mc.pickRecorderMimeType(supports(['audio/mp4']), 'audio'), 'audio/mp4', 'Safari/iOS');
  assert.equal(mc.pickRecorderMimeType(supports(['audio/ogg;codecs=opus']), 'audio'), 'audio/ogg;codecs=opus');
  assert.equal(mc.pickRecorderMimeType(supports([]), 'audio'), undefined, 'browser default');
  assert.equal(mc.pickRecorderMimeType(undefined, 'audio'), undefined);
  assert.equal(mc.pickRecorderMimeType(supports(['video/webm;codecs=vp8,opus', 'video/mp4']), 'video'), 'video/webm;codecs=vp8,opus');
  assert.equal(mc.pickRecorderMimeType(supports(['video/mp4']), 'video'), 'video/mp4', 'Safari video');
  assert.equal(mc.pickRecorderMimeType(() => { throw new Error('x'); }, 'audio'), undefined, 'throwing isTypeSupported');
});

test('baseMimeType / extensionForMime', () => {
  assert.equal(mc.baseMimeType('audio/webm;codecs=opus'), 'audio/webm');
  assert.equal(mc.baseMimeType('Video/MP4; codecs="avc1"'), 'video/mp4');
  assert.equal(mc.baseMimeType(''), 'audio/webm');
  assert.equal(mc.baseMimeType('text/html', 'x'), 'x');
  assert.equal(mc.extensionForMime('audio/mp4'), 'mp4');
  assert.equal(mc.extensionForMime('video/webm;codecs=vp9'), 'webm');
  assert.equal(mc.extensionForMime('audio/ogg'), 'ogg');
});

test('describeMediaError: each getUserMedia failure gets its own actionable message', () => {
  const code = (name: string) => mc.describeMediaError({ name }).code;
  assert.equal(code('NotAllowedError'), 'denied');
  assert.equal(code('NotFoundError'), 'no_device');
  assert.equal(code('OverconstrainedError'), 'no_device');
  assert.equal(code('NotReadableError'), 'in_use');
  assert.equal(code('SecurityError'), 'insecure');
  assert.equal(code('NotSupportedError'), 'unsupported');
  assert.equal(code('Disconnected'), 'disconnected');
  assert.equal(mc.describeMediaError(null).code, 'unknown');
  assert.match(mc.describeMediaError({ name: 'NotAllowedError' }, true).message, /camera and microphone/);
});

test('rmsLevel + assessRecording: silence, quiet, too short and normal speech', () => {
  assert.equal(mc.rmsLevel(new Uint8Array(1024).fill(128)), 0);
  assert.equal(mc.rmsLevel([]), 0);
  const tone = Uint8Array.from({ length: 1024 }, (_, i) => 128 + Math.round(40 * Math.sin(i / 5)));
  assert.ok(mc.rmsLevel(tone) > 0.2);
  assert.equal(mc.assessRecording(0, 30), 'silent');
  assert.equal(mc.assessRecording(0.005, 30), 'silent');
  assert.equal(mc.assessRecording(0.02, 30), 'quiet');
  assert.equal(mc.assessRecording(0.2, 1), 'too_short');
  assert.equal(mc.assessRecording(0.2, NaN), 'too_short');
  assert.equal(mc.assessRecording(0.2, 30), 'ok');
});

test('size budget: audio-only answers fit the ~4.5 MB serverless body limit; video does not', () => {
  const VERCEL_BODY = 4.5 * 1024 * 1024;
  for (const sec of [60, 120, 200]) {
    const audio = mc.estimateRecordingBytes(mc.AUDIO_BITS_PER_SECOND, sec);
    assert.ok(mc.base64Length(audio) < VERCEL_BODY, `${sec}s audio`);
    assert.ok(audio < mc.MAX_TRANSCRIBE_AUDIO_BYTES, `${sec}s audio under server cap`);
  }
  // A browser ignoring the 32 kbps hint (128 kbps) still fits for the longest accepted
  // answer (60 s limit + grace); 200 s at 128 kbps would NOT (3.2 MB) -> keep limits in sync.
  assert.ok(mc.estimateRecordingBytes(128_000, 60 + mc.ANSWER_DURATION_GRACE_SECONDS) < mc.MAX_TRANSCRIBE_AUDIO_BYTES);
  assert.ok(mc.estimateRecordingBytes(128_000, 200) > mc.MAX_TRANSCRIBE_AUDIO_BYTES);
  // Server cap + base64 + JSON overhead < 4.5 MB
  assert.ok(mc.base64Length(mc.MAX_TRANSCRIBE_AUDIO_BYTES) + 64 * 1024 < VERCEL_BODY);
  // 60 s of 1 Mbps video base64 is already over the limit -> must go to storage
  assert.ok(mc.base64Length(mc.estimateRecordingBytes(mc.VIDEO_BITS_PER_SECOND, 60)) > VERCEL_BODY);
});

test('classifyTranscribeResponse: every server outcome maps to a UI action', () => {
  assert.deepEqual(mc.classifyTranscribeResponse(200, { success: true, transcript: ' hello there ' }), { kind: 'ok', transcript: 'hello there' });
  assert.deepEqual(mc.classifyTranscribeResponse(200, { success: true, transcript: '' }), { kind: 'no_speech' });
  assert.deepEqual(mc.classifyTranscribeResponse(200, { success: true, transcript: 'ok' }), { kind: 'no_speech' }, '<3 chars');
  assert.deepEqual(mc.classifyTranscribeResponse(200, { success: false, status: 'pending_review' }), { kind: 'pending_review' });
  assert.deepEqual(mc.classifyTranscribeResponse(429, {}), { kind: 'rate_limited' });
  assert.deepEqual(mc.classifyTranscribeResponse(409, { error: 'This question has already been answered.' }), { kind: 'already_answered' });
  assert.equal(mc.classifyTranscribeResponse(409, { error: 'This exam session is no longer active.' }).kind, 'fatal');
  assert.equal(mc.classifyTranscribeResponse(413, { error: 'Recording is too large.' }).kind, 'too_large');
  assert.equal(mc.classifyTranscribeResponse(401, { error: 'Invalid' }).kind, 'fatal');
  assert.equal(mc.classifyTranscribeResponse(502, null).kind, 'retryable');
  assert.equal(mc.classifyTranscribeResponse(200, 'garbage').kind, 'pending_review');
});

test('withRetry: retries thrown errors and retryable results, then gives up', async () => {
  const sleeps: number[] = [];
  const sleep = async (ms: number) => { sleeps.push(ms); };
  let n = 0;
  const r = await mc.withRetry(async () => { if (n++ < 2) throw new TypeError('offline'); return 'ok'; }, { sleep });
  assert.equal(r, 'ok');
  assert.deepEqual(sleeps, [1000, 3000]);

  let m = 0;
  await assert.rejects(mc.withRetry(async () => { m++; throw new TypeError('offline'); }, { sleep, delaysMs: [1] }));
  assert.equal(m, 2);

  let k = 0;
  const last = await mc.withRetry(async () => ({ status: 500 + k++ }), { sleep, delaysMs: [1, 1], shouldRetry: (x) => x.status >= 500 });
  assert.equal(last.status, 502, 'returns the last result after retries');

  let c = 0;
  const once = await mc.withRetry(async () => ({ status: 400, c: ++c }), { sleep, shouldRetry: (x) => x.status >= 500 });
  assert.equal(once.c, 1, '4xx is not retried');
});

test('recording paths: one file per session+question; foreign/traversal paths rejected', () => {
  const s = '11111111-1111-1111-1111-111111111111';
  const q = '22222222-2222-2222-2222-222222222222';
  const p = mc.recordingObjectPath(s, q, 'video/webm;codecs=vp9', 1700000000000);
  assert.equal(p, `recordings/${s}/${q}-1700000000000.webm`);
  assert.equal(mc.isRecordingPathFor(p, s, q), true);
  assert.equal(mc.isRecordingPathFor(p, s, '33333333-3333-3333-3333-333333333333'), false);
  assert.equal(mc.isRecordingPathFor(`recordings/${s}/${q}-1/../../x.webm`, s, q), false);
  assert.equal(mc.isRecordingPathFor(`recordings/${s}/${q}-1.exe`, s, q), false);
  assert.equal(mc.isRecordingPathFor(null, s, q), false);
});

// ── Deepgram ───────────────────────────────────────────────────────

test('deepgram: nova-2 fallback only for languages it supports (no Arabic)', () => {
  assert.deepEqual(dg.deepgramModelsFor('en'), ['nova-3', 'nova-2']);
  assert.deepEqual(dg.deepgramModelsFor('en-US'), ['nova-3', 'nova-2']);
  assert.deepEqual(dg.deepgramModelsFor('ar'), ['nova-3', null]);
  assert.deepEqual(dg.deepgramModelsFor('ar-EG'), ['nova-3', null]);
  assert.deepEqual(dg.deepgramModelsFor('fr'), ['nova-3', 'nova-2']);
  assert.deepEqual(dg.deepgramModelsFor('ar-SA'), ['nova-3', null]);
});

test('exam languages: every selectable code uses nova-3; only nova-2-listed codes get a fallback', () => {
  const nova2Listed = new Set(['en', 'en-US', 'en-GB', 'en-AU', 'en-IN', 'en-NZ', 'fr', 'es', 'de']);
  for (const { code } of lang.EXAM_LANGUAGES) {
    const [primary, fallback] = dg.deepgramModelsFor(code);
    assert.equal(primary, 'nova-3', code);
    assert.equal(fallback, nova2Listed.has(code) ? 'nova-2' : null, code);
    // Same shape as the CHECK constraint in migration 004.
    assert.match(code, /^[a-z]{2,3}(-[A-Z]{2})?$/, code);
  }
  assert.ok(lang.EXAM_LANGUAGES.some((l) => l.code === 'ar') && lang.EXAM_LANGUAGES.some((l) => l.code === 'ar-EG'));
});

test('exam languages: normalize/label/dir; unknown or malformed values -> English', () => {
  assert.equal(lang.normalizeExamLanguage('ar-EG'), 'ar-EG');
  for (const bad of [undefined, null, '', 'AR', 'ar-eg', 'xx', 'en&model=x', 42]) assert.equal(lang.normalizeExamLanguage(bad), 'en', String(bad));
  assert.equal(lang.examLanguageLabel('ar-EG'), 'Arabic (Egypt)');
  assert.equal(lang.examLanguageLabel(null), 'English');
  assert.equal(lang.examLanguageDir('ar'), 'rtl');
  assert.equal(lang.examLanguageDir('en-GB'), 'ltr');
  assert.equal(lang.normalizeWrongLanguagePolicy('penalize'), 'penalize');
  assert.equal(lang.normalizeWrongLanguagePolicy('ignore'), 'ignore');
  for (const bad of [undefined, null, '', 'PENALIZE', 'zero']) assert.equal(lang.normalizeWrongLanguagePolicy(bad), 'review');
});

test('deepgram: URL params encoded; response parsed defensively', () => {
  const u = new URL(dg.deepgramListenUrl('nova-3', 'ar-EG'));
  assert.equal(u.origin + u.pathname, 'https://api.deepgram.com/v1/listen');
  assert.equal(u.searchParams.get('model'), 'nova-3');
  assert.equal(u.searchParams.get('language'), 'ar-EG');
  assert.equal(u.searchParams.get('smart_format'), 'true');
  assert.deepEqual(
    dg.parseDeepgramResult({ metadata: { duration: 12.5 }, results: { channels: [{ alternatives: [{ transcript: 'hi', confidence: 0.93 }] }] } }),
    { transcript: 'hi', confidence: 0.93, duration: 12.5 }
  );
  assert.deepEqual(dg.parseDeepgramResult({}), { transcript: '', confidence: null, duration: null });
  assert.deepEqual(dg.parseDeepgramResult(null), { transcript: '', confidence: null, duration: null });
  assert.equal(dg.parseDeepgramResult({ results: { channels: [{ alternatives: [{ transcript: 'x'.repeat(30000) }] }] } }).transcript.length, 20000);
});
