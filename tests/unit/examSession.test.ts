/**
 * Unit tests for lib/examSession.ts: session tokens, session state, server-side scoring.
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as ExamSessionModule from '../../lib/examSession';
import type * as ExamPublicModule from '../../lib/examPublic';

const es: typeof ExamSessionModule = await import(new URL('../../lib/examSession.ts', import.meta.url).href);
const ep: typeof ExamPublicModule = await import(new URL('../../lib/examPublic.ts', import.meta.url).href);

// ── Token hashing / comparison ─────────────────────────────────────

test('generateSessionToken: 32 random bytes (base64url), stores only the SHA-256 hex', () => {
  const { token, hash } = es.generateSessionToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(Buffer.from(token, 'base64url').length, 32);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash, es.hashSessionToken(token));
  assert.ok(!hash.includes(token));
});

test('generateSessionToken: unique per call', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) seen.add(es.generateSessionToken().token);
  assert.equal(seen.size, 200);
});

test('verifySessionToken: accepts the right token only', () => {
  const { token, hash } = es.generateSessionToken();
  assert.equal(es.verifySessionToken(token, hash), true);
  const other = es.generateSessionToken().token;
  assert.equal(es.verifySessionToken(other, hash), false);
  // One changed character
  const flipped = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
  assert.equal(es.verifySessionToken(flipped, hash), false);
});

test('verifySessionToken: rejects malformed tokens and hashes without throwing', () => {
  const { token, hash } = es.generateSessionToken();
  for (const badToken of [undefined, null, '', 'short', 123, {}, `${token}!`, 'x'.repeat(500), hash]) {
    assert.equal(es.verifySessionToken(badToken, hash), false, `token ${String(badToken).slice(0, 20)}`);
  }
  for (const badHash of [undefined, null, '', 'abc', hash.toUpperCase(), hash.slice(0, 63), `${hash}0`, token]) {
    assert.equal(es.verifySessionToken(token, badHash), false, `hash ${String(badHash).slice(0, 20)}`);
  }
});

// ── Session state ──────────────────────────────────────────────────

const NOW = Date.UTC(2026, 10, 26, 12, 0, 0);
const started = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const openExam = { status: 'published', end_time: null };

test('session state: in-progress, fresh, open exam -> ok', () => {
  assert.deepEqual(es.checkSessionState({ status: 'in_progress', started_at: started(60_000) }, openExam, { now: NOW }), { ok: true });
});

test('session state: finished sessions are rejected with 409 (no resubmits)', () => {
  for (const status of ['completed', 'pending_review', 'evaluation_failed']) {
    const r = es.checkSessionState({ status, started_at: started(60_000) }, openExam, { now: NOW });
    assert.deepEqual(r, { ok: false, reason: 'completed', httpStatus: 409 });
    // allowExpired never re-opens a finished session
    assert.equal(es.checkSessionState({ status, started_at: started(60_000) }, openExam, { now: NOW, allowExpired: true }).ok, false);
  }
});

test('session state: unknown status -> not_in_progress', () => {
  assert.deepEqual(es.checkSessionState({ status: 'weird', started_at: started(1) }, openExam, { now: NOW }), {
    ok: false, reason: 'not_in_progress', httpStatus: 409,
  });
});

test('session state: older than the max age -> expired (unless allowExpired for submit)', () => {
  const s = { status: 'in_progress', started_at: started(es.SESSION_MAX_AGE_MS + 1) };
  assert.deepEqual(es.checkSessionState(s, openExam, { now: NOW }), { ok: false, reason: 'expired', httpStatus: 403 });
  assert.deepEqual(es.checkSessionState(s, openExam, { now: NOW, allowExpired: true }), { ok: true });
  assert.equal(es.checkSessionState({ status: 'in_progress', started_at: null }, openExam, { now: NOW }).ok, false);
});

test('session state: exam draft/closed or past end time (+grace) -> exam_closed', () => {
  const s = { status: 'in_progress', started_at: started(60_000) };
  assert.equal(es.checkSessionState(s, { status: 'draft', end_time: null }, { now: NOW }).ok, false);
  assert.equal(es.checkSessionState(s, { status: 'completed', end_time: null }, { now: NOW }).ok, false);
  assert.equal(es.checkSessionState(s, null, { now: NOW }).ok, false);
  const justEnded = new Date(NOW - 60_000).toISOString();
  assert.equal(es.checkSessionState(s, { status: 'published', end_time: justEnded }, { now: NOW }).ok, true, 'within grace');
  const longEnded = new Date(NOW - es.EXAM_END_GRACE_MS - 1).toISOString();
  assert.deepEqual(es.checkSessionState(s, { status: 'published', end_time: longEnded }, { now: NOW }), {
    ok: false, reason: 'exam_closed', httpStatus: 403,
  });
});

test('session-visible statuses match lib/examPublic', () => {
  for (const s of ['published', 'active', 'draft', 'completed']) {
    const viaSession = es.checkSessionState({ status: 'in_progress', started_at: started(1) }, { status: s, end_time: null }, { now: NOW }).ok;
    assert.equal(viaSession, ep.isStudentVisibleStatus(s), s);
  }
});

// ── Clamping / sanitising client input ─────────────────────────────

test('clampTabSwitchCount: plain integer 0..1000', () => {
  assert.equal(es.clampTabSwitchCount(2), 2);
  assert.equal(es.clampTabSwitchCount('3'), 3);
  assert.equal(es.clampTabSwitchCount(2.9), 2);
  assert.equal(es.clampTabSwitchCount(-5), 0);
  assert.equal(es.clampTabSwitchCount(1e9), 1000);
  assert.equal(es.clampTabSwitchCount('abc'), null);
  assert.equal(es.clampTabSwitchCount({ evil: true }), null);
  assert.equal(es.clampTabSwitchCount(undefined), null);
});

test('sanitizeFlaggedReason: allow-list only', () => {
  assert.equal(es.sanitizeFlaggedReason('multiple_tab_switches'), 'multiple_tab_switches');
  assert.equal(es.sanitizeFlaggedReason('<script>alert(1)</script>'), 'flagged');
  assert.equal(es.sanitizeFlaggedReason(undefined), null);
});

test('clampScore: integers 0..100 or null', () => {
  assert.equal(es.clampScore(87.6), 88);
  assert.equal(es.clampScore(150), 100);
  assert.equal(es.clampScore(-3), 0);
  assert.equal(es.clampScore('72'), 72);
  assert.equal(es.clampScore('high'), null);
  assert.equal(es.clampScore(null), null);
});

// ── Final score computation ────────────────────────────────────────

const mcqKey = (options: string[], correctOptionIndex: number) => JSON.stringify({ options, correctOptionIndex, explanation: 'why' });
const mcqQuestions = [
  { id: 'q1', question_text: 'Q1', order_index: 0, model_answer_text: mcqKey(['a', 'b', 'c', 'd'], 1) },
  { id: 'q2', question_text: 'Q2', order_index: 1, model_answer_text: mcqKey(['a', 'b', 'c', 'd'], 3) },
];

test('MCQ: scored from the DB answer key and the student choices', () => {
  const r = es.computeFinalResult({
    examType: 'mcq', questions: mcqQuestions, questionResults: {},
    mcqSelections: [{ questionId: 'q1', selectedOptionIndex: 1 }, { questionId: 'q2', selectedOptionIndex: 0 }],
  });
  assert.equal(r.status, 'completed');
  assert.equal(r.aiScore, 50);
  assert.equal((r.breakdown as { totalCorrect: number }).totalCorrect, 1);
});

test('MCQ: tampered client fields (isCorrect, score, correctOptionIndex, aiScore) are ignored', () => {
  const r = es.computeFinalResult({
    examType: 'mcq', questions: mcqQuestions, questionResults: {},
    mcqSelections: [
      { questionId: 'q1', selectedOptionIndex: 0, isCorrect: true, score: 100, correctOptionIndex: 0, aiScore: 100 },
      { questionId: 'q2', selectedOptionIndex: 99 },          // out of range -> no answer
      { questionId: 'q2', selectedOptionIndex: '3' },         // duplicate/non-integer ignored (first match wins)
    ],
  });
  assert.equal(r.aiScore, 0);
  const qs = (r.breakdown as { questionScores: { selectedOptionIndex: number | null; isCorrect: boolean }[] }).questionScores;
  assert.equal(qs[0].isCorrect, false);
  assert.equal(qs[1].selectedOptionIndex, null);
});

test('MCQ: no selections -> 0 (not missing)', () => {
  const r = es.computeFinalResult({ examType: 'mcq', questions: mcqQuestions, questionResults: {}, mcqSelections: 'garbage' });
  assert.equal(r.aiScore, 0);
  assert.equal(r.status, 'completed');
});

const mediaQuestions = [
  { id: 'a1', question_text: 'Speak 1', order_index: 0, model_answer_text: 'x' },
  { id: 'a2', question_text: 'Speak 2', order_index: 1, model_answer_text: 'y' },
  { id: 'a3', question_text: 'Speak 3', order_index: 2, model_answer_text: 'z' },
];

test('audio: average over ALL questions from stored results; skipped questions count 0', () => {
  const r = es.computeFinalResult({
    examType: 'audio', questions: mediaQuestions,
    questionResults: {
      a1: { status: 'graded', score: 90, breakdown: { contentScore: 80, fluencyScore: 70, vocabularyScore: 60, grammarScore: 50 }, transcript: 'one' },
      a2: { status: 'no_speech', score: 0, transcript: '' },
      // a3 never answered
    },
  });
  assert.equal(r.status, 'completed');
  assert.equal(r.aiScore, 30); // (90 + 0 + 0) / 3
  const b = r.breakdown as { contentScore: number; questions: { status: string }[]; questionScores?: unknown };
  assert.equal(b.contentScore, 80);
  assert.deepEqual(b.questions.map((q) => q.status), ['graded', 'no_speech', 'not_answered']);
  assert.equal(b.questionScores, undefined, 'audio must not use the MCQ questionScores key');
});

test('audio: any pending question -> pending_review with no score', () => {
  const r = es.computeFinalResult({
    examType: 'video', questions: mediaQuestions,
    questionResults: {
      a1: { status: 'graded', score: 100 },
      a2: { status: 'pending_review', score: null },
      a3: { transcriptionStatus: 'failed' },
    },
  });
  assert.equal(r.status, 'pending_review');
  assert.equal(r.aiScore, null);
});

test('audio: transcribed-but-never-graded -> pending (no free pass, no zero)', () => {
  const r = es.computeFinalResult({ examType: 'audio_video', questions: [mediaQuestions[0]], questionResults: { a1: { status: 'transcribed', transcript: 'hi' } } });
  assert.equal(r.status, 'pending_review');
  assert.equal(r.aiScore, null);
});

test('audio: a stored score outside 0..100 is clamped; a non-numeric "graded" score is not trusted', () => {
  const r1 = es.computeFinalResult({ examType: 'audio', questions: [mediaQuestions[0]], questionResults: { a1: { status: 'graded', score: 400 } } });
  assert.equal(r1.aiScore, 100);
  const r2 = es.computeFinalResult({
    examType: 'audio', questions: [mediaQuestions[0]],
    questionResults: { a1: { status: 'graded', score: 'lots' as unknown as number } },
  });
  assert.equal(r2.aiScore, 0); // treated as not answered, never as a free score
});

test('essay: pending_review, no score, answers kept (length-capped)', () => {
  const essayQs = [{ id: 'e1', question_text: 'Essay?', order_index: 0, model_answer_text: 'secret' }];
  const r = es.computeFinalResult({
    examType: 'essay', questions: essayQs, questionResults: {},
    essayAnswers: [{ questionId: 'e1', text: 'x'.repeat(es.MAX_ESSAY_ANSWER_CHARS + 500) }],
  });
  assert.equal(r.status, 'pending_review');
  assert.equal(r.aiScore, null);
  const answer = (r.breakdown as { essayAnswers: { answer: string }[] }).essayAnswers[0].answer;
  assert.equal(answer.length, es.MAX_ESSAY_ANSWER_CHARS);
  assert.ok(!r.transcript.includes('secret'));
});

test('unknown exam type or no questions never invents a score', () => {
  assert.equal(es.computeFinalResult({ examType: 'hologram', questions: mcqQuestions, questionResults: {} }).aiScore, null);
  assert.equal(es.computeFinalResult({ examType: 'mcq', questions: [], questionResults: {} }).aiScore, null);
  assert.equal(es.computeFinalResult({ examType: 'audio', questions: [], questionResults: {} }).aiScore, null);
});

test('isFinalQuestionResult: graded/no_speech/pending are final; transcribed is not', () => {
  assert.equal(es.isFinalQuestionResult({ status: 'graded' }), true);
  assert.equal(es.isFinalQuestionResult({ status: 'no_speech' }), true);
  assert.equal(es.isFinalQuestionResult({ status: 'pending_review' }), true);
  assert.equal(es.isFinalQuestionResult({ status: 'transcribed' }), false);
  assert.equal(es.isFinalQuestionResult(undefined), false);
});

test('parseMcqKey: reads JSON key; safe defaults otherwise', () => {
  assert.deepEqual(es.parseMcqKey(mcqKey(['x', 'y'], 1)), { options: ['x', 'y'], correctIndex: 1, explanation: 'why' });
  assert.deepEqual(es.parseMcqKey('plain text'), { options: ['Option A', 'Option B', 'Option C', 'Option D'], correctIndex: 0, explanation: '' });
  assert.equal(es.parseMcqKey(mcqKey(['x', 'y'], 7)).correctIndex, 0);
});
