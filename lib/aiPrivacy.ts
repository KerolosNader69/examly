/**
 * Data minimisation before text is sent to the AI provider. Pure; tests in
 * tests/unit/aiPrivacy.test.ts. Used by /api/exam/generate-insights (class summary)
 * and the essay grader (lib/essayGrading.ts).
 *
 * LIMITS (deliberately simple and deterministic, not a full PII detector):
 *  - redactPersonalData() removes only things with a recognisable shape: email
 *    addresses, links, phone numbers and long digit runs (Latin and Arabic-Indic digits).
 *  - A name the student says or writes inside an answer is NOT detected in general;
 *    pseudonymizeStudents() additionally replaces the names the students typed at
 *    join time, but any other name (a friend, a teacher, a nickname) stays in the text.
 */

/** Latin, Arabic-Indic (U+0660..) and Extended Arabic-Indic (U+06F0..) digits. */
const D = '[0-9\\u0660-\\u0669\\u06F0-\\u06F9]';

const EMAIL_RE = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/giu;
/** +20 100 123 4567, (02) 1234-5678, 0100-123-4567 ...: 8+ digits with separators. */
const PHONE_RE = new RegExp(`(?:\\+|00)?${D}(?:[\\s\\-.()]{0,2}${D}){7,}`, 'gu');
/** Any remaining run of 6+ digits (IDs, student numbers, card numbers). */
const LONG_DIGITS_RE = new RegExp(`${D}{6,}`, 'gu');

export function redactPersonalData(text: string): string {
  return String(text ?? '')
    .replace(EMAIL_RE, '[email]')
    .replace(URL_RE, '[link]')
    .replace(PHONE_RE, '[phone]')
    .replace(LONG_DIGITS_RE, '[number]');
}

/** Cuts text to `max` characters; `truncated` tells the caller to say so. */
export function capText(text: string, max: number): { text: string; truncated: boolean } {
  const t = String(text ?? '');
  return t.length > max ? { text: `${t.slice(0, max)} […]`, truncated: true } : { text: t, truncated: false };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Name pieces worth replacing: the full name and each part of 3+ letters. */
function nameVariants(name: string): string[] {
  const full = name.trim().replace(/\s+/g, ' ');
  if (full.length < 2) return [];
  const parts = full.split(' ').filter((p) => [...p].length >= 3);
  // Longest first so "Sara Ali" is replaced before "Sara".
  return [...new Set([full, ...parts])].sort((a, b) => b.length - a.length);
}

export interface Pseudonymized {
  /** Pseudonym ("Student 1", ...) for each input index. */
  pseudonyms: string[];
  /** pseudonym -> real name, kept on the server only. */
  map: Map<string, string>;
  /** Replaces every known real name (whole words, case-insensitive) with its pseudonym. */
  scrubNames: (text: string) => string;
}

/**
 * Stable pseudonyms in input order: names[i] -> "Student {i+1}". Two students with the
 * same name still get different pseudonyms (the map is by position, not by name).
 */
export function pseudonymizeStudents(names: readonly unknown[]): Pseudonymized {
  const pseudonyms = names.map((_, i) => `Student ${i + 1}`);
  const map = new Map<string, string>();
  const replacements: { re: RegExp; to: string }[] = [];
  names.forEach((raw, i) => {
    const name = typeof raw === 'string' ? raw : '';
    map.set(pseudonyms[i].toLowerCase(), name.trim() || pseudonyms[i]);
    for (const v of nameVariants(name)) {
      // Unicode-aware "whole word": not preceded/followed by a letter or digit (works for Arabic too).
      replacements.push({ re: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(v)}(?![\\p{L}\\p{N}])`, 'giu'), to: pseudonyms[i] });
    }
  });
  replacements.sort((a, b) => b.re.source.length - a.re.source.length);
  return {
    pseudonyms,
    map,
    scrubNames: (text: string) => replacements.reduce((t, r) => t.replace(r.re, r.to), String(text ?? '')),
  };
}

/**
 * "Student 12" -> real name. The number is read greedily and must not be followed by
 * another digit, so "Student 1" never matches inside "Student 10". Case-insensitive
 * ("student 3", "STUDENT 3"), any spacing, and safe next to Arabic text. Unknown
 * numbers are left as they are.
 */
const TOKEN_RE = /(?<![\p{L}\p{N}])student\s*(\d{1,4})(?!\d)/giu;

export function restoreNames(text: string, map: ReadonlyMap<string, string>): string {
  return String(text ?? '').replace(TOKEN_RE, (m, n: string) => map.get(`student ${Number(n)}`) ?? m);
}

/** restoreNames applied to every string inside a JSON-like value. */
export function restoreNamesDeep<T>(value: T, map: ReadonlyMap<string, string>): T {
  if (typeof value === 'string') return restoreNames(value, map) as T;
  if (Array.isArray(value)) return value.map((v) => restoreNamesDeep(v, map)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, restoreNamesDeep(v, map)])) as T;
  }
  return value;
}
