/**
 * Routes of the privacy work against the in-memory, live-schema-checking database
 * (tests/lib/fakeSupabaseAdmin.ts): consent at /api/exam/join and /api/exam/upload-url,
 * the retention cron, and the teacher's "delete recording now" / recording-url.
 * Run with: npm run test:unit
 */
import '../lib/routeHooks.ts';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type * as FakeDbModule from '../lib/fakeSupabaseAdmin';
import type * as ExamSessionModule from '../../lib/examSession';
import type * as ConsentModule from '../../lib/consent';

const fake: typeof FakeDbModule = await import(new URL('../lib/fakeSupabaseAdmin.ts', import.meta.url).href);
const es: typeof ExamSessionModule = await import(new URL('../../lib/examSession.ts', import.meta.url).href);
const consent: typeof ConsentModule = await import(new URL('../../lib/consent.ts', import.meta.url).href);
const join = await import(new URL('../../app/api/exam/join/route.ts', import.meta.url).href);
const uploadUrl = await import(new URL('../../app/api/exam/upload-url/route.ts', import.meta.url).href);
const cronRoute = await import(new URL('../../app/api/cron/recording-retention/route.ts', import.meta.url).href);
const delRoute = await import(new URL('../../app/api/teacher/recording-delete/route.ts', import.meta.url).href);
const urlRoute = await import(new URL('../../app/api/teacher/recording-url/route.ts', import.meta.url).href);

const TEACHER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_TEACHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EXAM_AUDIO = '063c6d5f-0dce-4965-9873-ab6c5306bd9a';
const EXAM_MCQ = '063c6d5f-0dce-4965-9873-ab6c5306bd9b';
const MODEL_AUDIO = '11111111-1111-4111-8111-111111111111';
const MODEL_MCQ = '11111111-1111-4111-8111-111111111112';
const Q1 = '33333333-3333-4333-8333-333333333331';
const Q2 = '33333333-3333-4333-8333-333333333332';
const OLD = '44444444-4444-4444-8444-444444444441'; // consented, 100 days old
const LEGACY = '44444444-4444-4444-8444-444444444442'; // no consent (before the notice), 100 days old
const RECENT = '44444444-4444-4444-8444-444444444443'; // consented, 10 days old
const LIVE = '44444444-4444-4444-8444-444444444444'; // in progress
const SECRET = 'test-cron-secret-0123456789';

const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
const qPath = (sid: string, q: string, ts = 1700000000000) => `recordings/${sid}/${q}-${ts}.webm`;

function session(id: string, extra: Record<string, unknown> = {}) {
  return {
    id, exam_id: EXAM_AUDIO, exam_model_id: MODEL_AUDIO, student_name: `Student ${id.slice(-1)}`, student_code: 'S',
    started_at: daysAgo(100), completed_at: daysAgo(100), recording_url: null, transcript: 'Question 1: hello',
    ai_score: 70, teacher_override_score: null, status: 'completed', session_token_hash: null,
    question_results: {
      [Q1]: { recordingPath: qPath(id, Q1), recordingMimeType: 'audio/webm', transcript: 'hello', status: 'graded', score: 70 },
      _summary: { questions: [{ questionId: Q1, hasRecording: true, score: 70, transcript: 'hello' }] },
    },
    ended_by_tab_switch: false, tab_switch_count: 0,
    consent_at: daysAgo(100), consent_version: consent.CONSENT_VERSION,
    recording_deleted_at: null, recording_deleted_reason: null, review_reason: null,
    ...extra,
  };
}

