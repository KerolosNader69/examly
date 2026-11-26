/** Pure helpers for the teacher review page (tests/unit/grading.test.ts). */

/** Teacher override input -> integer 0..100, or null if it isn't a valid score. */
export function parseOverrideScore(input: unknown): number | null {
  const raw = typeof input === 'number' ? input : typeof input === 'string' && input.trim() !== '' ? Number(input.trim()) : NaN;
  if (!Number.isFinite(raw) || !Number.isInteger(raw) || raw < 0 || raw > 100) return null;
  return raw;
}
