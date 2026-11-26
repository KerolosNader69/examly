/**
 * Pure validation/normalisation for the public contact form (tests/unit/contact.test.ts).
 */

export const CONTACT_LIMITS = {
  name: 100,
  email: 254,
  subject: 150,
  message: 5000,
  minMessage: 10,
} as const;

// Conservative address check: one @, a dotted domain, no spaces/quotes/angle brackets.
const EMAIL_RE = /^[A-Za-z0-9.!#$%&*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

/** Single-line field: control characters (incl. CR/LF, which enable header injection) become spaces. */
function singleLine(value: unknown, max: number): string {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
}

export function isValidContactEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= CONTACT_LIMITS.email && EMAIL_RE.test(value);
}

export type ContactInput = { name: string; email: string; subject: string; message: string };

export function validateContactInput(body: unknown): { ok: true; value: ContactInput } | { ok: false; error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const name = singleLine(b.name, CONTACT_LIMITS.name);
  const email = singleLine(b.email, CONTACT_LIMITS.email + 1).toLowerCase();
  const subject = singleLine(b.subject, CONTACT_LIMITS.subject) || 'General Inquiry';
  // Multi-line, but strip other control characters.
  const message = String(b.message ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();

  if (!name) return { ok: false, error: 'Full name is required' };
  if (!isValidContactEmail(email)) return { ok: false, error: 'Valid email address is required' };
  if (message.length < CONTACT_LIMITS.minMessage) return { ok: false, error: 'Message must be at least 10 characters long' };
  if (message.length > CONTACT_LIMITS.message) return { ok: false, error: `Message must be at most ${CONTACT_LIMITS.message} characters` };
  return { ok: true, value: { name, email, subject, message } };
}
