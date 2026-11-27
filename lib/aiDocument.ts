/**
 * One AI call with a timeout and a single fallback model. Shared by
 * /api/exam/generate-from-pdf and the Telegram bot's PDF import so the retry /
 * timeout behaviour lives in one place.
 *
 *   - primary call times out          -> throws AiTimeoutError (no fallback; the caller reports a timeout)
 *   - primary fails for another reason -> logs the error NAME only and tries the fallback model
 *   - fallback times out               -> AiTimeoutError; any other fallback error is rethrown
 */
import type { GoogleGenAI } from '@google/genai';

export class AiTimeoutError extends Error {
  constructor(seconds: number) {
    super(`AI processing timed out after ${seconds} seconds.`);
    this.name = 'AbortError';
  }
}

export function isAiTimeout(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { name?: unknown }).name === 'AbortError');
}

type GenerateParams = Parameters<GoogleGenAI['models']['generateContent']>[0];

export interface AiCallOptions {
  ai: GoogleGenAI;
  /** [primary, fallback]; a single entry means "no different fallback" (the primary is retried once). */
  models: string[];
  contents: GenerateParams['contents'];
  config?: GenerateParams['config'];
  timeoutMs: number;
  /** Short label for the warning log line, e.g. "PDF". Never document content. */
  label: string;
}

async function callOnce(ai: GoogleGenAI, model: string, contents: GenerateParams['contents'], config: GenerateParams['config'], timeoutMs: number): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AiTimeoutError(Math.round(timeoutMs / 1000))), timeoutMs);
  });
  try {
    const response = await Promise.race([ai.models.generateContent({ model, contents, ...(config ? { config } : {}) }), timeout]);
    return response.text || '';
  } finally {
    clearTimeout(timer);
  }
}

export async function generateWithFallback(opts: AiCallOptions): Promise<string> {
  const [primary, fallback = primary] = opts.models;
  try {
    return await callOnce(opts.ai, primary, opts.contents, opts.config, opts.timeoutMs);
  } catch (err) {
    if (isAiTimeout(err)) throw err;
    console.warn(`Gemini ${primary} ${opts.label} call failed, trying ${fallback}...`, err instanceof Error ? err.name : 'UnknownError');
    return callOnce(opts.ai, fallback, opts.contents, opts.config, opts.timeoutMs);
  }
}
