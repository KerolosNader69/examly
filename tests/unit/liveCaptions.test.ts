/**
 * Unit tests for lib/liveCaptions.ts (video exam room: caption language, buffer cap,
 * panel direction, restart/backoff, error handling, device gate, panel contrast).
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as CaptionsModule from '../../lib/liveCaptions';

const lc: typeof CaptionsModule = await import(new URL('../../lib/liveCaptions.ts', import.meta.url).href);

test('captionLangFor: ar -> ar-EG, en -> en-US, regional codes kept, unknown -> null', () => {
  assert.equal(lc.captionLangFor('ar'), 'ar-EG');
  assert.equal(lc.captionLangFor('en'), 'en-US');
  assert.equal(lc.captionLangFor('ar-SA'), 'ar-SA');
  assert.equal(lc.captionLangFor('en-GB'), 'en-GB');
  assert.equal(lc.captionLangFor('EN-gb'), 'en-GB');
  assert.equal(lc.captionLangFor('fr'), 'fr-FR');
  assert.equal(lc.captionLangFor('de'), 'de-DE');
  assert.equal(lc.captionLangFor('es'), 'es-ES');
  assert.equal(lc.captionLangFor(undefined), 'en-US', 'missing language = app default (en)');
  assert.equal(lc.captionLangFor(''), 'en-US');
  for (const bad of ['zz', 'tlh', 'ar_EG', 'en-US-x-foo', 'xx-YY', '<script>']) assert.equal(lc.captionLangFor(bad), null, bad);
});

test('panelLocale: Arabic exams RTL/ar, everything else LTR/en', () => {
  assert.deepEqual(lc.panelLocale('ar'), { lang: 'ar', dir: 'rtl' });
  assert.deepEqual(lc.panelLocale('ar-EG'), { lang: 'ar', dir: 'rtl' });
  assert.deepEqual(lc.panelLocale('AR-sa'), { lang: 'ar', dir: 'rtl' });
  for (const l of ['en', 'en-GB', 'fr', '', undefined, null, 42]) assert.deepEqual(lc.panelLocale(l), { lang: 'en', dir: 'ltr' }, String(l));
});

test('capCaption / appendCaption: keep the newest text, cap length, cut at a word', () => {
  assert.equal(lc.capCaption('short'), 'short');
  const long = Array.from({ length: 300 }, (_, i) => `w${i}`).join(' ');
  const capped = lc.capCaption(long);
  assert.ok(capped.length <= lc.CAPTION_MAX_CHARS);
  assert.ok(capped.endsWith('w299'), 'newest words kept');
  assert.ok(/^w\d+/.test(capped), 'starts on a whole word');
  // One huge word: hard cut, still capped.
  assert.equal(lc.capCaption('x'.repeat(1000)).length, lc.CAPTION_MAX_CHARS);
  assert.equal(lc.appendCaption('', '  hello   world '), 'hello world');
  assert.equal(lc.appendCaption('hello', 'world'), 'hello world');
  assert.equal(lc.appendCaption('hello', '   '), 'hello');
  assert.equal(lc.appendCaption('مرحبا', 'بالعالم'), 'مرحبا بالعالم');
  let acc = '';
  for (let i = 0; i < 500; i++) acc = lc.appendCaption(acc, `phrase number ${i}`);
  assert.ok(acc.length <= lc.CAPTION_MAX_CHARS && acc.endsWith('phrase number 499'));
});

test('splitResults: final vs interim from resultIndex', () => {
  const r = (transcript: string, isFinal: boolean) => ({ isFinal, length: 1, 0: { transcript } });
  const list = { length: 3, 0: r('old final', true), 1: r(' new  final ', true), 2: r('still talking', false) };
  assert.deepEqual(lc.splitResults(list, 1), { final: 'new final', interim: 'still talking' });
  assert.deepEqual(lc.splitResults(list, 0), { final: 'old final new final', interim: 'still talking' });
  assert.deepEqual(lc.splitResults({ length: 1, 0: { isFinal: false, length: 0 } } as never, 0), { final: '', interim: '' });
  assert.deepEqual(lc.splitResults({ length: 0 }, 0), { final: '', interim: '' });
});

test('classifySpeechError: silence/abort ignored, permission problems disable, network backs off', () => {
  assert.equal(lc.classifySpeechError('no-speech'), 'ignore');
  assert.equal(lc.classifySpeechError('aborted'), 'ignore');
  for (const c of ['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported']) assert.equal(lc.classifySpeechError(c), 'disable', c);
  assert.equal(lc.classifySpeechError('network'), 'backoff');
  assert.equal(lc.classifySpeechError(undefined), 'backoff');
});

test('nextRestart: quick restart after healthy sessions, exponential backoff, caps', () => {
  let s = { fastFails: 0, total: 0 };
  // Healthy (long) sessions: always a short delay, never give up early.
  for (let i = 0; i < 50; i++) {
    const n = lc.nextRestart(s, 8000, false);
    assert.equal(n.delayMs, 250);
    s = n.state;
  }
  assert.equal(s.fastFails, 0);

  // Fast failures back off and stop.
  s = { fastFails: 0, total: 0 };
  const delays: (number | null)[] = [];
  for (let i = 0; i < 10; i++) {
    const n = lc.nextRestart(s, 100, false);
    delays.push(n.delayMs);
    s = n.state;
  }
  assert.deepEqual(delays.slice(0, 6), [500, 1000, 2000, 4000, 8000, 8000]);
  assert.equal(delays[lc.MAX_FAST_FAILS], null, 'gives up after MAX_FAST_FAILS');
  assert.ok(delays.slice(lc.MAX_FAST_FAILS).every((d) => d === null));

  // An error counts as a failure even if the session was long.
  assert.equal(lc.nextRestart({ fastFails: 0, total: 0 }, 9000, true).delayMs, 500);
  // A healthy session resets the streak.
  assert.equal(lc.nextRestart({ fastFails: 5, total: 5 }, 9000, false).state.fastFails, 0);
  // Hard cap per question.
  assert.equal(lc.nextRestart({ fastFails: 0, total: lc.MAX_RESTARTS_PER_QUESTION }, 9000, false).delayMs, null);
});

test('captionsAllowedOnDevice: desktop with the API only', () => {
  const chromeWin = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
  const safariMac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
  assert.equal(lc.captionsAllowedOnDevice({ hasApi: true, userAgent: chromeWin }), true);
  assert.equal(lc.captionsAllowedOnDevice({ hasApi: true, userAgent: safariMac, platform: 'MacIntel', maxTouchPoints: 0 }), true);
  assert.equal(lc.captionsAllowedOnDevice({ hasApi: false, userAgent: chromeWin }), false, 'Firefox: no API');
  assert.equal(lc.captionsAllowedOnDevice({ hasApi: true, userAgent: safariMac, platform: 'MacIntel', maxTouchPoints: 5 }), false, 'iPadOS');
  assert.equal(lc.captionsAllowedOnDevice({ hasApi: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/131.0 Mobile Safari/537.36' }), false);
  assert.equal(lc.captionsAllowedOnDevice({ hasApi: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148' }), false);
});

test('panel contrast: white and dimmed panel text pass WCAG AA on the worst-case (white) frame', () => {
  const white = [255, 255, 255];
  const black = [0, 0, 0];
  for (const frame of [white, black, [255, 230, 0], [128, 128, 128]]) {
    const bg = lc.blend(black, lc.PANEL_BG_ALPHA, frame);
    assert.ok(lc.contrastRatio(white, bg) >= 4.5, `white on ${frame}`);
    // text-white/70 (labels, interim captions) is the dimmest text in the panel.
    assert.ok(lc.contrastRatio(lc.blend(white, 0.7, bg), bg) >= 4.5, `white/70 on ${frame}`);
  }
  assert.ok(Math.abs(lc.contrastRatio(white, black) - 21) < 0.01);
});

test('panelText: EN + AR, no vendor names, required captions note', () => {
  const en = lc.panelText('en');
  const ar = lc.panelText('ar');
  assert.equal(en.captionsNote, 'Live preview. Your final transcript is generated after you finish.');
  assert.match(ar.captionsNote, /[؀-ۿ]/);
  assert.equal(en.questionOf(2, 5), 'Question 2 of 5');
  assert.equal(ar.questionOf(2, 5), 'السؤال 2 من 5');
  for (const t of [en, ar]) {
    assert.doesNotMatch(JSON.stringify(t), /Google|Chrome|Apple|Safari|Microsoft|Deepgram|Gemini/);
    for (const [k, v] of Object.entries(t)) if (typeof v === 'string') assert.ok(v.length > 0, k);
  }
});
