/**
 * POST /api/telegram/webhook logic, with injected deps (tested in
 * tests/unit/telegramWebhook.test.ts; wired in app/api/telegram/webhook/route.ts).
 *
 *   flag off                    -> 404 (indistinguishable from a missing route)
 *   bad/missing secret header   -> 401 (constant-time compare; fails closed without a secret)
 *   unparseable / no update_id  -> 200, ignored (Telegram must not retry garbage)
 *   update_id already seen      -> 200, ignored (idempotent retries)
 *   chat over its rate limit    -> 200, dropped
 *   otherwise                   -> 200 at once; the update is processed in the background
 */
import type { TgUpdate } from './api.ts';
import { isTelegramBotEnabled } from './config.ts';
import { isValidWebhookSecret } from './security.ts';

export const SECRET_HEADER = 'x-telegram-bot-api-secret-token';
const MAX_BODY_BYTES = 1024 * 1024;

export interface WebhookDeps {
  env: Record<string, string | undefined>;
  markUpdateSeen(updateId: number): Promise<'new' | 'duplicate' | 'error'>;
  chatLimiter: { limit(key: string): Promise<{ allowed: boolean }> };
  /** Runs `task` after the response is sent (next/server `after`). */
  background(task: () => Promise<void>): void;
  process(update: TgUpdate): Promise<void>;
  log(event: string): void;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export function chatIdOf(u: TgUpdate): number | null {
  const id = u.message?.chat?.id ?? u.callback_query?.message?.chat?.id;
  return typeof id === 'number' ? id : null;
}

export async function handleWebhook(request: Request, deps: WebhookDeps): Promise<Response> {
  if (!isTelegramBotEnabled(deps.env)) return new Response('Not Found', { status: 404 });
  if (!isValidWebhookSecret(request.headers.get(SECRET_HEADER), deps.env.TELEGRAM_WEBHOOK_SECRET)) {
    deps.log('unauthorized');
    return json(401, { ok: false });
  }

  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_BODY_BYTES) return json(200, { ok: true });
  let update: TgUpdate;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return json(200, { ok: true });
    update = JSON.parse(text) as TgUpdate;
  } catch {
    return json(200, { ok: true });
  }
  if (!update || !Number.isSafeInteger(update.update_id)) return json(200, { ok: true });

  const seen = await deps.markUpdateSeen(update.update_id);
  if (seen !== 'new') {
    deps.log(seen === 'duplicate' ? 'duplicate' : 'dedupe_error');
    return json(200, { ok: true });
  }

  const chatId = chatIdOf(update);
  if (chatId === null) return json(200, { ok: true });
  const rl = await deps.chatLimiter.limit(`chat:${chatId}`);
  if (!rl.allowed) {
    deps.log('rate_limited');
    return json(200, { ok: true });
  }

  deps.background(async () => {
    try {
      await deps.process(update);
    } catch (err) {
      deps.log(`process_error:${err instanceof Error ? err.name : 'UnknownError'}`);
    }
  });
  return json(200, { ok: true });
}
