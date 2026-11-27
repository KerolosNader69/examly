/**
 * Conversation state machine for the Telegram bot. PURE: given the stored session and
 * one event it returns the next session, the replies to send and at most one side
 * effect (read a PDF / create the exam). The I/O lives in lib/telegram/bot.ts.
 *
 *   idle --/newexam--> awaiting_pdf; idle | awaiting_pdf --PDF--> processing --read ok--> review --Looks good--> [title] --> duration
 *     --> answers (one per question without a detected answer) --> publish_choice
 *     --Publish now--> creating --> idle
 *     --Schedule--> schedule_input --> schedule_confirm --Confirm--> creating --> idle
 *   /cancel (or the Cancel button) from any state --> idle
 *
 * Answers are never guessed: a question without a detected answer keeps correct=null
 * until the teacher taps a letter, and an exam with any null answer is saved as a draft.
 */
import { PROCESSING_STALE_MS, SESSION_TTL_MS, type TelegramLimits } from './config.ts';
import type { DraftQuestion } from './extract.ts';
import { t, type Lang } from './i18n.ts';
import { checkPdfMeta } from './pdf.ts';
import { formatCairo, parseScheduleInput } from './schedule.ts';
import { MAX_QUESTION_TIME_LIMIT_SECONDS, MIN_QUESTION_TIME_LIMIT_SECONDS } from '../examPublic.ts';

export const STATES = [
  'idle',
  'awaiting_pdf',
  'processing',
  'review',
  'title',
  'duration',
  'duration_other',
  'answers',
  'publish_choice',
  'schedule_input',
  'schedule_confirm',
  'creating',
] as const;
export type State = (typeof STATES)[number];

export interface Draft {
  title: string | null;
  questions: DraftQuestion[];
  tooManyOptions?: number;
  dropped?: number;
  durationMin?: number;
  /** Index of the question whose answer buttons are currently active. */
  cursor?: number;
  /** UTC ms of the confirmed / proposed start time. */
  scheduledAt?: number | null;
}

export interface Session {
  state: State;
  draft: Draft | null;
  /** UTC ms of the last write. */
  updatedAt: number;
}

export interface Button {
  text: string;
  data: string;
}
export interface Reply {
  text: string;
  buttons?: Button[][];
}

export type Effect = { type: 'parse_pdf'; fileId: string } | { type: 'create_exam'; scheduledAt: number | null };

export type PdfFailReason = 'read_failed' | 'timeout' | 'not_pdf' | 'too_large' | 'too_many_pages' | 'daily_limit';

export type FlowEvent =
  | { type: 'document'; fileId: string; fileName?: string; mimeType?: string; fileSize?: number }
  | { type: 'text'; text: string }
  | { type: 'button'; data: string }
  | { type: 'cancel' }
  | { type: 'newexam' }
  | { type: 'pdf_result'; ok: true; title: string | null; questions: DraftQuestion[]; tooManyOptions: number; dropped: number }
  | { type: 'pdf_result'; ok: false; reason: PdfFailReason }
  /** Outcome of create_exam; the text (final summary, failure or plan notice) is built by the caller. */
  | { type: 'exam_result'; text: string };

export interface StepCtx {
  lang: Lang;
  now: number;
  limits: TelegramLimits;
}

export interface StepResult {
  session: Session;
  replies: Reply[];
  effect?: Effect;
}

export const DURATION_CHOICES = [10, 20, 30, 45, 60] as const;
export const MIN_EXAM_MINUTES = 1;
export const MAX_EXAM_MINUTES = 300;
export const MAX_TITLE_CHARS = 120;

export function idleSession(now: number): Session {
  return { state: 'idle', draft: null, updatedAt: now };
}

