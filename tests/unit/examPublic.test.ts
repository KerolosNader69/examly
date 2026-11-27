/**
 * Unit tests for lib/examPublic.ts: what exam data may reach students.
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as ExamPublicModule from '../../lib/examPublic';

// Runtime import with an explicit .ts path (Node type stripping); type-only import above for tsc.
const ep: typeof ExamPublicModule = await import(new URL('../../lib/examPublic.ts', import.meta.url).href);

const EXAM_ID = '76badc5a-f36f-49fc-9542-92ad1754bc39';
const SECRET_ANSWER = 'SECRET-MODEL-ANSWER-photosynthesis-chlorophyll';
const SECRET_EXPLANATION = 'SECRET-EXPLANATION-because-B-is-right';

// ── UUID validation ────────────────────────────────────────────────

test('isUuid accepts canonical UUIDs (any case)', () => {
  assert.equal(ep.isUuid(EXAM_ID), true);
  assert.equal(ep.isUuid(EXAM_ID.toUpperCase()), true);
});

test('isUuid rejects everything else', () => {
  for (const bad of [
    '', 'anything', 'ZZZ-9999', 'EXM-AB12',
    '76badc5a-f36f-49fc-9542-92ad1754bc3',      // too short
    '76badc5a-f36f-49fc-9542-92ad1754bc399',    // too long
    '76badc5af36f49fc954292ad1754bc39',          // no dashes
    `${EXAM_ID},id.eq.${EXAM_ID}`,               // PostgREST filter injection attempt
    ` ${EXAM_ID}`, `${EXAM_ID}\n`, '76badc5a-f36f-49fc-9542-92ad1754bcXY',
    null, undefined, 123, {},
  ]) {
    assert.equal(ep.isUuid(bad), false, `should reject ${JSON.stringify(bad)}`);
  }
});

test('only published/active exams are student-visible', () => {
  assert.equal(ep.isStudentVisibleStatus('published'), true);
  assert.equal(ep.isStudentVisibleStatus('active'), true);
  for (const s of ['draft', 'completed', 'closed', '', null, undefined]) {
    assert.equal(ep.isStudentVisibleStatus(s), false, `should hide ${String(s)}`);
  }
});

// ── /api/exam/info safe-fields filter ──────────────────────────────

test('toPublicExamInfo returns only the allow-listed fields', () => {
  // Rows carry extra sensitive columns; none may appear in the output.
  const examRow = {
    id: EXAM_ID, title: 'Speaking Test', exam_type: 'audio', start_time: '2026-11-01T10:00:00Z',
    end_time: '2026-11-08T10:00:00Z', status: 'published',
    teacher_id: 'teacher-uuid', created_at: 'x',
    ai_insights_summary: { studentsNeedingFollowUp: [{ name: 'Bob Jones', score: 41 }] },
  };
  const teacherRow = { name: 'Dr. Ahmed', logo_url: 'https://cdn/logo.png', brand_color: '#123456', email: 'teacher@school.edu', plan: 'pro', id: 'teacher-uuid' };

  const info = ep.toPublicExamInfo(examRow, teacherRow, null);
  assert.deepEqual(Object.keys(info).sort(), ['endTime', 'id', 'language', 'startTime', 'status', 'subject', 'teacher', 'title', 'type']);
  assert.deepEqual(Object.keys(info.teacher).sort(), ['brandColor', 'logoUrl', 'name']);

  const json = JSON.stringify(info);
  for (const leak of ['ai_insights_summary', 'Bob Jones', 'teacher@school.edu', 'teacher_id', 'teacher-uuid', 'plan', 'pro', 'created_at']) {
    assert.ok(!json.includes(leak), `leaked ${leak}`);
  }
  assert.equal(info.title, 'Speaking Test');
  assert.equal(info.type, 'audio');
  assert.equal(info.teacher.name, 'Dr. Ahmed');
});

test('toPublicExamInfo: teacher_settings overrides branding; missing type defaults to audio', () => {
  const info = ep.toPublicExamInfo(
    { id: EXAM_ID, title: 'T', exam_type: null, start_time: null, end_time: null, status: 'active' },
    { name: 'Teacher Name', logo_url: 'old.png', brand_color: '#000000' },
    { display_name: 'Display Name', logo_url: 'new.png', primary_color: '#ffffff' }
  );
  assert.equal(info.type, 'audio');
  assert.deepEqual(info.teacher, { name: 'Display Name', logoUrl: 'new.png', brandColor: '#ffffff' });
});

test('toPublicExamInfo: no teacher row -> null branding (no crash)', () => {
  const info = ep.toPublicExamInfo({ id: EXAM_ID, title: 'T', exam_type: 'mcq', start_time: null, end_time: null, status: 'published' }, null, null);
  assert.deepEqual(info.teacher, { name: null, logoUrl: null, brandColor: null });
});

// ── /api/exam/join response shape ──────────────────────────────────

const mcqRow = {
  id: 'q-mcq', question_text: 'Which pigment absorbs light?', order_index: 1,
  model_answer_text: JSON.stringify({ options: ['Carotene', 'Chlorophyll', 'Xanthophyll', 'Melanin'], correctOptionIndex: 1, explanation: SECRET_EXPLANATION }),
};
const openRow = { id: 'q-open', question_text: 'Explain photosynthesis.', order_index: 0, model_answer_text: SECRET_ANSWER };
const brokenJsonRow = { id: 'q-broken', question_text: 'Broken JSON?', order_index: 2, model_answer_text: '{not json' };

test('join questions contain no modelAnswer, explanation or correctOptionIndex', () => {
  const qs = ep.toStudentQuestions([mcqRow, openRow, brokenJsonRow]);
  const json = JSON.stringify(qs);
  for (const forbidden of ['modelAnswer', 'model_answer', 'explanation', 'correctOptionIndex', 'correctOption', SECRET_ANSWER, SECRET_EXPLANATION, '{not json']) {
    assert.ok(!json.includes(forbidden), `join response leaked ${forbidden}`);
  }
  for (const q of qs) {
    const allowed = ['id', 'text', 'order', 'timeLimit', 'options'];
    for (const k of Object.keys(q)) assert.ok(allowed.includes(k), `unexpected field ${k}`);
  }
});

test('join questions: sorted by order, MCQ keeps option texts, open questions have none', () => {
  const qs = ep.toStudentQuestions([mcqRow, openRow, brokenJsonRow]);
  assert.deepEqual(qs.map((q) => q.id), ['q-open', 'q-mcq', 'q-broken']);
  assert.deepEqual(qs[1].options, ['Carotene', 'Chlorophyll', 'Xanthophyll', 'Melanin']);
  assert.equal(qs[0].options, undefined);
  assert.equal(qs[2].options, undefined);
  assert.equal(qs[0].text, 'Explain photosynthesis.');
  assert.equal(qs[0].timeLimit, ep.DEFAULT_QUESTION_TIME_LIMIT_SECONDS);
});

test('modelAnswerForGrading (server-side only) still yields the reference answer', () => {
  assert.equal(ep.modelAnswerForGrading(openRow.model_answer_text), SECRET_ANSWER);
  assert.equal(ep.modelAnswerForGrading(mcqRow.model_answer_text), SECRET_EXPLANATION);
  assert.equal(ep.modelAnswerForGrading(null), '');
});

// ── Recording path normalisation ───────────────────────────────────

test('recordingPathFromStored: new path form passes through', () => {
  assert.equal(ep.recordingPathFromStored('recordings/abc-123.webm'), 'recordings/abc-123.webm');
});

test('recordingPathFromStored: legacy public URL -> path', () => {
  assert.equal(
    ep.recordingPathFromStored('https://proj.supabase.co/storage/v1/object/public/exam-recordings/recordings/abc-123.webm'),
    'recordings/abc-123.webm'
  );
});

test('recordingPathFromStored: signed URL with query -> path', () => {
  assert.equal(
    ep.recordingPathFromStored('https://proj.supabase.co/storage/v1/object/sign/exam-recordings/recordings/a%20b.webm?token=xyz'),
    'recordings/a b.webm'
  );
});

test('recordingPathFromStored: rejects empty, traversal, absolute and foreign URLs', () => {
  for (const bad of [
    '', '   ', null, undefined, 42,
    '../secrets.txt', 'recordings/../../etc/passwd', '/recordings/x.webm', 'recordings//x.webm', 'recordings\\x.webm',
    'https://evil.example.com/x.webm',
    'https://proj.supabase.co/storage/v1/object/public/other-bucket/x.webm',
    'https://proj.supabase.co/storage/v1/object/public/exam-recordings/..%2F..%2Fx',
  ]) {
    assert.equal(ep.recordingPathFromStored(bad), null, `should reject ${JSON.stringify(bad)}`);
  }
});

// ── Join window (start/end/status) ─────────────────────────────────

test('checkJoinWindow: before start, after end(+grace), draft/closed are refused', () => {
  const now = Date.UTC(2026, 10, 26, 12, 0, 0);
  const iso = (ms: number) => new Date(now + ms).toISOString();
  const grace = 15 * 60 * 1000;
  assert.deepEqual(ep.checkJoinWindow({ status: 'published', start_time: iso(-1000), end_time: iso(1000) }, now, grace), { ok: true });
  assert.deepEqual(ep.checkJoinWindow({ status: 'published', start_time: null, end_time: null }, now, grace), { ok: true });
  const early = ep.checkJoinWindow({ status: 'published', start_time: iso(60_000), end_time: null }, now, grace);
  assert.equal(early.ok, false);
  assert.equal(!early.ok && early.reason, 'not_started');
  assert.equal(!early.ok && early.opensAt, iso(60_000));
  assert.equal(ep.checkJoinWindow({ status: 'published', start_time: null, end_time: iso(-grace + 1000) }, now, grace).ok, true, 'within grace');
  const late = ep.checkJoinWindow({ status: 'published', start_time: null, end_time: iso(-grace - 1000) }, now, grace);
  assert.equal(!late.ok && late.reason, 'ended');
  for (const status of ['draft', 'completed', 'closed', null]) {
    const r = ep.checkJoinWindow({ status, start_time: null, end_time: null }, now, grace);
    assert.equal(!r.ok && r.reason, 'closed');
  }
});

test('answeredQuestionIds: only questions with a stored result', () => {
  assert.deepEqual(
    ep.answeredQuestionIds({
      a: { status: 'graded', score: 90 },
      b: { status: 'no_speech' },
      c: { status: 'pending_review' },
      d: { status: 'transcribed', transcript: 'x' },
      e: { transcriptionStatus: 'failed' },
      f: {},
      g: null,
    }).sort(),
    ['a', 'b', 'c', 'd', 'e']
  );
  assert.deepEqual(ep.answeredQuestionIds(null), []);
  assert.deepEqual(ep.answeredQuestionIds('x'), []);
});

test('toStudentQuestions: HTML/script, Arabic and long text pass through as plain data, sorted', () => {
  const rows = [
    { id: 'b', question_text: '<img src=x onerror=alert(1)>', model_answer_text: 'secret', order_index: 1 },
    { id: 'a', question_text: 'ما هو الجواب؟ 🙂', model_answer_text: JSON.stringify({ options: ['نعم', 'لا'], correctOptionIndex: 1, explanation: 'secret' }), order_index: 0 },
  ];
  const out = ep.toStudentQuestions(rows);
  assert.deepEqual(out.map((q) => q.id), ['a', 'b']);
  assert.equal(out[1].text, '<img src=x onerror=alert(1)>');
  assert.deepEqual(out[0].options, ['نعم', 'لا']);
  const json = JSON.stringify(out);
  assert.ok(!json.includes('secret') && !json.includes('correctOptionIndex'));
});

// ── P3: per-question time limits ───────────────────────────────────

test('questionTimeLimit: stored value in 30..600 is used; otherwise the type default', () => {
  assert.equal(ep.questionTimeLimit(180, 'audio'), 180);
  assert.equal(ep.questionTimeLimit(30, 'mcq'), 30);
  assert.equal(ep.questionTimeLimit(600, 'essay'), 600);
  for (const bad of [null, undefined, 29, 601, 90.5, '120', NaN, -1]) {
    assert.equal(ep.questionTimeLimit(bad, 'audio'), 60, `audio default for ${String(bad)}`);
    assert.equal(ep.questionTimeLimit(bad, 'essay'), 600, `essay default for ${String(bad)}`);
  }
  assert.equal(ep.defaultTimeLimitFor('mcq'), 60);
  assert.equal(ep.defaultTimeLimitFor('video'), 60);
  assert.equal(ep.defaultTimeLimitFor('essay'), 600);
});

test('toStudentQuestions: returns each question\'s own stored time limit', () => {
  const qs = ep.toStudentQuestions(
    [
      { ...openRow, time_limit_seconds: 240 },
      { ...mcqRow, time_limit_seconds: null },
    ],
    'audio'
  );
  assert.deepEqual(qs.map((q) => q.timeLimit), [240, 60]);
  const essays = ep.toStudentQuestions([{ ...openRow, time_limit_seconds: undefined }], 'essay');
  assert.equal(essays[0].timeLimit, 600);
});

test('toPublicExamInfo: subject is returned (null when not set)', () => {
  const base = { id: EXAM_ID, title: 'T', exam_type: 'audio', start_time: null, end_time: null, status: 'published' };
  assert.equal(ep.toPublicExamInfo({ ...base, subject: 'Science' }, null, null).subject, 'Science');
  assert.equal(ep.toPublicExamInfo(base, null, null).subject, null);
});

test('video cap: video questions max 300 s (DB allows 600); other types keep 600', () => {
  assert.equal(ep.MAX_VIDEO_TIME_LIMIT_SECONDS, 300);
  assert.equal(ep.maxTimeLimitFor('video'), 300);
  assert.equal(ep.maxTimeLimitFor('audio_video'), 300);
  for (const t of ['audio', 'mcq', 'essay']) assert.equal(ep.maxTimeLimitFor(t), 600, t);
  assert.equal(ep.isValidTimeLimit(300, 'video'), true);
  assert.equal(ep.isValidTimeLimit(301, 'video'), false);
  assert.equal(ep.isValidTimeLimit(600, 'audio'), true);
  // Stored 600 s on a video question (valid in the DB) is served and enforced as 300 s.
  assert.equal(ep.questionTimeLimit(600, 'video'), 300);
  assert.equal(ep.questionTimeLimit(240, 'video'), 240);
  assert.equal(ep.questionTimeLimit(600, 'audio'), 600);
  assert.equal(ep.toStudentQuestions([{ ...openRow, time_limit_seconds: 450 }], 'video')[0].timeLimit, 300);
});
