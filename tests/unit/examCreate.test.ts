/**
 * Unit tests for lib/examCreate.ts: teacher create/publish path (mocked Supabase),
 * MCQ key validation, PDF/DOCX import mapping, schedule validation.
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as ExamCreateModule from '../../lib/examCreate';

const ec: typeof ExamCreateModule = await import(new URL('../../lib/examCreate.ts', import.meta.url).href);

// ── Mock Supabase (only the calls saveExam makes) ──────────────────

interface FakeOpts {
  failExam?: boolean;
  failModelAt?: number;
  failQuestionsAt?: number;
  dropOneQuestionAt?: number;
  failPublish?: boolean;
}

function fakeDb(opts: FakeOpts = {}) {
  const tables: Record<string, Record<string, unknown>[]> = { exams: [], exam_models: [], questions: [] };
  let seq = 0;
  let modelInsertCount = 0;
  let questionInsertCount = 0;
  const ok = <T>(data: T) => Promise.resolve({ data, error: null });
  const err = (message: string) => Promise.resolve({ data: null, error: { message } });

  const db = {
    from(table: string) {
      return {
        insert(rows: Record<string, unknown>[]) {
          let result: Promise<{ data: unknown; error: { message: string } | null }>;
          if (table === 'exams' && opts.failExam) result = err('exam insert failed');
          else if (table === 'exam_models' && modelInsertCount++ === opts.failModelAt) result = err('model insert failed');
          else if (table === 'questions' && questionInsertCount === opts.failQuestionsAt) {
            questionInsertCount++;
            result = err('questions insert failed');
          } else {
            let saved = rows.map((r) => ({ ...r, id: `${table}-${++seq}` }));
            if (table === 'questions' && questionInsertCount++ === opts.dropOneQuestionAt) saved = saved.slice(1);
            tables[table].push(...saved);
            result = ok(saved);
          }
          const sel = {
            then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => result.then(res, rej),
            single: () => result.then((r) => ({ data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error })),
          };
          return { select: () => sel };
        },
        update(values: Record<string, unknown>) {
          const filters: [string, string][] = [];
          const run = () => {
            if (table === 'exams' && opts.failPublish) return err('update failed');
            const hits = tables[table].filter((r) => filters.every(([c, v]) => r[c] === v));
            hits.forEach((h) => Object.assign(h, values));
            return ok(hits);
          };
          const chain: any = {
            eq(c: string, v: string) {
              filters.push([c, v]);
              return chain;
            },
            select: () => ({
              ...chain,
              single: () => run().then((r) => ({ data: Array.isArray(r.data) ? r.data[0] ?? null : null, error: r.error })),
            }),
            then: (res: any, rej: any) => run().then(res, rej),
          };
          return chain;
        },
        delete() {
          const filters: [string, string][] = [];
          const run = () => {
            const before = tables[table].length;
            tables[table] = tables[table].filter((r) => !filters.every(([c, v]) => r[c] === v));
            if (table === 'exams') {
              // emulate ON DELETE CASCADE
              const examIds = new Set(tables.exams.map((e) => e.id));
              tables.exam_models = tables.exam_models.filter((m) => examIds.has(m.exam_id as string));
              const modelIds = new Set(tables.exam_models.map((m) => m.id));
              tables.questions = tables.questions.filter((q) => modelIds.has(q.exam_model_id as string));
            }
            return ok(before - tables[table].length);
          };
          const chain: any = {
            eq(c: string, v: string) {
              filters.push([c, v]);
              return chain;
            },
            select: () => chain,
            then: (res: any, rej: any) => run().then(res, rej),
          };
          return chain;
        },
      };
    },
  };
  return { db: db as unknown as ExamCreateModule.ExamDb, tables };
}

const q = (text: string, modelAnswer = 'model answer') => ({ text, modelAnswer });
const mcqQ = (text: string, options: string[], correct: number | null) => ({ text, modelAnswer: 'because', options, correctOptionIndex: correct });

const baseInput = (over: Partial<ExamCreateModule.SaveExamInput> = {}): ExamCreateModule.SaveExamInput => ({
  teacherId: 't1',
  title: '  Bio quiz  ',
  examType: 'audio',
  startTime: '2026-01-01T00:00:00.000Z',
  endTime: '2026-02-01T00:00:00.000Z',
  status: 'published',
  models: [
    { name: 'Model A', questions: [q('Q1'), q('Q2')] },
    { name: 'Model B', questions: [q('Q1b'), q('Q2b')] },
  ],
  ...over,
});

// ── saveExam ───────────────────────────────────────────────────────

test('saveExam: publishes only after every variant and question is saved', async () => {
  const { db, tables } = fakeDb();
  const r = await ec.saveExam(db, baseInput());
  assert.equal(r.ok, true);
  assert.equal(tables.exams.length, 1);
  assert.equal(tables.exams[0].status, 'published');
  assert.equal(tables.exams[0].title, 'Bio quiz');
  assert.equal(tables.exams[0].exam_type, 'audio');
  assert.equal(tables.exams[0].start_time, '2026-01-01T00:00:00.000Z');
  assert.equal(tables.exams[0].end_time, '2026-02-01T00:00:00.000Z');
  assert.equal(tables.exam_models.length, 2);
  assert.deepEqual(tables.questions.map((x) => [x.question_text, x.order_index]), [['Q1', 0], ['Q2', 1], ['Q1b', 0], ['Q2b', 1]]);
});

for (const [name, opts] of [
  ['variant insert fails', { failModelAt: 1 }],
  ['question insert fails', { failQuestionsAt: 1 }],
  ['a question silently not saved', { dropOneQuestionAt: 0 }],
  ['final publish fails', { failPublish: true }],
] as const) {
  test(`saveExam: ${name} -> error shown, nothing left behind`, async () => {
    const { db, tables } = fakeDb(opts);
    const r = await ec.saveExam(db, baseInput());
    assert.equal(r.ok, false);
    assert.ok(!r.ok && r.error.length > 0);
    assert.equal(tables.exams.length, 0, 'exam rolled back');
    assert.equal(tables.exam_models.length, 0);
    assert.equal(tables.questions.length, 0);
  });
}

test('saveExam: exam insert failure -> error, nothing inserted', async () => {
  const { db, tables } = fakeDb({ failExam: true });
  const r = await ec.saveExam(db, baseInput());
  assert.equal(r.ok, false);
  assert.equal(tables.exam_models.length, 0);
});

test('saveExam: publish refused when validation fails (no DB writes)', async () => {
  const { db, tables } = fakeDb();
  const r = await ec.saveExam(db, baseInput({ models: [{ name: 'Model A', questions: [q('')] }] }));
  assert.equal(r.ok, false);
  assert.equal(tables.exams.length, 0);
});

test('saveExam: draft may be incomplete and stays draft; empty questions are skipped', async () => {
  const { db, tables } = fakeDb();
  const r = await ec.saveExam(db, baseInput({ status: 'draft', models: [{ name: 'Model A', questions: [q('Real'), q('  ')] }] }));
  assert.equal(r.ok, true);
  assert.equal(tables.exams[0].status, 'draft');
  assert.deepEqual(tables.questions.map((x) => x.question_text), ['Real']);
});

test('saveExam: MCQ key stored as normalized JSON (empty options dropped, index remapped)', async () => {
  const { db, tables } = fakeDb();
  const r = await ec.saveExam(
    db,
    baseInput({ examType: 'mcq', models: [{ name: 'Model A', questions: [mcqQ('Which?', ['', ' red ', 'blue', 'green'], 2)] }] })
  );
  assert.equal(r.ok, true);
  const key = JSON.parse(tables.questions[0].model_answer_text as string);
  assert.deepEqual(key, { options: ['red', 'blue', 'green'], correctOptionIndex: 1, explanation: 'because' });
});

// ── Content edge cases survive unchanged (except outer trim) ───────

test('buildQuestionRows: Arabic/RTL, emoji, HTML, quotes, braces, backticks, newlines kept verbatim', () => {
  const texts = [
    'ما هي عاصمة مصر؟',
    'Explain الجاذبية in English 🙂',
    '<script>alert("x")</script> & <b>bold</b>',
    'He said "it\'s `fine`" {curly} ${x}',
    'Line 1\nLine 2\r\n\tTabbed',
    '“Smart quotes” – en dash … from Word nbsp',
    'x'.repeat(5000),
  ];
  const rows = ec.buildQuestionRows('essay', 'm1', texts.map((t) => ({ text: `  ${t}  `, modelAnswer: '' })));
  assert.deepEqual(rows.map((r) => r.question_text), texts.map((t) => t.trim()));
});

// ── MCQ normalization ──────────────────────────────────────────────

test('normalizeMcq: rejects unanswerable keys', () => {
  assert.equal(ec.normalizeMcq(['a', 'b', 'c', 'd'], null).ok, false, 'no correct option');
  assert.equal(ec.normalizeMcq(['a', 'b'], 5).ok, false, 'index out of range');
  assert.equal(ec.normalizeMcq(['a', 'b'], -1).ok, false);
  assert.equal(ec.normalizeMcq(['a', 'b'], 1.5).ok, false);
  assert.equal(ec.normalizeMcq(['a', '', '', ''], 1).ok, false, 'correct option empty');
  assert.equal(ec.normalizeMcq(['only', '', '', ''], 0).ok, false, 'one option');
  assert.equal(ec.normalizeMcq([], 0).ok, false, 'zero options');
  assert.equal(ec.normalizeMcq(['Paris', ' paris ', 'Rome'], 0).ok, false, 'duplicates');
  assert.equal(ec.normalizeMcq(['a', 'b', 'c', 'd', 'e'], 0).ok, false, 'more than 4');
  assert.equal(ec.normalizeMcq('not an array', 0).ok, false);
});

test('normalizeMcq: accepts 2-4 options', () => {
  assert.deepEqual(ec.normalizeMcq(['yes', 'no'], 1), { ok: true, options: ['yes', 'no'], correctOptionIndex: 1 });
  assert.deepEqual(ec.normalizeMcq(['ا', 'ب', 'ج', 'د'], 3), { ok: true, options: ['ا', 'ب', 'ج', 'د'], correctOptionIndex: 3 });
});

test('validateDraftModels: flags empty text, missing model answers, uneven variants', () => {
  assert.deepEqual(ec.validateDraftModels('audio', [{ name: 'A', questions: [q('ok')] }]), []);
  const issues = ec.validateDraftModels('audio', [
    { name: 'A', questions: [q(''), q('x', '  ')] },
    { name: 'B', questions: [q('y')] },
  ]);
  const msgs = issues.map(ec.formatIssue).join('\n');
  assert.match(msgs, /same number of questions/);
  assert.match(msgs, /A, question 1: Question text is empty/);
  assert.match(msgs, /A, question 2: Add a model answer/);
  // essays don't need a model answer (not AI-graded)
  assert.deepEqual(ec.validateDraftModels('essay', [{ name: 'A', questions: [q('x', '')] }]), []);
  assert.equal(ec.validateDraftModels('audio', []).length, 1);
});

test('validateStoredDraft: same rules applied to a stored draft', () => {
  const good = { question_text: 'Q', model_answer_text: JSON.stringify({ options: ['a', 'b'], correctOptionIndex: 0, explanation: '' }) };
  assert.deepEqual(ec.validateStoredDraft('mcq', [{ label: 'Model A', questions: [good] }]), []);
  const bad = { question_text: 'Q', model_answer_text: 'not json' };
  assert.equal(ec.validateStoredDraft('mcq', [{ label: 'Model A', questions: [bad] }]).length, 1);
  assert.equal(ec.validateStoredDraft('audio', [{ label: 'Model A', questions: [] }]).length, 1);
});

// ── PDF/DOCX import mapping ────────────────────────────────────────

test('mapGeneratedQuestion: MCQ maps to the manual schema', () => {
  const r = ec.mapGeneratedQuestion({ questionText: ' Q? ', questionType: 'mcq', options: ['A1', { text: 'B1' }, 'C1', 'D1'], correctOptionLetter: 'b', explanation: 'Because B1 is how the process works, as explained in chapter three of the notes.' });
  assert.deepEqual(r, { questionText: 'Q?', questionType: 'mcq', options: ['A1', 'B1', 'C1', 'D1'], correctOptionIndex: 1, modelAnswerText: 'Because B1 is how the process works, as explained in chapter three of the notes.' });
});

test('mapGeneratedQuestion: clears bare answer declarations, keeps prose starting with a-d', () => {
  const m = (explanation: string) => ec.mapGeneratedQuestion({ questionText: 'Q', questionType: 'mcq', options: ['x1', 'y1'], correctOptionLetter: 'A', explanation })!.modelAnswerText;
  assert.equal(m('Answer: B'), '');
  assert.equal(m('B)'), '');
  assert.equal(m('(c). see notes'), '');
  assert.equal(m('Cells divide by mitosis.'), 'Cells divide by mitosis.');
  assert.equal(m('x1'), '', 'just repeats the option');
});

test('mapGeneratedQuestion: unknown correct option -> null (never silently "A")', () => {
  assert.equal(ec.mapGeneratedQuestion({ questionText: 'Q', questionType: 'mcq', options: ['a', 'b'], correctOptionLetter: null })!.correctOptionIndex, null);
  assert.equal(ec.mapGeneratedQuestion({ questionText: 'Q', questionType: 'mcq', options: ['a', 'b'], correctOptionLetter: 'D' })!.correctOptionIndex, null, 'out of range');
  assert.equal(ec.mapGeneratedQuestion({ questionText: 'Q', questionType: 'mcq', options: ['a', 'b'], correctOptionLetter: 'zz' })!.correctOptionIndex, null);
});

test('mapGeneratedQuestion: >4 options keeps the correct one', () => {
  const r = ec.mapGeneratedQuestion({ questionText: 'Q', questionType: 'mcq', options: ['a', 'b', 'c', 'd', 'e', 'f'], correctOptionLetter: 'F' })!;
  assert.deepEqual(r.options, ['a', 'b', 'c', 'f']);
  assert.equal(r.correctOptionIndex, 3);
  const r2 = ec.mapGeneratedQuestion({ questionText: 'Q', questionType: 'mcq', options: ['a', 'b', 'c', 'd', 'e'], correctOptionLetter: 'A' })!;
  assert.deepEqual(r2.options, ['a', 'b', 'c', 'd']);
  assert.equal(r2.correctOptionIndex, 0);
});

test('mapGeneratedQuestion: open questions and malformed items', () => {
  assert.deepEqual(ec.mapGeneratedQuestion({ questionText: 'Explain', questionType: 'open', options: [], explanation: 'Model' }), {
    questionText: 'Explain',
    questionType: 'open',
    options: undefined,
    correctOptionIndex: null,
    modelAnswerText: 'Model',
  });
  for (const bad of [null, 42, 'str', {}, { questionText: '   ' }, { questionText: 7 }]) {
    assert.equal(ec.mapGeneratedQuestion(bad), null);
  }
});

// ── Schedule ───────────────────────────────────────────────────────

test('validateSchedule / toLocalDateTimeInput', () => {
  assert.equal(ec.validateSchedule('2026-01-01T10:00', '2026-01-01T11:00'), null);
  assert.match(ec.validateSchedule('2026-01-01T10:00', '2026-01-01T10:00')!, /after the start/);
  assert.match(ec.validateSchedule('', '2026-01-01T10:00')!, /start/);
  assert.match(ec.validateSchedule('2026-01-01T10:00', 'garbage')!, /end/);
  const d = new Date(2026, 4, 7, 9, 5);
  assert.equal(ec.toLocalDateTimeInput(d), '2026-05-07T09:05');
  // Round-trips as local time (the old UTC slice shifted by the timezone offset)
  assert.equal(new Date(ec.toLocalDateTimeInput(d)).getTime(), d.getTime());
});

// ── P3: subject + per-question time limits ─────────────────────────

test('saveExam: stores subject and each question\'s own time limit', async () => {
  const { db, tables } = fakeDb();
  const r = await ec.saveExam(
    db,
    baseInput({
      subject: '  Science ',
      models: [{ name: 'Model A', questions: [{ ...q('Q1'), timeLimit: 240 }, { ...q('Q2'), timeLimit: 30 }] }],
    })
  );
  assert.equal(r.ok, true);
  assert.equal(tables.exams[0].subject, 'Science');
  assert.deepEqual(tables.questions.map((x) => x.time_limit_seconds), [240, 30]);
});

test('saveExam: missing limit -> type default (essay 600 s, audio 60 s); empty subject -> null', async () => {
  const essay = fakeDb();
  await ec.saveExam(essay.db, baseInput({ examType: 'essay', subject: '  ', models: [{ name: 'Model A', questions: [q('E1')] }] }));
  assert.equal(essay.tables.questions[0].time_limit_seconds, 600);
  assert.equal(essay.tables.exams[0].subject, null);
  const audio = fakeDb();
  await ec.saveExam(audio.db, baseInput({ models: [{ name: 'Model A', questions: [q('A1')] }] }));
  assert.equal(audio.tables.questions[0].time_limit_seconds, 60);
});

test('validateDraftModels: time limit outside 30..600 or not an integer blocks publishing', () => {
  for (const bad of [29, 601, 45.5, NaN]) {
    const issues = ec.validateDraftModels('audio', [{ name: 'Model A', questions: [{ ...q('Q1'), timeLimit: bad }] }]);
    assert.equal(issues.length, 1, `limit ${bad}`);
    assert.match(issues[0].message, /between 30 and 600/);
  }
  assert.equal(ec.validateDraftModels('audio', [{ name: 'Model A', questions: [{ ...q('Q1'), timeLimit: 600 }] }]).length, 0);
});

test('saveExam: a draft with an invalid limit is saved with the default instead of failing', async () => {
  const { db, tables } = fakeDb();
  const r = await ec.saveExam(db, baseInput({ status: 'draft', models: [{ name: 'Model A', questions: [{ ...q('Q1'), timeLimit: 5000 }] }] }));
  assert.equal(r.ok, true);
  assert.equal(tables.questions[0].time_limit_seconds, 60);
});

// ── P2: exam language + wrong-language policy ──────────────────────

test('saveExam: stores the exam language and wrong-language policy; invalid values -> en / review', async () => {
  const a = fakeDb();
  await ec.saveExam(a.db, baseInput({ language: 'ar-EG', wrongLanguagePolicy: 'penalize' }));
  assert.equal(a.tables.exams[0].language, 'ar-EG');
  assert.equal(a.tables.exams[0].wrong_language_policy, 'penalize');
  const b = fakeDb();
  await ec.saveExam(b.db, baseInput({ language: 'klingon', wrongLanguagePolicy: 'nuke' }));
  assert.equal(b.tables.exams[0].language, 'en');
  assert.equal(b.tables.exams[0].wrong_language_policy, 'review');
  const c = fakeDb();
  await ec.saveExam(c.db, baseInput());
  assert.equal(c.tables.exams[0].language, 'en');
  assert.equal(c.tables.exams[0].wrong_language_policy, 'review');
});
