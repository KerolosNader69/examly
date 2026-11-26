/**
 * POST /api/exam/submit against an in-memory database that enforces the LIVE schema
 * (tests/lib/fakeSupabaseAdmin.ts + tests/fixtures/live-schema.json).
 * Run with: npm run test:unit
 *
 * Regression: the route used to write ai_score_breakdown / flagged_reason, which the
 * live DB doesn't have, so PostgREST rejected the update and every submit got 500.
 */
import '../lib/routeHooks.ts';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type * as FakeDbModule from '../lib/fakeSupabaseAdmin';
import type * as ExamSessionModule from '../../lib/examSession';
import type * as SummaryModule from '../../lib/sessionSummary';

const fake: typeof FakeDbModule = await import(new URL('../lib/fakeSupabaseAdmin.ts', import.meta.url).href);
const es: typeof ExamSessionModule = await import(new URL('../../lib/examSession.ts', import.meta.url).href);
const summary: typeof SummaryModule = await import(new URL('../../lib/sessionSummary.ts', import.meta.url).href);
const route = await import(new URL('../../app/api/exam/submit/route.ts', import.meta.url).href);

const EXAM_ID = '063c6d5f-0dce-4965-9873-ab6c5306bd9a';
const MODEL_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const Q1 = '33333333-3333-4333-8333-333333333331';
const Q2 = '33333333-3333-4333-8333-333333333332';
const CORRECT = 1;

let token = '';

beforeEach(() => {
  const t = es.generateSessionToken();
  token = t.token;
  const key = (correct: number) => JSON.stringify({ options: ['A', 'B', 'C', 'D'], correctOptionIndex: correct, explanation: 'x' });
  fake.resetFakeDb({
    exams: [{ id: EXAM_ID, exam_type: 'mcq', status: 'published', end_time: null, language: 'en', wrong_language_policy: 'review' }],
    questions: [
      { id: Q1, exam_model_id: MODEL_ID, question_text: 'Q1?', model_answer_text: key(CORRECT), order_index: 0, time_limit_seconds: 60 },
      { id: Q2, exam_model_id: MODEL_ID, question_text: 'Q2?', model_answer_text: key(CORRECT), order_index: 1, time_limit_seconds: 60 },
    ],
    student_sessions: [
      {
        // A row shaped exactly like the live table (no tab_switch_count before 006 is fine:
        // the fixture includes it, matching the post-006 schema the code targets).
        id: SESSION_ID, exam_id: EXAM_ID, exam_model_id: MODEL_ID, student_name: 'Test Student', student_code: 'S1',
        started_at: new Date().toISOString(), completed_at: null, recording_url: null, transcript: null,
        ai_score: null, teacher_override_score: null, status: 'in_progress', session_token_hash: t.hash,
        question_results: {}, ended_by_tab_switch: false, tab_switch_count: 0,
      },
    ],
  });
});

const submit = (body: Record<string, unknown>) =>
  route.POST(new Request('http://localhost/api/exam/submit', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }));
const row = () => fake.fakeDb.tables.student_sessions[0];
const mcq = (a: number, b: number) => [{ questionId: Q1, selectedOptionIndex: a }, { questionId: Q2, selectedOptionIndex: b }];

test('MCQ all correct: 200, score 100 from the DB key, summary stored in question_results', async () => {
  const res = await submit({ sessionId: SESSION_ID, token, mcqItems: mcq(CORRECT, CORRECT), tabSwitchCount: 1 });
  assert.equal(res.status, 200, await res.clone().text());
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.score, undefined, 'score must not be returned to the student');
  assert.equal(row().status, 'completed');
  assert.equal(row().ai_score, 100);
  assert.equal(row().tab_switch_count, 1);
  const s = summary.readResultSummary(row());
  assert.equal(s?.totalCorrect, 2);
  assert.equal(s?.tab_switch_count, 1);
  assert.equal(summary.sessionTabSwitchCount(row()), 1);
});

test('MCQ one wrong: 50', async () => {
  const res = await submit({ sessionId: SESSION_ID, token, mcqItems: mcq(CORRECT, 0) });
  assert.equal(res.status, 200);
  assert.equal(row().ai_score, 50);
  assert.equal(summary.readResultSummary(row())?.totalCorrect, 1);
});