/** Expired (24 h) sessions and stuck background states start over. */
export function normalizeSession(s: Session | null, now: number): Session {
  if (!s || !(STATES as readonly string[]).includes(s.state)) return idleSession(now);
  const age = now - s.updatedAt;
  if (!Number.isFinite(age) || age > SESSION_TTL_MS) return idleSession(now);
  if ((s.state === 'processing' || s.state === 'creating') && age > PROCESSING_STALE_MS) return idleSession(now);
  if (s.state !== 'idle' && s.state !== 'awaiting_pdf' && s.state !== 'processing' && !s.draft) return idleSession(now);
  return s;
}

/**
 * The exam's time is enforced per question in Examly (questions.time_limit_seconds,
 * 30-600 s), so the total is split evenly across the questions and clamped.
 */
export function secondsPerQuestion(durationMin: number, questionCount: number): number {
  if (questionCount <= 0) return MIN_QUESTION_TIME_LIMIT_SECONDS;
  const raw = Math.round((durationMin * 60) / questionCount);
  return Math.min(MAX_QUESTION_TIME_LIMIT_SECONDS, Math.max(MIN_QUESTION_TIME_LIMIT_SECONDS, raw));
}

export function missingAnswerCount(d: Draft | null): number {
  return d ? d.questions.filter((q) => q.correct === null).length : 0;
}

function nextMissing(questions: DraftQuestion[], from: number): number {
  for (let i = Math.max(0, from); i < questions.length; i++) if (questions[i].correct === null) return i;
  return -1;
}

export function parseMinutes(text: string): number | null {
  const s = text.trim().replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/\s*(min|mins|minutes|دقيقة|دقائق|د)$/i, '');
  if (!/^\d{1,3}$/.test(s)) return null;
  const n = Number(s);
  return n >= MIN_EXAM_MINUTES && n <= MAX_EXAM_MINUTES ? n : null;
}

// ─── Keyboards ──────────────────────────────────────────────────────────────

function reviewKeyboard(lang: Lang): Button[][] {
  const m = t(lang);
  return [[{ text: m.looksGood, data: 'ok' }, { text: m.cancel, data: 'cancel' }]];
}

function durationKeyboard(lang: Lang): Button[][] {
  const m = t(lang);
  const b = (n: number) => ({ text: m.minutes(n), data: `d:${n}` });
  return [[b(10), b(20), b(30)], [b(45), b(60), { text: m.other, data: 'd:other' }]];
}

function answerKeyboard(lang: Lang, index: number, optionCount: number): Button[][] {
  const m = t(lang);
  const letters = Array.from({ length: optionCount }, (_, k) => ({ text: 'ABCDEF'[k], data: `a:${index}:${k}` }));
  return [letters, [{ text: m.skip, data: `a:${index}:s` }], [{ text: m.allLater, data: 'a:later' }]];
}

function publishKeyboard(lang: Lang): Button[][] {
  const m = t(lang);
  return [[{ text: m.publishNow, data: 'pub' }, { text: m.schedule, data: 'sch' }]];
}

function confirmKeyboard(lang: Lang): Button[][] {
  const m = t(lang);
  return [[{ text: m.confirm, data: 'schok' }, { text: m.change, data: 'schno' }]];
}

// ─── Transitions ────────────────────────────────────────────────────────────

function to(state: State, draft: Draft | null, now: number): Session {
  return { state, draft, updatedAt: now };
}

function questionReply(lang: Lang, d: Draft, i: number): Reply {
  const q = d.questions[i];
  return { text: t(lang).question(i + 1, d.questions.length, q.text, q.options), buttons: answerKeyboard(lang, i, q.options.length) };
}

function goDuration(d: Draft, ctx: StepCtx): StepResult {
  return { session: to('duration', d, ctx.now), replies: [{ text: t(ctx.lang).askDuration, buttons: durationKeyboard(ctx.lang) }] };
}

function goPublishChoice(d: Draft, ctx: StepCtx): StepResult {
  const draft = { ...d, cursor: undefined };
  return {
    session: to('publish_choice', draft, ctx.now),
    replies: [{ text: t(ctx.lang).askPublish(missingAnswerCount(draft)), buttons: publishKeyboard(ctx.lang) }],
  };
}

