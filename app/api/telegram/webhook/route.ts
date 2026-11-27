import { after } from 'next/server';
import { getRateLimiter } from '@/lib/rateLimit';
import { processUpdate } from '@/lib/telegram/bot';
import { isTelegramBotEnabled, telegramLimits } from '@/lib/telegram/config';
import { botStore, createBotDeps } from '@/lib/telegram/services';
import { handleWebhook } from '@/lib/telegram/webhook';

export const dynamic = 'force-dynamic';
// Background PDF reading (AI provider call with one fallback) runs inside after().
export const maxDuration = 120;

/**
 * POST /api/telegram/webhook: Telegram Bot API updates. Inactive (404) unless
 * TELEGRAM_BOT_ENABLED=true. See lib/telegram/webhook.ts for the full contract.
 */
export async function POST(request: Request) {
  if (!isTelegramBotEnabled()) return new Response('Not Found', { status: 404 });
  const store = botStore();
  return handleWebhook(request, {
    env: process.env,
    markUpdateSeen: (id) => store.markUpdateSeen(id),
    chatLimiter: getRateLimiter({ name: 'telegram-chat', max: telegramLimits().maxUpdatesPerMinute, windowMs: 60 * 1000 }),
    background: (task) => after(task),
    process: async (update) => {
      const deps = createBotDeps();
      if (!deps) {
        console.warn('[telegram] TELEGRAM_BOT_TOKEN is not set; update ignored.');
        return;
      }
      await processUpdate(update, deps);
    },
    log: (event) => console.info(`[telegram] webhook ${event}`),
  });
}

export async function GET() {
  return new Response('Not Found', { status: 404 });
}
