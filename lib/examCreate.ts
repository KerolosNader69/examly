/**
 * Pure helpers + an all-or-nothing save for the teacher "Create exam" flow
 * (app/dashboard/exams/new). No Supabase/Next imports: the database client is
 * passed in, so the whole save path is unit-testable (tests/unit/examCreate.test.ts).
 *
 * Save contract:
 *   1. The exam row is ALWAYS inserted as 'draft' (students can't see drafts).
 *   2. Every variant and every question is inserted and checked.
 *   3. Only if all of that succeeded is the status flipped to 'published'.
 *   4. On any failure the exam row is deleted (variants/questions cascade), and an
 *      error is returned for the UI. No half-built exam is ever visible to students.
 */

import { normalizeExamLanguage, normalizeWrongLanguagePolicy } from './examLanguage.ts';
import { MAX_QUESTION_TIME_LIMIT_SECONDS, MIN_QUESTION_TIME_LIMIT_SECONDS, defaultTimeLimitFor, isValidTimeLimit } from './examPublic.ts';

export type CreatableExamType = 'audio' | 'video' | 'mcq' | 'essay';

export interface DraftQuestionInput {
  text: string;
  modelAnswer: string;
  options?: string[];
  /** null/undefined = the teacher (or the PDF import) has not chosen a correct option. */
  correctOptionIndex?: number | null;
  /** Seconds (30..600). undefined = the exam type's default (essay 600, others 60). */
  timeLimit?: number;
}

export interface DraftModelInput {
  name: string;
  questions: DraftQuestionInput[];
}

export const MIN_MCQ_OPTIONS = 2;
export const MAX_MCQ_OPTIONS = 4;

// ─── Dates ──────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Value for an <input type="datetime-local"> in the browser's LOCAL time.
 * (`toISOString().slice(0, 16)` is UTC, which the input then reads as local time,
 * shifting the default start/end by the UTC offset.)
 */
export function toLocalDateTimeInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Error message for an invalid start/end pair, or null when the schedule is fine. */
export function validateSchedule(start: string, end: string): string | null {
  const s = start ? Date.parse(start) : NaN;
  const e = end ? Date.parse(end) : NaN;
  if (!Number.isFinite(s)) return 'Please set a valid start date and time.';
  if (!Number.isFinite(e)) return 'Please set a valid end date and time.';
  if (e <= s) return 'The end time must be after the start time.';
  return null;
}

// ─── MCQ ────────────────────────────────────────────────────────────────────

const normOpt = (s: string) => s.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

export type McqNormalizeResult =
  | { ok: true; options: string[]; correctOptionIndex: number }
  | { ok: false; error: string };

/**
 * Trims options, drops empty ones (re-mapping the correct index), and rejects
 * keys a student could not answer fairly: fewer than 2 / more than 4 options,
 * duplicate options, or no (or an empty / out-of-range) correct option.
 */
export function normalizeMcq(options: unknown, correctOptionIndex: unknown): McqNormalizeResult {
  const raw = Array.isArray(options) ? options.map((o) => (typeof o === 'string' ? o : String(o ?? ''))) : [];
  if (!Number.isInteger(correctOptionIndex) || (correctOptionIndex as number) < 0 || (correctOptionIndex as number) >= raw.length) {
    return { ok: false, error: 'Mark which option is correct.' };
  }
  if (!raw[correctOptionIndex as number]?.trim()) {
    return { ok: false, error: 'The option marked correct is empty.' };
  }
  const kept: string[] = [];
  let newCorrect = -1;
  raw.forEach((o, i) => {
    const t = o.trim();
    if (!t) return;
    if (i === correctOptionIndex) newCorrect = kept.length;
    kept.push(t);
  });
  if (kept.length < MIN_MCQ_OPTIONS) return { ok: false, error: `Add at least ${MIN_MCQ_OPTIONS} non-empty options.` };
  if (kept.length > MAX_MCQ_OPTIONS) return { ok: false, error: `Use at most ${MAX_MCQ_OPTIONS} options.` };
  if (new Set(kept.map(normOpt)).size !== kept.length) return { ok: false, error: 'Two options have the same text.' };
  return { ok: true, options: kept, correctOptionIndex: newCorrect };
}

