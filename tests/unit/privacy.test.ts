/**
 * Pure helpers for the privacy work: consent notice/parsing (lib/consent.ts), review
 * reasons (lib/reviewReason.ts), recording retention (lib/recordingRetention.ts) and the
 * cron secret check (lib/cronAuth.ts). Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as ConsentModule from '../../lib/consent';
import type * as ReviewModule from '../../lib/reviewReason';
import type * as RetentionModule from '../../lib/recordingRetention';
import type * as CronAuthModule from '../../lib/cronAuth';

const consent: typeof ConsentModule = await import(new URL('../../lib/consent.ts', import.meta.url).href);
const review: typeof ReviewModule = await import(new URL('../../lib/reviewReason.ts', import.meta.url).href);
const ret: typeof RetentionModule = await import(new URL('../../lib/recordingRetention.ts', import.meta.url).href);
const cron: typeof CronAuthModule = await import(new URL('../../lib/cronAuth.ts', import.meta.url).href);

const SID = '22222222-2222-4222-8222-222222222222';
const Q1 = '33333333-3333-4333-8333-333333333331';
const Q2 = '33333333-3333-4333-8333-333333333332';

// ─── Consent ────────────────────────────────────────────────────────────────

test('examRecords: audio/video/audio_video and missing type record; mcq/essay do not', () => {
  for (const t of ['audio', 'video', 'audio_video', null, undefined, '']) assert.equal(consent.examRecords(t), true, String(t));
  for (const t of ['mcq', 'essay', 'other']) assert.equal(consent.examRecords(t), false, t);
  assert.equal(consent.examRecordsVideo('video'), true);
  assert.equal(consent.examRecordsVideo('audio'), false);
});

test('parseConsent: only { accepted: true, version: current } counts', () => {
  // Bumped for the live-captions disclosure; the previous version no longer counts.
  assert.equal(consent.CONSENT_VERSION, '2026-11-v2');
  assert.equal(consent.parseConsent({ accepted: true, version: '2026-11-v1' }), null);
  assert.deepEqual(consent.parseConsent({ accepted: true, version: consent.CONSENT_VERSION }), { version: consent.CONSENT_VERSION });
  for (const bad of [
    null, undefined, true, 'yes', [], {}, { accepted: true }, { accepted: 'true', version: consent.CONSENT_VERSION },
    { accepted: true, version: '2020-01-v0' }, { accepted: false, version: consent.CONSENT_VERSION },
  ]) {
    assert.equal(consent.parseConsent(bad), null, JSON.stringify(bad));
  }
});

test('consent notice: EN + AR, retention days, processors, video wording, Arabic for Arabic exams', () => {
  assert.equal(consent.RECORDING_RETENTION_DAYS, 90);
  assert.equal(consent.noticeLangForExam('ar-EG'), 'ar');
  assert.equal(consent.noticeLangForExam('en'), 'en');
  assert.equal(consent.noticeLangForExam(undefined), 'en');
  for (const lang of ['en', 'ar'] as const) {
    const text = consent.consentNotice(lang, { video: false });
    const all = text.items.map((i) => i.text).join(' ');
    assert.equal(text.items.length, 3);
    assert.ok(all.includes('90'), `${lang}: retention days`);
    // Processors are disclosed by category, never by vendor name.
    const categories = lang === 'en' ? ['speech-to-text provider', 'AI grading provider'] : ['تحويل الكلام إلى نص', 'التصحيح بالذكاء الاصطناعي'];
    for (const c of categories) assert.ok(all.includes(c), `${lang}: ${c}`);
    assert.doesNotMatch(JSON.stringify(text), /Deepgram|Gemini|Google|Supabase|Vercel/, `${lang}: vendor name`);
    assert.ok(text.checkbox && text.privacyLink && text.required);
  }
  assert.match(consent.consentNotice('en', { video: true }).items[0].text, /video/);
  assert.doesNotMatch(consent.consentNotice('en', { video: false }).items[0].text, /video/);
  assert.match(consent.consentNotice('ar', { video: false }).title, /[؀-ۿ]/);
});

test('consent notice: video exams disclose live captions (EN + AR), audio exams do not', () => {
  for (const lang of ['en', 'ar'] as const) {
    const video = consent.consentNotice(lang, { video: true });
    assert.equal(video.items.length, 4, lang);
    assert.equal(video.items[3].text, consent.LIVE_CAPTIONS_NOTICE[lang]);
    assert.doesNotMatch(JSON.stringify(video), /Google|Chrome|Apple|Safari|Microsoft|Deepgram|Gemini/, `${lang}: vendor name`);
    assert.equal(consent.consentNotice(lang, { video: false }).items.length, 3, `${lang}: audio-only has no captions`);
  }
  assert.match(consent.LIVE_CAPTIONS_NOTICE.en, /browser's speech service/);
  assert.match(consent.LIVE_CAPTIONS_NOTICE.en, /not stored by Examly/);
  assert.match(consent.LIVE_CAPTIONS_NOTICE.ar, /لا يحفظه Examly/);
});

// ─── Review reason ──────────────────────────────────────────────────────────

const pendingQ = (extra: Record<string, unknown>) => ({ status: 'pending_review', ...extra });

test('reviewReasonFromSummary: maps stored question data to one teacher label', () => {
  const r = (questions: unknown[], type = 'audio') => review.reviewReasonFromSummary(type, { questions, pending_review: true });
  assert.equal(r([pendingQ({ reviewReason: 'wrong_language', languageReasons: ['foreign_script'] })]), 'wrong_language');
  assert.equal(r([pendingQ({ reviewReason: 'wrong_language', languageReasons: ['grader_wrong_language', 'low_confidence'] })]), 'wrong_language');
  assert.equal(r([pendingQ({ reviewReason: 'wrong_language', languageReasons: ['low_confidence'] })]), 'unclear_audio');
  assert.equal(r([pendingQ({ reviewReason: 'wrong_language', languageReasons: ['low_word_confidence', 'grader_incoherent'] })]), 'unclear_audio');
  assert.equal(r([pendingQ({ failureReason: 'stt_timeout' })]), 'transcription_unavailable');
  assert.equal(r([pendingQ({ reviewReason: 'grading_unavailable' })]), 'grading_unavailable');
  assert.equal(r([pendingQ({})]), 'grading_incomplete');
  // Several pending questions: the most specific reason wins; graded ones are ignored.
  assert.equal(
    r([{ status: 'graded', score: 80 }, pendingQ({ reviewReason: 'grading_unavailable' }), pendingQ({ reviewReason: 'wrong_language', languageReasons: ['low_confidence'] })]),
    'unclear_audio'
  );
  assert.equal(review.reviewReasonFromSummary('essay', null), 'essay_manual');
  assert.equal(review.reviewReasonFromSummary('mcq', { invalidKeys: 1 }), 'answer_key_invalid');
  assert.equal(review.reviewReasonFromSummary('mcq', { totalCorrect: 2 }), null);
  assert.equal(review.reviewReasonFromSummary('audio', { questions: [{ status: 'graded' }] }), null);
});

test('labels exist for every code; sessionReviewReason prefers the stored column, only when pending', () => {
  for (const code of review.REVIEW_REASONS) assert.ok(review.reviewReasonLabel(code));
  assert.equal(review.reviewReasonLabel('unclear_audio'), 'Unclear audio');
  assert.equal(review.reviewReasonLabel('wrong_language'), 'Different language than expected');
  assert.equal(review.reviewReasonLabel('grading_unavailable'), 'AI grading unavailable');
  assert.equal(review.reviewReasonLabel('nope'), null);
  const summary = { questions: [pendingQ({ reviewReason: 'grading_unavailable' })] };
  assert.equal(review.sessionReviewReason({ status: 'pending_review', review_reason: 'unclear_audio' }, 'audio', summary), 'unclear_audio');
  assert.equal(review.sessionReviewReason({ status: 'pending_review', review_reason: null }, 'audio', summary), 'grading_unavailable');
  assert.equal(review.sessionReviewReason({ status: 'pending_review', review_reason: 'bogus' }, 'audio', summary), 'grading_unavailable');
  assert.equal(review.sessionReviewReason({ status: 'completed', review_reason: 'unclear_audio' }, 'audio', summary), null);
});

// ─── Retention ──────────────────────────────────────────────────────────────

test('isRetentionDryRun: only the exact string "false" turns deletion on', () => {
  assert.equal(ret.isRetentionDryRun({}), true);
  for (const v of ['true', 'TRUE', '0', 'no', 'False', ' false', '']) assert.equal(ret.isRetentionDryRun({ RECORDING_RETENTION_DRY_RUN: v }), true, v);
  assert.equal(ret.isRetentionDryRun({ RECORDING_RETENTION_DRY_RUN: 'false' }), false);
});

test('retentionCutoffIso: 90 days before now', () => {
  const now = Date.parse('2026-11-27T03:00:00.000Z');
  assert.equal(ret.retentionCutoffIso(now), '2026-08-29T03:00:00.000Z');
  assert.equal(ret.retentionCutoffIso(now, 1), '2026-11-26T03:00:00.000Z');
});

test('sessionRecordingPaths: stored + legacy + folder files, never other sessions\' paths', () => {
  const other = '99999999-9999-4999-8999-999999999999';
  const row = {
    id: SID,
    recording_url: `recordings/${SID}-1700000000000.webm`,
    question_results: {
      [Q1]: { recordingPath: `recordings/${SID}/${Q1}-1700000000001.webm`, transcript: 'hi' },
      [Q2]: { recordingPath: `recordings/${other}/${Q2}-1700000000002.webm` },
      _summary: { questions: [{ questionId: Q1, hasRecording: true }] },
    },
  };
  const paths = ret.sessionRecordingPaths(row, [`${Q1}-1700000000001.webm`, `${Q2}-1699999999999.mp4`, '.emptyFolderPlaceholder', '../x.webm']);
  assert.deepEqual(paths.sort(), [
    `recordings/${SID}-1700000000000.webm`,
    `recordings/${SID}/${Q1}-1700000000001.webm`,
    `recordings/${SID}/${Q2}-1699999999999.mp4`,
  ].sort());
  // A legacy URL pointing at another session is ignored.
  assert.deepEqual(ret.sessionRecordingPaths({ id: SID, recording_url: `recordings/${other}-1.webm`, question_results: {} }), []);
  assert.throws(() => ret.sessionRecordingFolder('../../etc'));
});

test('questionResultsWithoutRecordings: drops recording pointers, keeps transcripts and scores', () => {
  const qr = {
    [Q1]: { recordingPath: 'recordings/x', recordingMimeType: 'audio/webm', transcript: 'hello', score: 80, status: 'graded' },
    _summary: { questions: [{ questionId: Q1, hasRecording: true, score: 80 }], contentScore: 80 },
  };
  const out = ret.questionResultsWithoutRecordings(qr) as Record<string, unknown>;
  assert.deepEqual(out[Q1], { transcript: 'hello', score: 80, status: 'graded' });
  assert.deepEqual(out._summary, { questions: [{ questionId: Q1, hasRecording: false, score: 80 }], contentScore: 80 });
  assert.deepEqual(ret.questionResultsWithoutRecordings(null), {});
  // input not mutated
  assert.equal(qr[Q1].recordingPath, 'recordings/x');
});

test('recordingDeletedLabel: retention vs teacher', () => {
  assert.match(ret.recordingDeletedLabel('retention'), /^Recording deleted after 90 days/);
  assert.match(ret.recordingDeletedLabel('teacher', '2026-11-27T10:00:00Z'), /^Recording deleted by the teacher on /);
});

// ─── Cron auth ──────────────────────────────────────────────────────────────

test('isCronAuthorized: exact Bearer secret only; fails closed without a strong secret', () => {
  const secret = 'a-very-long-cron-secret-value';
  assert.equal(cron.isCronAuthorized(`Bearer ${secret}`, secret), true);
  for (const h of [null, undefined, '', secret, `Bearer ${secret}x`, `bearer ${secret}`, 'Bearer ']) {
    assert.equal(cron.isCronAuthorized(h, secret), false, String(h));
  }
  assert.equal(cron.isCronAuthorized('Bearer short', 'short'), false);
  assert.equal(cron.isCronAuthorized('Bearer undefined', undefined), false);
});
