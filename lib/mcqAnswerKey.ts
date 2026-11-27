/**
 * Setting the correct option of a stored MCQ question (questions.model_answer_text is
 * JSON: { options, correctOptionIndex, explanation }). Used by the exam detail page so
 * a teacher can fill in answers left open (e.g. by the Telegram import) before
 * publishing. Pure; unit-tested in tests/unit/mcqAnswerKey.test.ts.
 */

export function readCorrectOption(modelAnswerText: string | null | undefined): number | null {
  try {
    const v = JSON.parse(modelAnswerText || '') as { correctOptionIndex?: unknown };
    return Number.isInteger(v.correctOptionIndex) ? (v.correctOptionIndex as number) : null;
  } catch {
    return null;
  }
}

/** New model_answer_text with `index` as the correct option, or null if the stored value is not an MCQ key or the index is out of range. */
export function withCorrectOption(modelAnswerText: string | null | undefined, index: number): string | null {
  let v: { options?: unknown; correctOptionIndex?: unknown; explanation?: unknown };
  try {
    v = JSON.parse(modelAnswerText || '');
  } catch {
    return null;
  }
  if (!v || typeof v !== 'object' || !Array.isArray(v.options)) return null;
  if (!Number.isInteger(index) || index < 0 || index >= v.options.length) return null;
  return JSON.stringify({
    options: v.options.map((o) => String(o ?? '')),
    correctOptionIndex: index,
    explanation: typeof v.explanation === 'string' ? v.explanation : '',
  });
}