test('client-supplied aiScore / aiScoreBreakdown / transcript are ignored', async () => {
  const res = await submit({
    sessionId: SESSION_ID, token, mcqItems: mcq(0, 0),
    aiScore: 100, aiScoreBreakdown: { totalCorrect: 2 }, ai_score: 100, transcript: 'I got everything right',
  });
  assert.equal(res.status, 200);
  assert.equal(row().ai_score, 0);
  assert.equal(summary.readResultSummary(row())?.totalCorrect, 0);
  assert.ok(!String(row().transcript).includes('everything right'));
});

test('double submit: second gets 409 and changes nothing', async () => {
  assert.equal((await submit({ sessionId: SESSION_ID, token, mcqItems: mcq(CORRECT, CORRECT) })).status, 200);
  const before = structuredClone(row());
  const second = await submit({ sessionId: SESSION_ID, token, mcqItems: mcq(0, 0) });
  assert.equal(second.status, 409);
  assert.equal((await second.json()).alreadySubmitted, true);
  assert.deepEqual(row(), before);
});

test('parallel submits: exactly one wins', async () => {
  const [a, b] = await Promise.all([
    submit({ sessionId: SESSION_ID, token, mcqItems: mcq(CORRECT, CORRECT) }),
    submit({ sessionId: SESSION_ID, token, mcqItems: mcq(0, 0) }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
});

test('missing or wrong token: 401, session untouched', async () => {
  for (const body of [{ sessionId: SESSION_ID }, { sessionId: SESSION_ID, token: 'x'.repeat(43) }, { sessionId: 'nope', token }]) {
    const res = await submit({ ...body, mcqItems: mcq(CORRECT, CORRECT) });
    assert.equal(res.status, 401, JSON.stringify(body));
  }
  assert.equal(row().status, 'in_progress');
  assert.equal(row().ai_score, null);
});

test('tab-switch termination: flagged, count stored, summary keeps flaggedReason', async () => {
  const res = await submit({
    sessionId: SESSION_ID, token, mcqItems: [{ questionId: Q1, selectedOptionIndex: CORRECT }],
    tabSwitchCount: 2, flaggedReason: 'multiple_tab_switches', endedByTabSwitch: true,
  });
  assert.equal(res.status, 200);
  assert.equal(row().ended_by_tab_switch, true);
  assert.equal(row().tab_switch_count, 2);
  assert.equal(row().ai_score, 50);
  const s = summary.readResultSummary(row());
  assert.equal(s?.flaggedReason, 'multiple_tab_switches');
  assert.equal(s?.ended_by_tab_switch, true);
});

test('existing per-question results are kept when the summary is added', async () => {
  row().question_results = { [Q1]: { status: 'graded', score: 80, recordingPath: 'recordings/x.webm' } };
  await submit({ sessionId: SESSION_ID, token, mcqItems: mcq(CORRECT, CORRECT) });
  assert.equal(row().question_results[Q1].recordingPath, 'recordings/x.webm');
  assert.ok(row().question_results[summary.RESULT_SUMMARY_KEY]);
});

test('the fake DB really enforces the live schema (guards the regression above)', async () => {
  const { supabaseAdmin } = fake;
  const { error } = await supabaseAdmin.from('student_sessions').update({ ai_score_breakdown: {} }).eq('id', SESSION_ID).select('id').maybeSingle();
  assert.equal(error?.code, 'PGRST204');
  assert.match(error?.message ?? '', /ai_score_breakdown/);
  assert.equal(row().status, 'in_progress');
});

test('sessionSummary helpers tolerate older rows (no summary, no tab_switch_count)', () => {
  assert.equal(summary.readResultSummary({ question_results: {} }), null);
  assert.equal(summary.readResultSummary({ question_results: null }), null);
  assert.equal(summary.readResultSummary({}), null);
  assert.equal(summary.sessionTabSwitchCount({ question_results: {} }), 0);
  assert.equal(summary.sessionTabSwitchCount({ tab_switch_count: 3 }), 3);
});