let liveToken = '';
beforeEach(() => {
  const t = es.generateSessionToken();
  liveToken = t.token;
  fake.resetFakeDb(
    {
      exams: [
        { id: EXAM_AUDIO, teacher_id: TEACHER, title: 'Speaking', exam_type: 'audio', subject: null, language: 'en', status: 'published', start_time: null, end_time: null, wrong_language_policy: 'review' },
        { id: EXAM_MCQ, teacher_id: TEACHER, title: 'Quiz', exam_type: 'mcq', subject: null, language: 'en', status: 'published', start_time: null, end_time: null, wrong_language_policy: 'review' },
      ],
      exam_models: [{ id: MODEL_AUDIO, exam_id: EXAM_AUDIO, label: 'A' }, { id: MODEL_MCQ, exam_id: EXAM_MCQ, label: 'A' }],
      questions: [
        { id: Q1, exam_model_id: MODEL_AUDIO, question_text: 'Talk', model_answer_text: 'x', order_index: 0, time_limit_seconds: 60 },
        { id: Q2, exam_model_id: MODEL_MCQ, question_text: 'Pick', model_answer_text: JSON.stringify({ options: ['a', 'b'], correctOptionIndex: 0 }), order_index: 0, time_limit_seconds: 60 },
      ],
      teachers: [
        { id: TEACHER, name: 'T', email: 't@x', subdomain: 't', logo_url: null, brand_color: null, plan: 'free', status: 'active', created_at: daysAgo(200) },
        { id: OTHER_TEACHER, name: 'O', email: 'o@x', subdomain: 'o', logo_url: null, brand_color: null, plan: 'free', status: 'active', created_at: daysAgo(200) },
      ],
      student_sessions: [
        session(OLD),
        session(LEGACY, { consent_at: null, consent_version: null }),
        session(RECENT, { started_at: daysAgo(10), consent_at: daysAgo(10) }),
        session(LIVE, { started_at: new Date().toISOString(), completed_at: null, status: 'in_progress', session_token_hash: t.hash, consent_at: null, question_results: {} }),
      ],
    },
    {
      objects: [qPath(OLD, Q1), qPath(OLD, Q1, 1699999999999), qPath(LEGACY, Q1), qPath(RECENT, Q1)],
      users: { 'teacher-token': TEACHER, 'other-token': OTHER_TEACHER },
    }
  );
  process.env.CRON_SECRET = SECRET;
  delete process.env.RECORDING_RETENTION_DRY_RUN;
});