function goAnswers(d: Draft, ctx: StepCtx, intro: boolean): StepResult {
  const i = nextMissing(d.questions, d.cursor === undefined ? 0 : d.cursor);
  if (i < 0) return goPublishChoice(d, ctx);
  const draft = { ...d, cursor: i };
  const replies: Reply[] = [];
  if (intro) replies.push({ text: t(ctx.lang).missingIntro(missingAnswerCount(draft)) });
  replies.push(questionReply(ctx.lang, draft, i));
  return { session: to('answers', draft, ctx.now), replies };
}

function afterDuration(d: Draft, minutes: number, ctx: StepCtx): StepResult {
  return goAnswers({ ...d, durationMin: minutes, cursor: 0 }, ctx, true);
}

const reply = (session: Session, text: string): StepResult => ({ session, replies: [{ text }] });

export function step(input: Session, event: FlowEvent, ctx: StepCtx): StepResult {
  const m = t(ctx.lang);
  const s = normalizeSession(input, ctx.now);
  const d = s.draft;

  if (event.type === 'cancel' || (event.type === 'button' && event.data === 'cancel' && s.state !== 'creating')) {
    return reply(idleSession(ctx.now), m.cancelled);
  }

  // Background results only apply to the state that asked for them (a /cancel in between wins).
  if (event.type === 'pdf_result') {
    if (s.state !== 'processing') return { session: s, replies: [] };
    if (!event.ok) {
      const text =
        event.reason === 'timeout'
          ? m.timeout
          : event.reason === 'not_pdf'
            ? m.notPdf
            : event.reason === 'too_large'
              ? m.tooLarge(Math.round(ctx.limits.maxPdfBytes / (1024 * 1024)))
              : event.reason === 'too_many_pages'
                ? m.tooManyPages(ctx.limits.maxPdfPages)
                : event.reason === 'daily_limit'
                  ? m.dailyLimit(ctx.limits.maxPdfsPerDay)
                  : m.readFailed;
      return reply(idleSession(ctx.now), text);
    }
    if (event.questions.length === 0) return reply(idleSession(ctx.now), m.noMcq);
    const draft: Draft = {
      title: event.title,
      questions: event.questions,
      tooManyOptions: event.tooManyOptions,
      dropped: event.dropped,
    };
    const withAnswer = event.questions.filter((q) => q.correct !== null).length;
    return {
      session: to('review', draft, ctx.now),
      replies: [
        {
          text: m.summary({ count: event.questions.length, withAnswer, tooManyOptions: event.tooManyOptions, dropped: event.dropped }),
          buttons: reviewKeyboard(ctx.lang),
        },
      ],
    };
  }

  if (event.type === 'exam_result') {
    if (s.state !== 'creating') return { session: s, replies: [] };
    return reply(idleSession(ctx.now), event.text);
  }

  if (event.type === 'newexam') {
    if (s.state === 'processing') return reply(s, m.busy);
    if (s.state !== 'idle' && s.state !== 'awaiting_pdf') return reply(s, m.draftInProgress);
    return reply(to('awaiting_pdf', null, ctx.now), m.newExam);
  }

  if (event.type === 'document') {
    if (s.state === 'processing') return reply(s, m.busy);
    if (s.state !== 'idle' && s.state !== 'awaiting_pdf') return reply(s, m.draftInProgress);
    const meta = checkPdfMeta({ mime_type: event.mimeType, file_name: event.fileName, file_size: event.fileSize }, ctx.limits.maxPdfBytes);
    if (!meta.ok) {
      return reply(s, meta.reason === 'not_pdf' ? m.notPdf : m.tooLarge(Math.round(ctx.limits.maxPdfBytes / (1024 * 1024))));
    }
    return {
      session: to('processing', { title: null, questions: [] }, ctx.now),
      replies: [{ text: m.reading }],
      effect: { type: 'parse_pdf', fileId: event.fileId },
    };
  }

  if (event.type === 'text') {
    const text = event.text.trim();
    switch (s.state) {
      case 'idle':
        return reply(s, m.sendPdf);
      case 'awaiting_pdf':
        return reply(s, m.awaitingPdf);
      case 'processing':
        return reply(s, m.busy);
      case 'title': {
        const title = text.replace(/\s+/g, ' ');
        if (!title || title.length > MAX_TITLE_CHARS) return reply(s, m.titleInvalid);
        return goDuration({ ...d!, title }, ctx);
      }
      case 'duration':
      case 'duration_other': {
        const n = parseMinutes(text);
        if (n === null) return reply(s, m.minutesInvalid);
        return afterDuration(d!, n, ctx);
      }
      case 'schedule_input': {
        const p = parseScheduleInput(text, ctx.now);
        if (!p.ok) {
          return reply(s, p.reason === 'past' ? m.schedulePast : p.reason === 'too_far' ? m.scheduleTooFar : m.scheduleUnrecognized);
        }
        return {
          session: to('schedule_confirm', { ...d!, scheduledAt: p.at }, ctx.now),
          replies: [{ text: m.scheduleConfirm(formatCairo(p.at, ctx.lang)), buttons: confirmKeyboard(ctx.lang) }],
        };
      }
      default:
        return reply(s, m.draftInProgress);
    }
  }

  // Buttons
  const data = event.data;
  const stale = () => reply(s, m.stale);
  switch (s.state) {
    case 'review':
      if (data !== 'ok') return stale();
      if (!d!.title) return { session: to('title', d, ctx.now), replies: [{ text: m.askTitle }] };
      return goDuration(d!, ctx);
    case 'duration': {
      if (data === 'd:other') return { session: to('duration_other', d, ctx.now), replies: [{ text: m.askMinutes }] };
      const mm = /^d:(\d+)$/.exec(data);
      const n = mm ? Number(mm[1]) : NaN;
      if (!(DURATION_CHOICES as readonly number[]).includes(n)) return stale();
      return afterDuration(d!, n, ctx);
    }
    case 'answers': {
      if (data === 'a:later') return goPublishChoice(d!, ctx);
      const am = /^a:(\d+):(s|\d)$/.exec(data);
      if (!am || Number(am[1]) !== d!.cursor) return stale();
      const i = Number(am[1]);
      const q = d!.questions[i];
      if (!q) return stale();
      let questions = d!.questions;
      if (am[2] !== 's') {
        const k = Number(am[2]);
        if (k < 0 || k >= q.options.length) return stale();
        questions = questions.map((x, j) => (j === i ? { ...x, correct: k } : x));
      }
      return goAnswers({ ...d!, questions, cursor: i + 1 }, ctx, false);
    }
    case 'publish_choice':
      if (data === 'pub') {
        return { session: to('creating', { ...d!, scheduledAt: null }, ctx.now), replies: [{ text: m.creating }], effect: { type: 'create_exam', scheduledAt: null } };
      }
      if (data === 'sch') return { session: to('schedule_input', d, ctx.now), replies: [{ text: m.askSchedule }] };
      return stale();
    case 'schedule_confirm':
      if (data === 'schno') return { session: to('schedule_input', { ...d!, scheduledAt: null }, ctx.now), replies: [{ text: m.askSchedule }] };
      if (data === 'schok') {
        const at = d!.scheduledAt;
        if (typeof at !== 'number' || at <= ctx.now) {
          return { session: to('schedule_input', { ...d!, scheduledAt: null }, ctx.now), replies: [{ text: m.schedulePast }] };
        }
        return { session: to('creating', d, ctx.now), replies: [{ text: m.creating }], effect: { type: 'create_exam', scheduledAt: at } };
      }
      return stale();
    default:
      return stale();
  }
}