// ─── Validation ─────────────────────────────────────────────────────────────

export interface ValidationIssue {
  model: string;
  /** 1-based question number, or null for a model-level issue. */
  question: number | null;
  message: string;
}

export function validateDraftModels(examType: CreatableExamType, models: DraftModelInput[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (models.length === 0) issues.push({ model: '-', question: null, message: 'Add at least one model with questions.' });
  const counts = new Set(models.map((m) => m.questions.length));
  if (counts.size > 1) {
    issues.push({
      model: '-',
      question: null,
      message: 'All model variants must have the same number of questions (students are only assigned to the largest variants).',
    });
  }
  for (const m of models) {
    if (m.questions.length === 0) issues.push({ model: m.name, question: null, message: 'This model has no questions.' });
    m.questions.forEach((q, i) => {
      const n = i + 1;
      if (!q.text.trim()) issues.push({ model: m.name, question: n, message: 'Question text is empty.' });
      if (q.timeLimit !== undefined && !isValidTimeLimit(q.timeLimit)) {
        issues.push({
          model: m.name,
          question: n,
          message: `Time limit must be a whole number of seconds between ${MIN_QUESTION_TIME_LIMIT_SECONDS} and ${MAX_QUESTION_TIME_LIMIT_SECONDS}.`,
        });
      }
      if (examType === 'mcq') {
        const r = normalizeMcq(q.options, q.correctOptionIndex);
        if (!r.ok) issues.push({ model: m.name, question: n, message: r.error });
      } else if ((examType === 'audio' || examType === 'video') && !q.modelAnswer.trim()) {
        // The AI grades against this text; without it grading is meaningless.
        issues.push({ model: m.name, question: n, message: 'Add a model answer (the AI grades against it).' });
      }
    });
  }
  return issues;
}

export function formatIssue(i: ValidationIssue): string {
  return i.question === null ? (i.model === '-' ? i.message : `${i.model}: ${i.message}`) : `${i.model}, question ${i.question}: ${i.message}`;
}

// ─── Rows ───────────────────────────────────────────────────────────────────

export interface QuestionRow {
  exam_model_id: string;
  question_text: string;
  model_answer_text: string;
  order_index: number;
  time_limit_seconds: number;
}

/** Stored limit: the teacher's value if valid, else the type default (drafts may hold junk). */
export function timeLimitForRow(examType: CreatableExamType, q: DraftQuestionInput): number {
  return q.timeLimit !== undefined && isValidTimeLimit(q.timeLimit) ? q.timeLimit : defaultTimeLimitFor(examType);
}

/** Call only after validateDraftModels returned no issues. */
export function buildQuestionRows(examType: CreatableExamType, modelId: string, questions: DraftQuestionInput[]): QuestionRow[] {
  return questions.map((q, idx) => {
    let modelAnswer = q.modelAnswer.trim();
    if (examType === 'mcq') {
      const r = normalizeMcq(q.options, q.correctOptionIndex);
      if (!r.ok) throw new Error(`Invalid MCQ question ${idx + 1}: ${r.error}`);
      modelAnswer = JSON.stringify({ options: r.options, correctOptionIndex: r.correctOptionIndex, explanation: modelAnswer });
    }
    return {
      exam_model_id: modelId,
      question_text: q.text.trim(),
      model_answer_text: modelAnswer,
      order_index: idx,
      time_limit_seconds: timeLimitForRow(examType, q),
    };
  });
}

// ─── Save ───────────────────────────────────────────────────────────────────

/* Minimal structural type of the Supabase query builder calls used below. */
type Result<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
interface Filterable<T> extends Result<T> {
  eq(col: string, val: string): Filterable<T>;
  select(cols?: string): Filterable<T> & { single(): Result<T> };
}
export interface ExamDb {
  from(table: string): {
    insert(rows: unknown[]): { select(cols?: string): Result<unknown[]> & { single(): Result<{ id: string }> } };
    update(values: Record<string, unknown>): Filterable<unknown>;
    delete(): Filterable<unknown>;
  };
}

export interface SaveExamInput {
  teacherId: string;
  title: string;
  examType: CreatableExamType;
  subject?: string | null;
  /** exams.language (Deepgram + grader); unsupported values become 'en'. */
  language?: string;
  /** exams.wrong_language_policy: 'review' (default) | 'penalize' | 'ignore'. */
  wrongLanguagePolicy?: string;
  startTime: string | null;
  endTime: string | null;
  status: 'published' | 'draft';
  models: DraftModelInput[];
}

export type SaveExamResult = { ok: true; examId: string } | { ok: false; error: string };

export async function saveExam(db: ExamDb, input: SaveExamInput): Promise<SaveExamResult> {
  const issues = validateDraftModels(input.examType, input.models);
  if (input.status === 'published' && issues.length > 0) return { ok: false, error: formatIssue(issues[0]) };

  const { data: exam, error: examError } = await db
    .from('exams')
    .insert([
      {
        teacher_id: input.teacherId,
        title: input.title.trim(),
        exam_type: input.examType,
        subject: input.subject?.trim().slice(0, 100) || null,
        language: normalizeExamLanguage(input.language),
        wrong_language_policy: normalizeWrongLanguagePolicy(input.wrongLanguagePolicy),
        start_time: input.startTime,
        end_time: input.endTime,
        status: 'draft',
      },
    ])
    .select('id')
    .single();
  if (examError || !exam?.id) return { ok: false, error: `Failed to save exam: ${examError?.message || 'database error'}` };
  const examId = exam.id;

  const rollback = async (error: string): Promise<SaveExamResult> => {
    // Cascades to exam_models and questions.
    const { error: delError } = await db.from('exams').delete().eq('id', examId);
    return {
      ok: false,
      error: delError ? `${error} The partial exam could not be removed automatically; please delete it from My Exams.` : error,
    };
  };

  try {
    for (let i = 0; i < input.models.length; i++) {
      const m = input.models[i];
      const { data: model, error: modelError } = await db
        .from('exam_models')
        .insert([{ exam_id: examId, label: m.name || `Model ${String.fromCharCode(65 + i)}` }])
        .select('id')
        .single();
      if (modelError || !model?.id) return rollback(`Failed to save ${m.name}: ${modelError?.message || 'database error'}.`);

      // Drafts may be incomplete; skip questions with no text instead of inventing "Question N".
      const qs = input.status === 'draft' ? m.questions.filter((q) => q.text.trim()) : m.questions;
      const rows =
        input.status === 'draft' && input.examType === 'mcq'
          ? qs.map((q, idx) => {
              const r = normalizeMcq(q.options, q.correctOptionIndex);
              const value = r.ok
                ? { options: r.options, correctOptionIndex: r.correctOptionIndex, explanation: q.modelAnswer.trim() }
                : { options: q.options ?? [], correctOptionIndex: q.correctOptionIndex ?? null, explanation: q.modelAnswer.trim() };
              return {
                exam_model_id: model.id,
                question_text: q.text.trim(),
                model_answer_text: JSON.stringify(value),
                order_index: idx,
                time_limit_seconds: timeLimitForRow(input.examType, q),
              };
            })
          : buildQuestionRows(input.examType, model.id, qs);
      if (rows.length === 0) continue;
      const { data: inserted, error: qError } = await db.from('questions').insert(rows).select('id');
      if (qError || !Array.isArray(inserted) || inserted.length !== rows.length) {
        return rollback(`Failed to save the questions of ${m.name}: ${qError?.message || 'not all questions were saved'}.`);
      }
    }

    if (input.status === 'published') {
      const { data: pub, error: pubError } = await db.from('exams').update({ status: 'published' }).eq('id', examId).select('id').single();
      if (pubError || !pub) return rollback(`Failed to publish the exam: ${pubError?.message || 'database error'}.`);
    }
  } catch (err) {
    return rollback(`Failed to save exam: ${err instanceof Error ? err.message : 'unexpected error'}.`);
  }
  return { ok: true, examId };
}

// ─── Publishing an existing draft ───────────────────────────────────────────

export interface StoredQuestionForPublish {
  question_text: string;
  model_answer_text: string | null;
}

/** Issues that block publishing a stored draft (same rules as the creator). */
export function validateStoredDraft(
  examType: string,
  models: { label: string; questions: StoredQuestionForPublish[] }[]
): ValidationIssue[] {
  const t = (['audio', 'video', 'mcq', 'essay'].includes(examType) ? examType : 'audio') as CreatableExamType;
  return validateDraftModels(
    t,
    models.map((m) => ({
      name: m.label,
      questions: m.questions.map((q) => {
        if (t !== 'mcq') return { text: q.question_text, modelAnswer: q.model_answer_text || '' };
        let parsed: { options?: unknown; correctOptionIndex?: unknown; explanation?: unknown } = {};
        try {
          parsed = JSON.parse(q.model_answer_text || '');
        } catch {
          // invalid key -> flagged by normalizeMcq below
        }
        return {
          text: q.question_text,
          modelAnswer: typeof parsed.explanation === 'string' ? parsed.explanation : '',
          options: Array.isArray(parsed.options) ? parsed.options.map(String) : [],
          correctOptionIndex: Number.isInteger(parsed.correctOptionIndex) ? (parsed.correctOptionIndex as number) : null,
        };
      }),
    }))
  );
}

// ─── PDF/DOCX import ────────────────────────────────────────────────────────

export interface GeneratedQuestion {
  questionText: string;
  questionType: 'mcq' | 'open';
  options?: string[];
  /** null = the document did not state the correct option; the teacher must pick it. */
  correctOptionIndex: number | null;
  modelAnswerText: string;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Maps one raw Gemini item to the creator's schema. Returns null for unusable items. */
export function mapGeneratedQuestion(q: unknown): GeneratedQuestion | null {
  if (!q || typeof q !== 'object') return null;
  const o = q as Record<string, unknown>;
  const questionText = typeof o.questionText === 'string' ? o.questionText.trim() : '';
  if (!questionText) return null;

  let opts: string[] | undefined;
  if (Array.isArray(o.options) && o.options.length > 0) {
    opts = o.options.map((opt) =>
      opt && typeof opt === 'object' ? String((opt as { text?: unknown; label?: unknown }).text ?? (opt as { label?: unknown }).label ?? '').trim() : String(opt ?? '').trim()
    );
  }
  const isMcq = o.questionType === 'mcq' || Boolean(opts && opts.some((x) => x.length > 0));

  let correct: number | null = null;
  const cand = o.correctOptionLetter ?? o.correctOptionIndex;
  if (cand !== undefined && cand !== null && cand !== '') {
    const s = String(cand).trim().toUpperCase();
    const byLetter = LETTERS.indexOf(s);
    const byNum = /^\d+$/.test(s) ? Number(s) : -1;
    correct = byLetter >= 0 ? byLetter : byNum >= 0 ? byNum : null;
  }

  let explanation = String(o.explanation ?? o.modelAnswerText ?? '').trim();
  if (isMcq && opts) {
    const lower = explanation.toLowerCase();
    const matchesOption = opts.some((opt) => opt.length > 0 && lower.includes(opt.toLowerCase()));
    // "Answer: B", "B)", "(c)." — a bare letter declaration, not prose that starts with a-d.
    const isShortDecl = /^(answer\s*:?\s*)?\(?[a-d]\)?(\s*[.):-].*)?$/i.test(explanation) && explanation.length < 50;
    if (isShortDecl || (matchesOption && explanation.length < 60)) explanation = '';
  }

  if (isMcq && opts) {
    // Keep at most MAX_MCQ_OPTIONS, keeping the correct one if it was beyond the cut.
    if (opts.length > MAX_MCQ_OPTIONS) {
      if (correct !== null && correct >= MAX_MCQ_OPTIONS && correct < opts.length) {
        const keep = opts.slice(0, MAX_MCQ_OPTIONS - 1);
        keep.push(opts[correct]);
        opts = keep;
        correct = MAX_MCQ_OPTIONS - 1;
      } else {
        opts = opts.slice(0, MAX_MCQ_OPTIONS);
      }
    }
    if (correct !== null && (correct < 0 || correct >= opts.length)) correct = null;
  } else {
    correct = null;
  }

  return {
    questionText,
    questionType: isMcq ? 'mcq' : 'open',
    options: isMcq ? opts ?? [] : undefined,
    correctOptionIndex: correct,
    modelAnswerText: explanation,
  };
}