const post = (handler: { POST: (r: Request) => Promise<Response> }, url: string, body: unknown, headers: Record<string, string> = {}) =>
  handler.POST(new Request(`http://localhost${url}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } }));
const runCron = (auth: string | null = `Bearer ${SECRET}`) =>
  cronRoute.GET(new Request('http://localhost/api/cron/recording-retention', { headers: auth ? { authorization: auth } : {} }));
const row = (id: string) => fake.fakeDb.tables.student_sessions.find((s) => s.id === id)!;
const accepted = { accepted: true, version: consent.CONSENT_VERSION };

// ─── Consent ────────────────────────────────────────────────────────────────

test('join: recording exam without consent -> 400 consent_required, no session created', async () => {
  const before = fake.fakeDb.tables.student_sessions.length;
  for (const c of [undefined, { accepted: false, version: consent.CONSENT_VERSION }, { accepted: true, version: 'old' }]) {
    const res = await post(join, '/api/exam/join', { examId: EXAM_AUDIO, studentName: 'New Student', consent: c });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, 'consent_required');
  }
  assert.equal(fake.fakeDb.tables.student_sessions.length, before);
});

test('join: recording exam with consent stores consent_at + consent_version on the new session', async () => {
  const res = await post(join, '/api/exam/join', { examId: EXAM_AUDIO, studentName: 'New Student', consent: accepted });
  assert.equal(res.status, 200, await res.clone().text());
  const created = fake.fakeDb.tables.student_sessions.find((s) => s.student_name === 'New Student')!;
  assert.ok(created.consent_at && !Number.isNaN(Date.parse(created.consent_at)));
  assert.equal(created.consent_version, consent.CONSENT_VERSION);
});

test('join: MCQ exam needs no recording consent and stores none', async () => {
  const res = await post(join, '/api/exam/join', { examId: EXAM_MCQ, studentName: 'Quiz Student' });
  assert.equal(res.status, 200, await res.clone().text());
  const created = fake.fakeDb.tables.student_sessions.find((s) => s.student_name === 'Quiz Student')!;
  assert.equal(created.consent_at, null);
});

test('upload-url: refused (403) for a session without consent, even with a valid token', async () => {
  const res = await post(uploadUrl, '/api/exam/upload-url', { sessionId: LIVE, token: liveToken, questionId: Q1, mimeType: 'audio/webm' });
  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /consent/i);
  row(LIVE).consent_at = new Date().toISOString();
  const ok = await post(uploadUrl, '/api/exam/upload-url', { sessionId: LIVE, token: liveToken, questionId: Q1, mimeType: 'audio/webm' });
  assert.notEqual(ok.status, 403);
});

// ─── Retention cron ─────────────────────────────────────────────────────────

test('cron: missing or wrong secret -> 401; no CRON_SECRET configured -> 401 for everyone', async () => {
  assert.equal((await runCron(null)).status, 401);
  assert.equal((await runCron('Bearer wrong-secret-value-xxxx')).status, 401);
  delete process.env.CRON_SECRET;
  assert.equal((await runCron()).status, 401);
  assert.deepEqual(fake.fakeDb.removed, []);
});

test('cron: dry run by default counts what it WOULD delete and changes nothing', async () => {
  const res = await runCron();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.dryRun, true);
  assert.equal(body.eligibleSessions, 1); // only OLD: LEGACY has no consent, RECENT is too new
  assert.equal(body.wouldDeleteSessions, 1);
  assert.equal(body.wouldDeleteFiles, 2); // stored path + an earlier re-recorded attempt in the folder
  assert.deepEqual(fake.fakeDb.removed, []);
  assert.equal(row(OLD).recording_deleted_at, null);
  assert.equal(row(OLD).question_results[Q1].recordingPath, qPath(OLD, Q1));
});

test('cron: live run deletes the files via Storage, marks the row, keeps transcript/score; idempotent', async () => {
  process.env.RECORDING_RETENTION_DRY_RUN = 'false';
  const body = await (await runCron()).json();
  assert.equal(body.dryRun, false);
  assert.equal(body.deletedSessions, 1);
  assert.equal(body.deletedFiles, 2);
  assert.deepEqual(fake.fakeDb.removed.sort(), [qPath(OLD, Q1), qPath(OLD, Q1, 1699999999999)].sort());
  const r = row(OLD);
  assert.ok(r.recording_deleted_at);
  assert.equal(r.recording_deleted_reason, 'retention');
  assert.equal(r.recording_url, null);
  assert.equal(r.question_results[Q1].recordingPath, undefined);
  assert.equal(r.question_results[Q1].transcript, 'hello');
  assert.equal(r.question_results[Q1].score, 70);
  assert.equal(r.question_results._summary.questions[0].hasRecording, false);
  assert.equal(r.ai_score, 70);
  // Untouched: pre-notice session and recent session.
  assert.ok(fake.fakeDb.objects.includes(qPath(LEGACY, Q1)));
  assert.ok(fake.fakeDb.objects.includes(qPath(RECENT, Q1)));
  assert.equal(row(LEGACY).recording_deleted_at, null);
  // Second run: nothing left to do.
  const again = await (await runCron()).json();
  assert.equal(again.eligibleSessions, 0);
  assert.equal(fake.fakeDb.removed.length, 2);
});

test('cron: a Storage failure marks nothing (retried next run)', async () => {
  process.env.RECORDING_RETENTION_DRY_RUN = 'false';
  fake.fakeDb.failStorage = true;
  const body = await (await runCron()).json();
  assert.equal(body.failedSessions, 1);
  assert.equal(body.deletedSessions, 0);
  assert.equal(row(OLD).recording_deleted_at, null);
  assert.equal(row(OLD).question_results[Q1].recordingPath, qPath(OLD, Q1));
});

// ─── Teacher "delete recording now" ─────────────────────────────────────────

const del = (sessionId: string, token?: string) =>
  post(delRoute, '/api/teacher/recording-delete', { sessionId }, token ? { authorization: `Bearer ${token}` } : {});

test('teacher delete: auth + ownership + not while in progress', async () => {
  assert.equal((await del(RECENT)).status, 401);
  assert.equal((await del(RECENT, 'other-token')).status, 404);
  assert.equal((await del('not-a-uuid', 'teacher-token')).status, 404);
  assert.equal((await del(LIVE, 'teacher-token')).status, 409);
  assert.deepEqual(fake.fakeDb.removed, []);
});

test('teacher delete: removes the files now (any age), marks reason=teacher, repeat is harmless; recording-url -> 410', async () => {
  const res = await del(RECENT, 'teacher-token');
  assert.equal(res.status, 200, await res.clone().text());
  const body = await res.json();
  assert.equal(body.recordingDeletedReason, 'teacher');
  assert.deepEqual(fake.fakeDb.removed, [qPath(RECENT, Q1)]);
  assert.equal(row(RECENT).recording_deleted_reason, 'teacher');
  assert.equal(row(RECENT).question_results[Q1].transcript, 'hello');

  const again = await (await del(RECENT, 'teacher-token')).json();
  assert.equal(again.alreadyDeleted, true);
  assert.equal(fake.fakeDb.removed.length, 1);

  const url = await urlRoute.GET(
    new Request(`http://localhost/api/teacher/recording-url?sessionId=${RECENT}&questionId=${Q1}`, { headers: { authorization: 'Bearer teacher-token' } })
  );
  assert.equal(url.status, 410);
  assert.equal((await url.json()).recordingDeletedReason, 'teacher');
});
