import { NextResponse } from 'next/server';
import { getTeacherFromRequest } from '@/lib/serverAuth';
import { getRateLimiter, tooManyRequests } from '@/lib/rateLimit';
import { isProTeacher } from '@/lib/telegram/bot';
import { LINK_CODE_TTL_MS, botUsername, isTelegramBotEnabled } from '@/lib/telegram/config';
import { generateLinkCode, hashLinkCode } from '@/lib/telegram/security';
import { botStore } from '@/lib/telegram/services';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const codeLimiter = getRateLimiter({ name: 'telegram-link-code-teacher', max: 10, windowMs: 60 * 60 * 1000 });

/**
 * Dashboard "Connect Telegram" (teacher-only, Bearer token like other teacher routes).
 *   GET    -> { eligible, linked, linkedAt, botUsername }
 *   POST   -> one-time code (Pro only, expires in 10 min; only its hash is stored)
 *   DELETE -> disconnect the linked chat
 * 404 for everything while TELEGRAM_BOT_ENABLED is not "true".
 */
async function guard(request: Request) {
  if (!isTelegramBotEnabled()) return { error: NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE }) };
  const auth = await getTeacherFromRequest(request);
  if (!auth) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE }) };
  return { teacherId: auth.teacherId };
}

export async function GET(request: Request) {
  const g = await guard(request);
  if (g.error) return g.error;
  const store = botStore();
  const [teacher, link] = await Promise.all([store.getTeacher(g.teacherId), store.getLinkByTeacher(g.teacherId)]);
  return NextResponse.json(
    { eligible: isProTeacher(teacher), linked: Boolean(link), linkedAt: link?.linkedAt ?? null, botUsername: botUsername() },
    { headers: NO_STORE }
  );
}

export async function POST(request: Request) {
  const g = await guard(request);
  if (g.error) return g.error;
  const store = botStore();
  if (!isProTeacher(await store.getTeacher(g.teacherId))) {
    return NextResponse.json({ error: 'The Telegram bot is available on the Pro plan.' }, { status: 403, headers: NO_STORE });
  }
  const rl = await codeLimiter.limit(g.teacherId);
  if (!rl.allowed) {
    const r = tooManyRequests(rl.retryAfterSeconds, 'Too many codes requested. Please try again later.');
    return NextResponse.json(r.body, r.init);
  }
  const code = generateLinkCode();
  const expiresAt = Date.now() + LINK_CODE_TTL_MS;
  if (!(await store.createLinkCode(g.teacherId, hashLinkCode(code), expiresAt))) {
    return NextResponse.json({ error: 'Could not create a code. Please try again.' }, { status: 500, headers: NO_STORE });
  }
  const username = botUsername();
  return NextResponse.json(
    {
      code,
      expiresAt: new Date(expiresAt).toISOString(),
      deepLink: username ? `https://t.me/${username}?start=${code}` : null,
      botUsername: username,
    },
    { headers: NO_STORE }
  );
}

export async function DELETE(request: Request) {
  const g = await guard(request);
  if (g.error) return g.error;
  const ok = await botStore().unlinkTeacher(g.teacherId);
  return NextResponse.json({ ok }, { status: ok ? 200 : 500, headers: NO_STORE });
}
