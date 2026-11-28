/**
 * Data minimisation helpers (lib/aiPrivacy.ts) and the class-summary prompt
 * (lib/insightsPrompt.ts). All names, emails and numbers below are fictional.
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as PrivacyModule from '../../lib/aiPrivacy';
import type * as InsightsModule from '../../lib/insightsPrompt';

const p: typeof PrivacyModule = await import(new URL('../../lib/aiPrivacy.ts', import.meta.url).href);
const ins: typeof InsightsModule = await import(new URL('../../lib/insightsPrompt.ts', import.meta.url).href);

// ─── redaction ────────────────────────────────────────────────────────────────

test('redactPersonalData: emails, links, phone numbers and long digit runs', () => {
  const out = p.redactPersonalData('Mail me at test.student+1@example.org or see https://example.com/x?a=1 and www.example.net. Call +20 100 123 4567 or 0100-123-4567. ID 20231234.');
  assert.equal(out, 'Mail me at [email] or see [link] and [link] Call [phone] or [phone]. ID [phone].');
});

test('redactPersonalData: Arabic-Indic digits and Arabic text around them', () => {
  assert.equal(p.redactPersonalData('رقمي ٠١٠٠١٢٣٤٥٦٧ شكرا'), 'رقمي [phone] شكرا');
  assert.equal(p.redactPersonalData('بريدي test@example.com'), 'بريدي [email]');
});

test('redactPersonalData: ordinary answers are unchanged (short numbers, years, scores)', () => {
  const s = 'Photosynthesis needs light. In 1998 about 70 percent, 3 steps, H2O.';
  assert.equal(p.redactPersonalData(s), s);
});

test('capText marks truncation', () => {
  assert.deepEqual(p.capText('abc', 5), { text: 'abc', truncated: false });
  assert.deepEqual(p.capText('abcdef', 3), { text: 'abc […]', truncated: true });
});

// ─── pseudonyms ───────────────────────────────────────────────────────────────

test('pseudonymizeStudents: stable by position, duplicates still distinct', () => {
  const ps = p.pseudonymizeStudents(['Mona Fictional', 'Mona Fictional', '']);
  assert.deepEqual(ps.pseudonyms, ['Student 1', 'Student 2', 'Student 3']);
  assert.equal(ps.map.get('student 1'), 'Mona Fictional');
  assert.equal(ps.map.get('student 3'), 'Student 3');
});

test('scrubNames: full name and name parts, case-insensitive, whole words only (Latin and Arabic)', () => {
  const ps = p.pseudonymizeStudents(['Zayd Testname', 'سلمى تجربة']);
  assert.equal(ps.scrubNames('my name is zayd testname, ZAYD here'), 'my name is Student 1, Student 1 here');
  assert.equal(ps.scrubNames('Zaydan is another word'), 'Zaydan is another word');
  assert.equal(ps.scrubNames('أنا سلمى تجربة والإجابة هي'), 'أنا Student 2 والإجابة هي');
  assert.equal(ps.scrubNames('سلمىات'), 'سلمىات');
});

test('restoreNames: Student 1 vs Student 10 never collide; casing and Arabic context', () => {
  const names = Array.from({ length: 12 }, (_, i) => `Name${i + 1}`);
  const { map } = p.pseudonymizeStudents(names);
  assert.equal(p.restoreNames('Student 1 and Student 10 and Student 11', map), 'Name1 and Name10 and Name11');
  assert.equal(p.restoreNames('student 2, STUDENT 3, Student12', map), 'Name2, Name3, Name12');
  assert.equal(p.restoreNames('يحتاج Student 1 إلى مراجعة', map), 'يحتاج Name1 إلى مراجعة');
  assert.equal(p.restoreNames('Student 99 is unknown', map), 'Student 99 is unknown');
  assert.equal(p.restoreNames('Student 1.', map), 'Name1.');
});

test('restoreNamesDeep walks objects and arrays', () => {
  const { map } = p.pseudonymizeStudents(['Alpha Fictional', 'Beta Fictional']);
  const out = p.restoreNamesDeep({ a: 'Student 2 did well', list: [{ name: 'Student 1', score: 40 }], n: 3, z: null }, map);
  assert.deepEqual(out, { a: 'Beta Fictional did well', list: [{ name: 'Alpha Fictional', score: 40 }], n: 3, z: null });
});

// ─── class-summary prompt ─────────────────────────────────────────────────────

const sub = (name: string, transcript: string, score = 50) => ({
  studentName: name,
  score,
  summary: { contentScore: 60, questions: [{ transcript, recordingPath: 'recordings/x.webm' }], flaggedReason: 'secret note' },
  transcript,
});

test('buildInsightsPrompt: the outgoing prompt contains no real name, email, phone or session data', () => {
  const built = ins.buildInsightsPrompt({
    examTitle: 'Biology quiz',
    averageScore: 55,
    questions: [{ modelLabel: 'A', questionText: 'What is a cell?', modelAnswer: 'The basic unit of life.' }],
    submissions: [
      sub('Karim Fictional', 'I am Karim Fictional, email karim.f@example.com, phone 01001234567. A cell is a unit.'),
      sub('نور تجريبية', 'اسمي نور تجريبية والخلية هي وحدة الحياة', 80),
    ],
    previousExamTitle: null,
  });
  for (const forbidden of ['Karim', 'Fictional', 'karim.f@example.com', '01001234567', 'نور', 'تجريبية', 'recordings/', 'secret note', 'studentName']) {
    assert.ok(!built.prompt.includes(forbidden), `prompt must not contain ${forbidden}`);
  }
  assert.ok(built.prompt.includes('"student": "Student 1"'));
  assert.ok(built.prompt.includes('I am Student 1, email [email], phone [phone]. A cell is a unit.'));
  assert.ok(built.prompt.includes('اسمي Student 2 والخلية هي وحدة الحياة'));
  assert.ok(built.prompt.includes('"contentScore": 60'));
});

test('buildInsightsPrompt: caps students and transcript length, and says so', () => {
  const many = Array.from({ length: ins.INSIGHTS_MAX_STUDENTS + 5 }, (_, i) => sub(`Person${i}`, 'x'.repeat(ins.INSIGHTS_MAX_TRANSCRIPT_CHARS + 10)));
  const built = ins.buildInsightsPrompt({ examTitle: 'T', averageScore: 50, questions: [], submissions: many, previousExamTitle: null });
  assert.equal(built.sentStudents, ins.INSIGHTS_MAX_STUDENTS);
  assert.equal(built.totalStudents, ins.INSIGHTS_MAX_STUDENTS + 5);
  assert.equal(built.transcriptsTruncated, true);
  assert.ok(!built.prompt.includes(`Student ${ins.INSIGHTS_MAX_STUDENTS + 1}"`));
  assert.ok(!built.prompt.includes('x'.repeat(ins.INSIGHTS_MAX_TRANSCRIPT_CHARS + 1)));
  const final = ins.finalizeInsights({ summaryText: 'Average was 50.', studentsNeedingFollowUp: [{ name: 'Student 60', score: 50 }] }, built);
  assert.equal(final.studentsNeedingFollowUp[0].name, 'Person59');
  assert.match(final.summaryText as string, /Based on 60 of 65 scored submissions\. Long answers were shortened to 1500 characters/);
});

test('finalizeInsights: names come back locally; no note when nothing was capped', () => {
  const built = ins.buildInsightsPrompt({
    examTitle: 'T', averageScore: 50, questions: [], previousExamTitle: null,
    submissions: [sub('Alpha Fictional', 'short'), sub('Beta Fictional', 'short')],
  });
  const final = ins.finalizeInsights({ summaryText: 'student 2 struggled.', studentsNeedingFollowUp: [{ name: 'Student 1', score: 40 }] }, built);
  assert.equal(final.summaryText, 'Beta Fictional struggled.');
  assert.deepEqual(final.studentsNeedingFollowUp, [{ name: 'Alpha Fictional', score: 40 }]);
});
