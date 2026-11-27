/**
 * PDF checks for files sent to the bot. Pure; the bytes are never logged.
 */

export type PdfMetaCheck = { ok: true } | { ok: false; reason: 'not_pdf' | 'too_large' };

/** Cheap check on Telegram's document metadata, before downloading anything. */
export function checkPdfMeta(
  doc: { mime_type?: string; file_name?: string; file_size?: number },
  maxBytes: number
): PdfMetaCheck {
  const name = (doc.file_name || '').toLowerCase();
  const mime = (doc.mime_type || '').toLowerCase();
  if (mime !== 'application/pdf' && !name.endsWith('.pdf')) return { ok: false, reason: 'not_pdf' };
  if (typeof doc.file_size === 'number' && doc.file_size > maxBytes) return { ok: false, reason: 'too_large' };
  return { ok: true };
}

/** Best-effort page count: the largest /Count of a /Pages node, or the number of /Type /Page objects. */
export function estimatePdfPages(bytes: Uint8Array): number {
  const text = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('latin1');
  let count = 0;
  const pagesRe = /\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/g;
  for (let m = pagesRe.exec(text); m; m = pagesRe.exec(text)) {
    const n = Number(m[1] ?? m[2]);
    if (Number.isFinite(n) && n > count) count = n;
  }
  const pageObjects = (text.match(/\/Type\s*\/Page(?![A-Za-z])/g) || []).length;
  return Math.max(count, pageObjects);
}

export type PdfBytesCheck = { ok: true; pages: number } | { ok: false; reason: 'not_pdf' | 'too_large' | 'too_many_pages' };

/** Real PDF (%PDF magic), size and page caps. A page count of 0 (unreadable structure) is allowed; the size cap still applies. */
export function checkPdfBytes(bytes: Uint8Array, limits: { maxPdfBytes: number; maxPdfPages: number }): PdfBytesCheck {
  if (bytes.length > limits.maxPdfBytes) return { ok: false, reason: 'too_large' };
  const isPdf = bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
  if (!isPdf) return { ok: false, reason: 'not_pdf' };
  const pages = estimatePdfPages(bytes);
  if (pages > limits.maxPdfPages) return { ok: false, reason: 'too_many_pages' };
  return { ok: true, pages };
}
