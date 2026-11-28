/** Pure helpers for the teacher review page (tests/unit/grading.test.ts). */

/** Teacher override input -> integer 0..100, or null if it isn't a valid score. */
export function parseOverrideScore(input: unknown): number | null {
  const raw = typeof input === 'number' ? input : typeof input === 'string' && input.trim() !== '' ? Number(input.trim()) : NaN;
  if (!Number.isFinite(raw) || !Number.isInteger(raw) || raw < 0 || raw > 100) return null;
  return raw;
}

/**
 * Value pre-filled in the "Teacher Grade Override" box. The teacher's own score always
 * wins; then a final AI score (oral exams); then an AI-SUGGESTED essay score
 * (summary.aiSuggestedScore, lib/essayGrading.ts), which only becomes a score when the
 * teacher saves it. Empty string = nothing to suggest.
 */
export function initialOverrideValue(r: { teacher_override_score?: number | null; ai_score?: number | null; breakdown?: Record<string, unknown> | null }): string {
  if (r.teacher_override_score != null) return String(r.teacher_override_score);
  if (r.ai_score != null) return String(r.ai_score);
  const s = r.breakdown?.aiSuggestedScore;
  return typeof s === 'number' && Number.isInteger(s) && s >= 0 && s <= 100 ? String(s) : '';
}

/** True while an essay's AI suggestion exists but the teacher has not saved a score. */
export function essayScoreUnconfirmed(r: { teacher_override_score?: number | null; breakdown?: Record<string, unknown> | null }): boolean {
  return r.teacher_override_score == null && typeof r.breakdown?.aiSuggestedScore === 'number';
}

/** Teacher-facing label for one essay answer's AI suggestion state (lib/essayGrading.ts). Client-safe. */
export function essaySuggestionLabel(status: unknown): string {
  switch (status) {
    case 'suggested':
      return 'AI-suggested (not final until you save a score)';
    case 'no_answer':
      return 'No answer: nothing to grade';
    case 'not_graded_cap':
      return 'Not sent to AI (answer limit per exam reached): grade manually';
    case 'unparseable':
      return 'AI reply was invalid: grade manually';
    case 'unavailable':
    default:
      return 'AI suggestion unavailable: grade manually';
  }
}
