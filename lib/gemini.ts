/**
 * Gemini model configuration shared by the AI routes.
 *
 * Model IDs verified on 2026-11-26 against Google's official model list
 * (https://aistudio.google.com/docs/models, where ai.google.dev/gemini-api/docs/models
 * redirects) and deprecations page (https://aistudio.google.com/docs/deprecations):
 *   - gemini-3.6-flash      Stable; text + PDF input  (default primary)
 *   - gemini-3.5-flash-lite Stable; text + PDF input  (default fallback)
 *   - gemini-3.8-flash      Stable; newest Flash      (opt in via env)
 *   - gemini-2.5-flash      Deprecated, shutdown 2026-12-01, no PDF input (no longer used)
 *   - gemini-1.5-flash      Not listed at all          (no longer used)
 * Google recommends pinning a specific stable model for production rather than a
 * "-latest" alias, so the defaults are pinned and overridable:
 *   GEMINI_MODEL_PRIMARY, GEMINI_MODEL_FALLBACK
 */

export const DEFAULT_GEMINI_PRIMARY_MODEL = 'gemini-3.6-flash';
export const DEFAULT_GEMINI_FALLBACK_MODEL = 'gemini-3.5-flash-lite';

const MODEL_ID_RE = /^[a-z0-9][a-z0-9.-]{2,63}$/;

/** [primary, fallback] model IDs (deduplicated; invalid env values fall back to defaults). */
export function geminiModels(env: Record<string, string | undefined> = process.env): string[] {
  const pick = (value: string | undefined, fallback: string) => {
    const v = value?.trim();
    return v && MODEL_ID_RE.test(v) ? v : fallback;
  };
  const primary = pick(env.GEMINI_MODEL_PRIMARY, DEFAULT_GEMINI_PRIMARY_MODEL);
  const fallback = pick(env.GEMINI_MODEL_FALLBACK, DEFAULT_GEMINI_FALLBACK_MODEL);
  return primary === fallback ? [primary] : [primary, fallback];
}

/** Removes a ```json ... ``` (or plain ```) fence around a model's JSON reply. */
export function stripJsonFence(text: string): string {
  const t = text.trim();
  if (t.startsWith('```json')) return t.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  if (t.startsWith('```')) return t.replace(/^```\s*/, '').replace(/\s*```$/, '');
  return t;
}

/** Admin-only label of the configured models, e.g. "gemini-3.6-flash (primary), gemini-3.5-flash-lite (fallback)". */
export function describeGeminiModels(env: Record<string, string | undefined> = process.env): string {
  const [primary, fallback] = geminiModels(env);
  return fallback ? `${primary} (primary), ${fallback} (fallback)` : `${primary} (primary, no separate fallback)`;
}
