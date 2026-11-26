/**
 * Open-redirect protection for `?next=` style parameters (tests/unit/safeRedirect.test.ts).
 *
 * Allows only a same-origin RELATIVE path that starts with exactly one "/". Rejects
 * "//host", backslashes (browsers treat "\" like "/"), any scheme or host, and any
 * control/whitespace characters (browsers strip tabs/newlines, so "/\t/evil.com"
 * would become "//evil.com"). The result is re-parsed against a dummy origin and
 * must stay on it.
 */
export function safeNextPath(next: unknown, fallback = '/dashboard'): string {
  if (typeof next !== 'string' || next.length === 0 || next.length > 2048) return fallback;
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  if (/[\\\u0000- \u007f]/.test(next)) return fallback;
  // Encoded slashes/backslashes right after the leading "/" (e.g. "/%2F%2Fevil.com").
  if (/^\/(%2f|%5c)/i.test(next)) return fallback;

  const base = 'https://examly.invalid';
  let url: URL;
  try {
    url = new URL(next, base);
  } catch {
    return fallback;
  }
  if (url.origin !== base) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
