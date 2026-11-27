/**
 * Turns a finished bot draft into the dashboard's own SaveExamInput, so the exam is
 * saved by the same all-or-nothing saveExam() as exams made in the dashboard and shows
 * up (and is editable) there like any other exam. Pure.
 *
 * Status rules (reusing exams.status + exams.start_time; no new columns):
 *   every answer set + Publish now -> 'published', start_time = now
 *   every answer set + Schedule    -> 'published', start_time = scheduled time
 *                                     (/api/exam/join refuses students before start_time)
 *   any answer missing / invalid   -> 'draft' (students can never see drafts); the teacher
 *                                     sets the answers in the dashboard and publishes there.
 */
import { validateDraftModels, type SaveExamInput } from '../examCreate.ts';
import type { Draft } from './flow.ts';
import { missingAnswerCount, secondsPerQuestion } from './flow.ts';
import { formatCairo } from './schedule.ts';
import type { FinalInfo, Lang } from './i18n.ts';

export interface BuiltExam {
  input: SaveExamInput;
  kind: 'published' | 'scheduled' | 'draft';
  missing: number;
  seconds: number;
  totalMinutes: number;
}

export function buildExamFromDraft(draft: Draft, teacherId: string, scheduledAt: number | null, now: number, fallbackTitle: string): BuiltExam {
  const seconds = secondsPerQuestion(draft.durationMin ?? 30, draft.questions.length);
  const models = [
    {
      name: 'Model A',
      questions: draft.questions.map((q) => ({
        text: q.text,
        modelAnswer: '',
        options: q.options,
        correctOptionIndex: q.correct,
        timeLimit: seconds,
      })),
    },
  ];
  const missing = missingAnswerCount(draft);
  const valid = missing === 0 && validateDraftModels('mcq', models).length === 0;
  const start = scheduledAt ?? now;
  const kind: BuiltExam['kind'] = !valid ? 'draft' : scheduledAt ? 'scheduled' : 'published';
  return {
    input: {
      teacherId,
      title: (draft.title || fallbackTitle).slice(0, 120),
      examType: 'mcq',
      startTime: new Date(start).toISOString(),
      endTime: null,
      status: valid ? 'published' : 'draft',
      models,
    },
    kind,
    // An answer can be "set" yet still invalid (e.g. duplicate options): count those too.
    missing: valid ? 0 : Math.max(missing, 1),
    seconds,
    totalMinutes: Math.max(1, Math.round((seconds * draft.questions.length) / 60)),
  };
}

export function finalInfo(built: BuiltExam, examId: string, baseUrl: string, scheduledAt: number | null, lang: Lang): FinalInfo {
  return {
    title: built.input.title,
    questionCount: built.input.models[0].questions.length,
    secondsPerQuestion: built.seconds,
    totalMinutes: built.totalMinutes,
    status: built.kind,
    scheduledLabel: scheduledAt ? formatCairo(scheduledAt, lang) : null,
    missingAnswers: built.missing,
    examUrl: `${baseUrl}/exam/${examId}`,
    examCode: examId,
    dashboardUrl: `${baseUrl}/dashboard/exams/${examId}`,
  };
}
