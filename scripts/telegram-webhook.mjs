#!/usr/bin/env node
/**
 * Register / inspect / remove the Examly Telegram webhook.
 * Reads TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET from the environment only;
 * never prints them. Usage (from the frontend folder):
 *
 *   node --env-file=.env.telegram scripts/telegram-webhook.mjs set https://examly.site
 *   node --env-file=.env.telegram scripts/telegram-webhook.mjs info
 *   node --env-file=.env.telegram scripts/telegram-webhook.mjs delete
 *
 * (.env* files are git-ignored. Or export the two variables in your shell instead.)
 * "set" also registers the /help, /cancel and /unlink command menu (English + Arabic).
 */

const [, , action = 'info', baseArg] = process.argv;
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

function fail(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

if (!token) fail('TELEGRAM_BOT_TOKEN is not set in the environment.');

async function call(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!json.ok) fail(`${method} failed (HTTP ${res.status}): ${json.description ?? 'no description'}`);
  return json.result;
}

if (action === 'set') {
  if (!secret || !/^[A-Za-z0-9_-]{16,256}$/.test(secret)) {
    fail('TELEGRAM_WEBHOOK_SECRET must be 16-256 characters of A-Z, a-z, 0-9, _ or -.');
  }
  const base = (baseArg || process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
  if (!/^https:\/\//.test(base)) fail('Pass the public https base URL, e.g. https://examly.site');
  const url = `${base}/api/telegram/webhook`;
  await call('setWebhook', {
    url,
    secret_token: secret,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
    max_connections: 20,
  });
  const commands = (help, cancel, unlink) => [
    { command: 'help', description: help },
    { command: 'cancel', description: cancel },
    { command: 'unlink', description: unlink },
  ];
  await call('setMyCommands', { commands: commands('How to create an exam from a PDF', 'Cancel and start over', 'Disconnect this chat from Examly') });
  await call('setMyCommands', {
    commands: commands('طريقة إنشاء اختبار من ملف PDF', 'إلغاء والبدء من جديد', 'فصل هذه المحادثة عن Examly'),
    language_code: 'ar',
  });
  console.log(`Webhook set to ${url}`);
} else if (action === 'info') {
  const info = await call('getWebhookInfo');
  const me = await call('getMe');
  console.log(
    JSON.stringify(
      {
        bot: `@${me.username}`,
        url: info.url || '(none)',
        pending_update_count: info.pending_update_count,
        last_error_date: info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : null,
        last_error_message: info.last_error_message ?? null,
        allowed_updates: info.allowed_updates ?? null,
      },
      null,
      2
    )
  );
} else if (action === 'delete') {
  await call('deleteWebhook', { drop_pending_updates: true });
  console.log('Webhook removed.');
} else {
  fail('Usage: telegram-webhook.mjs set <https-base-url> | info | delete');
}
