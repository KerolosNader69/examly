/**
 * Production wiring for the bot (Supabase service role, Telegram API, AI provider,
 * Upstash limiters). Server-only. Imported by the webhook route.
 */
import { GoogleGenAI, createPartFromBase64 } from '@google/genai';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { geminiModels } from '@/lib/gemini';
import { generateWithFallback, isAiTimeout } from '@/lib/aiDocument';
import { getRateLimiter } from '@/lib/rateLimit';
import { createTelegramApi } from './api';
import type { BotDeps, ExtractOutcome } from './bot';
import { appBaseUrl, telegramLimits } from './config';
import { EXTRACTION_JSON_SCHEMA, EXTRACTION_SYSTEM_INSTRUCTION, EXTRACTION_USER_TEXT, parseExtraction } from './extract';
import { createBotStore } from './store';

const AI_TIMEOUT_MS = 50_000;

export function botStore() {
  return createBotStore(supabaseAdmin);
}

async function extractWithAi(bytes: Uint8Array): Promise<ExtractOutcome> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { type: 'pdf_result', ok: false, reason: 'read_failed' };
  const ai = new GoogleGenAI({ apiKey });
  const [primary, fallback = primary] = geminiModels();
  let text: string;
  try {
    text = await generateWithFallback({
      ai,
      models: [primary, fallback],
      contents: [
        {
          role: 'user',
          parts: [createPartFromBase64(Buffer.from(bytes).toString('base64'), 'application/pdf'), { text: EXTRACTION_USER_TEXT }],
        },
      ],
      config: {
        systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseJsonSchema: EXTRACTION_JSON_SCHEMA,
        temperature: 0,
      },
      timeoutMs: AI_TIMEOUT_MS,
      label: 'telegram-PDF',
    });
  } catch (err) {
    return { type: 'pdf_result', ok: false, reason: isAiTimeout(err) ? 'timeout' : 'read_failed' };
  }
  const parsed = parseExtraction(text);
  if (!parsed.ok) return { type: 'pdf_result', ok: false, reason: 'read_failed' };
  return { type: 'pdf_result', ok: true, title: parsed.title, questions: parsed.questions, tooManyOptions: parsed.tooManyOptions, dropped: parsed.dropped };
}

export function createBotDeps(): BotDeps | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return null;
  const limits = telegramLimits();
  return {
    store: botStore(),
    telegram: createTelegramApi(token),
    linkLimiter: getRateLimiter({ name: 'telegram-link-chat', max: 10, windowMs: 10 * 60 * 1000 }),
    pdfDailyLimiter: getRateLimiter({ name: 'telegram-pdf-teacher-day', max: limits.maxPdfsPerDay, windowMs: 24 * 60 * 60 * 1000 }),
    extract: extractWithAi,
    limits,
    baseUrl: appBaseUrl(),
    now: () => Date.now(),
    log: (event, counts) => console.info(`[telegram] ${event}`, counts ? JSON.stringify(counts) : ''),
  };
}
