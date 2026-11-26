/**
 * Exam language (exams.language, migration 004) and the wrong-language policy.
 * Pure: shared by the builder, /join, /transcribe, /evaluate and the review page.
 *
 * Every code below is listed for Deepgram `nova-3` (pre-recorded) on
 * https://developers.deepgram.com/docs/models-languages-overview (checked 2026-11-26):
 *   English: en, en-US, en-GB, en-AU, en-IN, en-NZ
 *   Arabic:  ar, ar-AE, ar-SA, ar-QA, ar-KW, ar-SY, ar-LB, ar-PS, ar-JO, ar-EG, ar-SD,
 *            ar-TD, ar-MA, ar-DZ, ar-TN, ar-IQ, ar-IR
 *   French fr, Spanish es, German de.
 * nova-2 has no Arabic code, and `detect_language` doesn't cover Arabic
 * (https://developers.deepgram.com/docs/language-detection), so the teacher must pick
 * the language explicitly; see lib/deepgram.ts for the fallback rule.
 */

export interface ExamLanguage {
  code: string;
  label: string;
}

export const EXAM_LANGUAGES: readonly ExamLanguage[] = [
  { code: 'en', label: 'English' },
  { code: 'en-US', label: 'English (United States)' },
  { code: 'en-GB', label: 'English (United Kingdom)' },
  { code: 'en-AU', label: 'English (Australia)' },
  { code: 'en-IN', label: 'English (India)' },
  { code: 'en-NZ', label: 'English (New Zealand)' },
  { code: 'ar', label: 'Arabic' },
  { code: 'ar-EG', label: 'Arabic (Egypt)' },
  { code: 'ar-SA', label: 'Arabic (Saudi Arabia)' },
  { code: 'ar-AE', label: 'Arabic (United Arab Emirates)' },
  { code: 'ar-QA', label: 'Arabic (Qatar)' },
  { code: 'ar-KW', label: 'Arabic (Kuwait)' },
  { code: 'ar-JO', label: 'Arabic (Jordan)' },
  { code: 'ar-LB', label: 'Arabic (Lebanon)' },
  { code: 'ar-SY', label: 'Arabic (Syria)' },
  { code: 'ar-PS', label: 'Arabic (Palestine)' },
  { code: 'ar-IQ', label: 'Arabic (Iraq)' },
  { code: 'ar-SD', label: 'Arabic (Sudan)' },
  { code: 'ar-TD', label: 'Arabic (Chad)' },
  { code: 'ar-MA', label: 'Arabic (Morocco)' },
  { code: 'ar-DZ', label: 'Arabic (Algeria)' },
  { code: 'ar-TN', label: 'Arabic (Tunisia)' },
  { code: 'ar-IR', label: 'Arabic (Iran)' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },
];

export const DEFAULT_EXAM_LANGUAGE = 'en';

const BY_CODE = new Map(EXAM_LANGUAGES.map((l) => [l.code, l]));

export function isExamLanguage(value: unknown): value is string {
  return typeof value === 'string' && BY_CODE.has(value);
}

/** A supported code, or 'en' (older exams have no language; unknown values never reach Deepgram). */
export function normalizeExamLanguage(value: unknown): string {
  return isExamLanguage(value) ? value : DEFAULT_EXAM_LANGUAGE;
}

export function examLanguageLabel(code: unknown): string {
  return BY_CODE.get(normalizeExamLanguage(code))!.label;
}

/** Text direction for UI (Arabic is right-to-left). */
export function examLanguageDir(code: unknown): 'rtl' | 'ltr' {
  return normalizeExamLanguage(code).startsWith('ar') ? 'rtl' : 'ltr';
}

// ─── Wrong-language policy ──────────────────────────────────────────────────

export const WRONG_LANGUAGE_POLICIES = ['review', 'penalize', 'ignore'] as const;
export type WrongLanguagePolicy = (typeof WRONG_LANGUAGE_POLICIES)[number];
export const DEFAULT_WRONG_LANGUAGE_POLICY: WrongLanguagePolicy = 'review';

export const WRONG_LANGUAGE_POLICY_LABELS: Record<WrongLanguagePolicy, string> = {
  review: 'Send to teacher review (no automatic penalty)',
  penalize: 'Score the answer 0',
  ignore: 'Grade the content anyway',
};

export function normalizeWrongLanguagePolicy(value: unknown): WrongLanguagePolicy {
  return typeof value === 'string' && (WRONG_LANGUAGE_POLICIES as readonly string[]).includes(value)
    ? (value as WrongLanguagePolicy)
    : DEFAULT_WRONG_LANGUAGE_POLICY;
}
