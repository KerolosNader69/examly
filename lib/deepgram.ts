/**
 * Deepgram pre-recorded (/v1/listen) helpers. Pure (tests/unit/mediaCapture.test.ts).
 *
 * Verified 2026-11-26 against https://developers.deepgram.com/docs/models-languages-overview
 * and /docs/language-detection:
 *  - nova-3 supports Arabic monolingually (`ar`, `ar-EG`, `ar-SA`, ... ) and English.
 *  - nova-2 is still listed but has NO Arabic, so it is only a fallback for languages it supports.
 *  - `detect_language` covers 35 languages and Arabic is not among them, so automatic
 *    detection can't replace an explicit exam language for Arabic exams.
 *  - Response: results.channels[0].alternatives[0].{transcript, confidence}, metadata.duration.
 */

/** Languages for which nova-2 is an acceptable fallback (subset of its documented list). */
const NOVA2_OK = /^(en|es|fr|de|it|pt|nl|hi|ja|ko|zh|ru|tr|pl|sv|da|no|fi|id|ms|th|vi|uk|cs|el|hu|ro|sk|bg|ca|et|lt|lv)(-|$)/i;

export function deepgramModelsFor(language: string): [string, string | null] {
  return ['nova-3', NOVA2_OK.test(language) ? 'nova-2' : null];
}

export function deepgramListenUrl(model: string, language: string): string {
  const p = new URLSearchParams({ model, smart_format: 'true', punctuate: 'true', language });
  return `https://api.deepgram.com/v1/listen?${p.toString()}`;
}

export interface DeepgramParsed {
  transcript: string;
  confidence: number | null;
  duration: number | null;
}

export function parseDeepgramResult(json: unknown): DeepgramParsed {
  const r = (json && typeof json === 'object' ? json : {}) as {
    metadata?: { duration?: unknown };
    results?: { channels?: { alternatives?: { transcript?: unknown; confidence?: unknown }[] }[] };
  };
  const alt = r.results?.channels?.[0]?.alternatives?.[0];
  const duration = Number(r.metadata?.duration);
  const confidence = Number(alt?.confidence);
  return {
    transcript: String(alt?.transcript ?? '').slice(0, 20_000),
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : null,
    duration: Number.isFinite(duration) ? duration : null,
  };
}
