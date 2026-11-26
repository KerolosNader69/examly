import { RESULT_SUMMARY_KEY } from './sessionSummary.ts';
/**
 * Pure helpers that decide what exam data may leave the server for students.
 *
 * Keep this module free of Supabase / Next imports so it can be unit-tested in
 * isolation (tests/unit/examPublic.test.ts). Every function builds its output
 * from an explicit allow-list of fields, never by spreading a database row.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True only for a canonical 8-4-4-4-12 hex UUID string. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Exam statuses a student may see and join. */
export const STUDENT_VISIBLE_EXAM_STATUSES = ['published', 'active'] as const;

export function isStudentVisibleStatus(status: unknown): boolean {
  return typeof status === 'string' && (STUDENT_VISIBLE_EXAM_STATUSES as readonly string[]).includes(status);
}

export type JoinWindowResult =
  | { ok: true }
  | { ok: false; reason: 'closed' | 'not_started' | 'ended'; opensAt?: string };

/**
 * Whether a NEW session may start now: exam visible, start_time reached, and not past
 * end_time + grace. (Draft and closed exams are 'closed'.)
 */
export function checkJoinWindow(
  exam: { status: string | null; start_time: string | null; end_time: string | null },
  now: number,
  endGraceMs: number
): JoinWindowResult {
  if (!isStudentVisibleStatus(exam.status)) return { ok: false, reason: 'closed' };
  const start = exam.start_time ? Date.parse(exam.start_time) : NaN;
  if (Number.isFinite(start) && now < start) return { ok: false, reason: 'not_started', opensAt: new Date(start).toISOString() };
  const end = exam.end_time ? Date.parse(exam.end_time) : NaN;
  if (Number.isFinite(end) && now > end + endGraceMs) return { ok: false, reason: 'ended' };
  return { ok: true };
}

/**
 * Question ids that already have a server-side result the student can't redo
 * (graded / no_speech / pending_review) or a stored transcript. Used on resume to
 * skip ahead instead of making the student re-record answered questions.
 */
export function answeredQuestionIds(questionResults: unknown): string[] {
  if (!questionResults || typeof questionResults !== 'object') return [];
  return Object.entries(questionResults as Record<string, unknown>)
    .filter(([id, r]) => {
      if (id === RESULT_SUMMARY_KEY) return false; // the final summary, not a question

      if (!r || typeof r !== 'object') return false;
      const v = r as { status?: unknown; transcriptionStatus?: unknown };
      return ['graded', 'no_speech', 'pending_review', 'transcribed'].includes(String(v.status)) || v.transcriptionStatus === 'failed';
    })
    .map(([id]) => id);
}

// ─── /api/exam/info ─────────────────────────────────────────────────────────

export interface ExamRowForInfo {
  id: string;
  title: string;
  exam_type: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  subject?: string | null;
}

export interface TeacherRowForInfo {
  name: string | null;
  logo_url: string | null;
  brand_color: string | null;
}

export interface TeacherSettingsRowForInfo {
  display_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
}

export interface PublicExamInfo {
  id: string;
  title: string;
  type: string;
  startTime: string | null;
  endTime: string | null;
  status: string;
  subject: string | null;
  teacher: {
    name: string | null;
    logoUrl: string | null;
    brandColor: string | null;
  };
}

/**
 * Builds the student-safe exam payload. Only these fields are ever returned:
 * id, title, type, start/end time, status, subject and the teacher's display branding.
 * Never insights, teacher email/plan/ids, or any question data.
 */
export function toPublicExamInfo(
  exam: ExamRowForInfo,
  teacher: TeacherRowForInfo | null,
  settings: TeacherSettingsRowForInfo | null
): PublicExamInfo {
  return {
    id: exam.id,
    title: exam.title,
    type: exam.exam_type || 'audio',
    startTime: exam.start_time ?? null,
    endTime: exam.end_time ?? null,
    status: exam.status,
    subject: exam.subject ?? null,
    teacher: {
      name: settings?.display_name || teacher?.name || null,
      logoUrl: settings?.logo_url || teacher?.logo_url || null,
      brandColor: settings?.primary_color || teacher?.brand_color || null,
    },
  };
}

// ─── Questions ──────────────────────────────────────────────────────────────

interface ParsedAnswerField {
  /** MCQ option texts, if this question stores MCQ JSON. */
  options?: string[];
  /** Text the grader compares against (explanation for MCQ JSON, raw text otherwise). */
  gradingText: string;
}

/**
 * questions.model_answer_text holds either plain text (open questions) or, for
 * MCQ, JSON: { options: string[], correctOptionIndex: number, explanation: string }.
 */
function parseAnswerField(raw: unknown): ParsedAnswerField {
  const text = typeof raw === 'string' ? raw : '';
  if (text.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(text) as { options?: unknown; explanation?: unknown };
      const options = Array.isArray(parsed.options) ? parsed.options.map((o) => String(o ?? '')) : undefined;
      const explanation = typeof parsed.explanation === 'string' ? parsed.explanation : '';
      return { options, gradingText: explanation };
    } catch {
      // Not valid JSON: treat as plain text
    }
  }
  return { gradingText: text };
}

