/**
 * Safe construction of PostgREST `or=(...)` search filters from user input
 * (tests/unit/postgrestFilter.test.ts).
 *
 * supabase-js `.or()` takes a raw filter string, so interpolating user text lets it
 * inject syntax: commas add conditions, parentheses add groups, dots/colons change
 * operators. We therefore:
 *   1. keep only an allow-list of characters (letters, digits, space, @ . _ - +),
 *   2. cap the length,
 *   3. wrap the value in double quotes (PostgREST's quoting for reserved characters).
 */

const MAX_TERM_CHARS = 100;
const COLUMN_RE = /^[a-z_][a-z0-9_]*$/;

export function sanitizeSearchTerm(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N} @._+-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TERM_CHARS);
}

/** `col1.ilike."%term%",col2.ilike."%term%"` or null when the term is empty after sanitising. */
export function ilikeAnyFilter(columns: readonly string[], raw: unknown): string | null {
  const term = sanitizeSearchTerm(raw);
  if (!term) return null;
  for (const c of columns) {
    if (!COLUMN_RE.test(c)) throw new Error(`Invalid column name: ${c}`);
  }
  // After sanitising, the term contains no quotes or backslashes, so quoting is safe.
  return columns.map((c) => `${c}.ilike."%${term}%"`).join(',');
}
