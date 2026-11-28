/**
 * POST /api/exam/submit for ESSAY exams with ESSAY_AI_GRADING_ENABLED off/on, against
 * the in-memory database that enforces the live schema. The AI call is a mock
 * (essayAiTestHooks). Fictional data only. Run with: npm run test:unit
 */
import '../lib/routeHooks.ts';
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type * as FakeDbModule from '../lib/fakeSupabaseAdmin';
import type * as ExamSessionModule from '../../lib/examSession';
import type * as SummaryModule from '../../lib/sessionSummary';
import type * as EssayModule from '../../lib/essayGrading';

const fake: typeof FakeDbModule = await import(new URL('../lib/fakeSupabaseAdmin.ts', import.meta.url).href);
const es: typeof ExamSessionModule = await import(new URL('../../lib/examSession.ts', import.meta.url).href);
const summary: typeof SummaryModule = await import(new URL('../../lib/sessionSummary.ts', import.meta.url).href);
const eg: typeof EssayModule = await import(new URL('../../lib/essayGrading.ts', import.meta.url).href);
const route = await import(new URL('../../app/api/exam/submit/route.ts', import.meta.url).href);

const EXAM_ID = '063c6d5f-0dce-4965-9873-ab6c5306bd9a';
const MODEL_ID = '11111111-1111-4111-8111-111111111111';
const Q1 = '33333333-3333-4333-8333-333333333331';
const Q2 = '33333333-3333-4333-8333-333333333332';

let token = '';
let sessionId = '';
let calls: string[] = [];
let reply: () => Promise<{ text: string }> = async () => ({ text: '{"score": 80, "rationale": "Good."}' });

beforeEach(() => {
  // A fresh session id per test: the route allows one AI grading run per session.
  sessionId = randomUUID();
  const t = es.generateSessionToken();
  token = t.token;
  calls = [];
  fake.resetFakeDb({
    exams: [{ id: EXAM_ID, exam_type: 'essay', status: 'published', end_time: null, language: 'en', wrong_language_policy: 'review' }],
    questions: [
      { id: Q1, exam_model_id: MODEL_ID, question_text: 'Explain photosynthesis.', model_answer_text: 'Light, water and CO2 become sugar and oxygen.', order_index: 0, time_limit_seconds: 60 },
      { id: Q2, exam_model_id: MODEL_ID, question_text: 'Name one organelle.', model_answer_text: 'Mitochondrion', order_index: 1, time_limit_seconds: 60 },
    ],
    student_sessions: [
      {
        id: sessionId, exam_id: EXAM_ID, exam_model_id: MODEL_ID, student_name: 'Rana Fictional', student_code: 'S1',
        started_at: new Date().toISOString(), completed_at: null, recording_url: null, transcript: null,
        ai_score: null, teacher_override_score: null, status: 'in_progress', session_token_hash: t.hash,
        question_results: {}, ended_by_tab_switch: false, tab_switch_count: 0,
      },
    ],
  });
  eg.essayAiTestHooks.generate = async (args) => {
    calls.push(args.contents);
    return reply();
  };
});

afterEach(() => {
  delete process.env.ESSAY_AI_GRADING_ENABLED;
  eg.essayAiTestHooks.generate = null;
  reply = async () => ({ text: '{"score": 80, "rationale": "Good."}' });
});

const submit = (essayAnswers: unknown) =>
  route.POST(
    new Request('http://localhost/api/exam/submit', {
      method: 'POST',
      body: JSON.stringify({ sessionId, token, essayAnswers }),
      headers: { 'content-type': 'application/json' },
    })
  );
const row = () => fake.fakeDb.tables.student_sessions[0];
const answers = [
  { questionId: Q1, text: 'I am Rana Fictional. Plants use light to make sugar.' },
  { questionId: Q2, text: '' },
];

test('flag OFF (default): no AI call, essay stays pending_review exactly as before', async () => {
  const res = await submit(answers);
  assert.equal(res.status, 200, await res.clone().text());
  assert.equal(calls.length, 0);
  const r = row();
  assert.equal(r.status, 'pending_review');
  assert.equal(r.ai_score, null);
  assert.equal(r.review_reason, 'essay_manual');
  const s = summary.readResultSummary(r)!;
  assert.equal(s.essayAiGrading, undefined);
  assert.equal((s.essayAnswers as { aiSuggestion?: unknown }[])[0].aiSuggestion, undefined);
});

test('flag ON: suggestion stored for the teacher; still pending_review with ai_score NULL; no name sent', async () => {
  process.env.ESSAY_AI_GRADING_ENABLED = 'true';
  const res = await submit(answers);
  assert.equal(res.status, 200, await res.clone().text());
  const body = await res.json();
  assert.equal(body.score, undefined, 'the student never receives a score');
  assert.equal(calls.length, 1, 'the empty answer is not sent');
  assert.ok(!calls[0].includes('Rana') && !calls[0].includes('Fictional'), calls[0].slice(calls[0].indexOf('<student_answer>'), calls[0].indexOf('</student_answer>')));
  const r = row();
  assert.equal(r.status, 'pending_review');
  assert.equal(r.ai_score, null);
  assert.equal(r.teacher_override_score, null);
  assert.equal(r.review_reason, 'essay_ai_suggested');
  const s = summary.readResultSummary(r)!;
  assert.equal(s.essayAiGrading, 'suggested');
  assert.equal(s.aiSuggestedScore, 40);
  const ea = s.essayAnswers as { aiSuggestion?: { status: string; score: number | null; rationale: string | null } }[];
  assert.deepEqual(ea[0].aiSuggestion, { status: 'suggested', score: 80, rationale: 'Good.', truncated: false });
  assert.equal(ea[1].aiSuggestion?.status, 'no_answer');
});

test('flag ON + AI invalid reply: submission succeeds, visible reason, no score', async () => {
  process.env.ESSAY_AI_GRADING_ENABLED = 'true';
  reply = async () => ({ text: 'I give this a 100' });
  const res = await submit(answers);
  assert.equal(res.status, 200);
  const r = row();
  assert.equal(r.status, 'pending_review');
  assert.equal(r.ai_score, null);
  assert.equal(r.review_reason, 'essay_ai_unavailable');
});

test('flag ON + AI throws synchronously-wrapped error: submission still succeeds', async () => {
  process.env.ESSAY_AI_GRADING_ENABLED = 'true';
  reply = async () => {
    throw new Error('provider down');
  };
  const res = await submit(answers);
  assert.equal(res.status, 200);
  assert.equal(row().review_reason, 'essay_ai_unavailable');
});

test('flag ON: re-submit after completion gets 409 and makes no second AI call', async () => {
  process.env.ESSAY_AI_GRADING_ENABLED = 'true';
  assert.equal((await submit(answers)).status, 200);
  assert.equal(calls.length, 1);
  const again = await submit(answers);
  assert.equal(again.status, 409);
  assert.equal(calls.length, 1);
});

test('flag ON: an existing teacher override is never touched by the AI', async () => {
  process.env.ESSAY_AI_GRADING_ENABLED = 'true';
  row().teacher_override_score = 65;
  assert.equal((await submit(answers)).status, 200);
  assert.equal(row().teacher_override_score, 65);
  assert.equal(row().ai_score, null);
});
