/**
 * Deterministic, server-side check of whether a speech transcript is really in the exam
 * language. Pure (tests/unit/languageCheck.test.ts).
 *
 * Why this exists: Deepgram is called with the EXAM's language (e.g. `language=en`), so an
 * answer spoken in another language comes back as plausible-looking text in the exam
 * language ("Oh, I see.", "Meyer Barbein."). The grader then sees English and reports that
 * the language matches. The STT signals below catch that case without relying on the AI:
 *
 *  - foreign_script      letters mostly in a script the exam language doesn't use
 *  - detected_language   Deepgram reported a detected language other than the exam's
 *  - low_confidence      transcript-level confidence below LOW_STT_CONFIDENCE
 *  - low_word_confidence most recognised words have a low confidence
 *
 * "Definitive" reasons (foreign_script, detected_language) say the answer IS in another
 * language. The others only say the transcript is unreliable; the penalize policy never
 * scores those 0 (see questionPatchFromGrade).
 */

import { normalizeExamLanguage } from './examLanguage.ts';

/** Transcript-level confidence below this is treated as a likely wrong-language/misheard answer. Also used by the review UI. */
export const LOW_STT_CONFIDENCE = 0.6;
/** A recognised word below this confidence counts as "low". */
export const LOW_WORD_CONFIDENCE = 0.5;
/** Share of low-confidence words (with at least MIN_WORDS_FOR_RATIO words) that flags the answer. */
export const LOW_WORD_RATIO = 0.5;
const MIN_WORDS_FOR_RATIO = 2;
/** Share of letters in an unexpected script that flags the answer. */
const FOREIGN_SCRIPT_RATIO = 0.3;
/** Transcripts this short are "no speech", handled by /evaluate before any language check. */
const MIN_TRANSCRIPT_CHARS = 3;

export const LANGUAGE_SIGNAL_REASONS = ['foreign_script', 'detected_language', 'low_confidence', 'low_word_confidence', 'grader_wrong_language', 'grader_incoherent'] as const;
export type LanguageSignalReason = (typeof LANGUAGE_SIGNAL_REASONS)[number];

/** Reasons that establish the answer is in another language (not just an unreliable transcript). */
export const DEFINITIVE_REASONS: ReadonlySet<LanguageSignalReason> = new Set(['foreign_script', 'detected_language', 'grader_wrong_language']);

export interface SttWord {
  confidence: number | null;
}

export interface TranscriptLanguageInput {
  transcript: string;
  /** Exam language code (exams.language). */
  language: string;
  /** Deepgram alternative confidence 0..1 (null/undefined = unknown). */
  confidence?: number | null;
  words?: readonly SttWord[] | null;
  /** Deepgram detected_language, only present when detection was requested. */
  detectedLanguage?: string | null;
}

const LATIN_RE = /[A-Za-zÀ-ɏ]/gu;
const LETTER_RE = /\p{L}/gu;

const count = (s: string, re: RegExp) => (s.match(re) || []).length;
const baseCode = (code: string) => code.split('-')[0].toLowerCase();

/** Ordered, de-duplicated reasons (stable output for storage and tests). */
export function mergeReasons(...lists: (readonly unknown[] | null | undefined)[]): LanguageSignalReason[] {
  const set = new Set<string>();
  for (const l of lists) for (const r of l || []) if (typeof r === 'string') set.add(r);
  return LANGUAGE_SIGNAL_REASONS.filter((r) => set.has(r));
}

/** STT-side signals that the transcript is not (reliably) in the exam language. Empty = no concern. */
export function assessTranscriptLanguage(input: TranscriptLanguageInput): LanguageSignalReason[] {
  const text = String(input.transcript ?? '').trim();
  if (text.length < MIN_TRANSCRIPT_CHARS) return [];
  const lang = normalizeExamLanguage(input.language);
  const reasons: LanguageSignalReason[] = [];

  const letters = count(text, LETTER_RE);
  if (letters > 0) {
    const expectedArabic = baseCode(lang) === 'ar';
    // Arabic exams: Latin letters (names, terms) are allowed, so flag only a mostly-Latin answer.
    const foreign = expectedArabic ? count(text, LATIN_RE) : letters - count(text, LATIN_RE);
    const limit = expectedArabic ? 0.5 : FOREIGN_SCRIPT_RATIO;
    if (foreign / letters >= limit) reasons.push('foreign_script');
  }

  const detected = typeof input.detectedLanguage === 'string' ? input.detectedLanguage.trim() : '';
  if (detected && baseCode(detected) !== baseCode(lang)) reasons.push('detected_language');

  const c = input.confidence;
  if (typeof c === 'number' && Number.isFinite(c) && c < LOW_STT_CONFIDENCE) reasons.push('low_confidence');

  const scored = (input.words || []).filter((w): w is { confidence: number } => typeof w?.confidence === 'number' && Number.isFinite(w.confidence));
  if (scored.length >= MIN_WORDS_FOR_RATIO) {
    const low = scored.filter((w) => w.confidence < LOW_WORD_CONFIDENCE).length;
    if (low / scored.length >= LOW_WORD_RATIO) reasons.push('low_word_confidence');
  }

  return mergeReasons(reasons);
}

const REASON_LABELS: Record<LanguageSignalReason, string> = {
  foreign_script: 'text in another script',
  detected_language: 'speech recognition detected another language',
  low_confidence: 'low transcription confidence',
  low_word_confidence: 'most words recognised with low confidence',
  grader_wrong_language: 'the AI grader reports another language',
  grader_incoherent: 'the transcript does not read as a meaningful answer',
};

/** Teacher-facing label for a stored reason (unknown values are shown as-is). */
export function languageReasonLabel(reason: unknown): string {
  return (REASON_LABELS as Record<string, string>)[String(reason)] ?? String(reason);
}