export interface QuestionRowForStudent {
  id: string;
  question_text: string;
  model_answer_text: string | null;
  order_index: number | null;
  /** questions.time_limit_seconds (migration 004); null/absent = type default. */
  time_limit_seconds?: number | null;
}

/** What a student receives for one question: nothing that reveals the answer. */
export interface StudentQuestion {
  id: string;
  text: string;
  order: number;
  timeLimit: number;
  options?: string[];
}

/** Per-question time limits (seconds). Same range as the DB CHECK in migration 004. */
export const MIN_QUESTION_TIME_LIMIT_SECONDS = 30;
export const MAX_QUESTION_TIME_LIMIT_SECONDS = 600;
export const DEFAULT_QUESTION_TIME_LIMIT_SECONDS = 60;
export const DEFAULT_ESSAY_TIME_LIMIT_SECONDS = 600;

/** Default limit for a new question of this exam type (essays 600 s, everything else 60 s). */
export function defaultTimeLimitFor(examType: string | null | undefined): number {
  return examType === 'essay' ? DEFAULT_ESSAY_TIME_LIMIT_SECONDS : DEFAULT_QUESTION_TIME_LIMIT_SECONDS;
}

/**
 * Video answers are capped lower than the DB range (30-600, migration 004): a 1 Mbps
 * video answer must stay under the 50 MB exam-recordings bucket limit (300 s ≈ 40 MB).
 * Enforced in code only (builder, save validation, /join limits, /transcribe cap).
 */
export const MAX_VIDEO_TIME_LIMIT_SECONDS = 300;

const isVideoType = (examType: string | null | undefined) => examType === 'video' || examType === 'audio_video';

/** Largest allowed limit for this exam type (video 300 s, everything else 600 s). */
export function maxTimeLimitFor(examType: string | null | undefined): number {
  return isVideoType(examType) ? MAX_VIDEO_TIME_LIMIT_SECONDS : MAX_QUESTION_TIME_LIMIT_SECONDS;
}

export function isValidTimeLimit(value: unknown, examType?: string | null): value is number {
  return Number.isInteger(value) && (value as number) >= MIN_QUESTION_TIME_LIMIT_SECONDS && (value as number) <= maxTimeLimitFor(examType);
}

/**
 * The stored limit if valid for this exam type, otherwise the type default. A stored
 * video limit above 300 s (allowed by the DB range) is capped to 300 s.
 */
export function questionTimeLimit(raw: unknown, examType: string | null | undefined): number {
  if (isValidTimeLimit(raw, examType)) return raw;
  if (isValidTimeLimit(raw)) return Math.min(raw, maxTimeLimitFor(examType));
  return defaultTimeLimitFor(examType);
}

export function toStudentQuestion(q: QuestionRowForStudent, examType?: string | null): StudentQuestion {
  const { options } = parseAnswerField(q.model_answer_text);
  const out: StudentQuestion = {
    id: q.id,
    text: q.question_text,
    order: q.order_index ?? 0,
    timeLimit: questionTimeLimit(q.time_limit_seconds, examType),
  };
  if (options && options.length > 0) out.options = options;
  return out;
}

/** Sorted by order_index, mapped to the student-safe shape. */
export function toStudentQuestions(rows: QuestionRowForStudent[], examType?: string | null): StudentQuestion[] {
  return [...rows]
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map((q) => toStudentQuestion(q, examType));
}

/** Server-side only: the reference answer the AI grader compares against. */
export function modelAnswerForGrading(raw: unknown): string {
  return parseAnswerField(raw).gradingText;
}

// ─── Recordings ─────────────────────────────────────────────────────────────

const RECORDINGS_BUCKET = 'exam-recordings';
const LEGACY_URL_MARKERS = [
  `/storage/v1/object/public/${RECORDINGS_BUCKET}/`,
  `/storage/v1/object/sign/${RECORDINGS_BUCKET}/`,
];

/**
 * Normalises a stored recording reference to an object path inside the bucket.
 * Accepts the new form ('recordings/<id>-<ts>.webm') and the legacy public URL
 * form. Returns null for anything else (empty, traversal, foreign URLs).
 */
export function recordingPathFromStored(stored: unknown): string | null {
  if (typeof stored !== 'string') return null;
  let path = stored.trim();
  if (!path) return null;

  if (/^https?:\/\//i.test(path)) {
    const marker = LEGACY_URL_MARKERS.find((m) => path.includes(m));
    if (!marker) return null;
    path = path.slice(path.indexOf(marker) + marker.length).split('?')[0];
    try {
      path = decodeURIComponent(path);
    } catch {
      return null;
    }
  }

  if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').some((seg) => seg === '..' || seg === '.' || seg === '')) {
    return null;
  }
  return path;
}
