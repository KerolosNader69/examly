/**
 * Telegram bot end-to-end (in memory): webhook gate, linking, Pro gating, the
 * PDF -> exam conversation (with / without answers, publish now, schedule, cancel),
 * idempotency and concurrency. No network: Telegram, storage, DB and the AI provider
 * are fakes. NOT a test against real Telegram.
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as BotModule from '../../lib/telegram/bot';
import type * as FlowModule from '../../lib/telegram/flow';
import type * as WebhookModule from '../../lib/telegram/webhook';
import type * as SecurityModule from '../../lib/telegram/security';
import type * as ConfigModule from '../../lib/telegram/config';
import type * as ExamCreateModule from '../../lib/examCreate';
import type { TgUpdate } from '../../lib/telegram/api';
import type { DraftQuestion } from '../../lib/telegram/extract';

const imp = (p: string) => import(new URL(p, import.meta.url).href);
const bot: typeof BotModule = await imp('../../lib/telegram/bot.ts');
const flow: typeof FlowModule = await imp('../../lib/telegram/flow.ts');
const wh: typeof WebhookModule = await imp('../../lib/telegram/webhook.ts');
const sec: typeof SecurityModule = await imp('../../lib/telegram/security.ts');
const cfg: typeof ConfigModule = await imp('../../lib/telegram/config.ts');
const ec: typeof ExamCreateModule = await imp('../../lib/examCreate.ts');

const TEACHER = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const CHAT = 5551234;
const T0 = Date.UTC(2026, 10, 27, 10, 0); // 12:00 Cairo

type Sent = { chatId: number; text: string; buttons?: FlowModule.Button[][] };

function world(opts: { plan?: string; status?: string; extract?: BotModule.ExtractOutcome; pdfAllowed?: boolean } = {}) {
  let clock = T0;
  const teachers = new Map<string, BotModule.TeacherRow>([[TEACHER, { id: TEACHER, name: 'Mona', plan: opts.plan ?? 'pro', status: opts.status ?? 'active' }]]);
  const links = new Map<number, string>();
  const codes = new Map<string, { teacherId: string; expiresAt: number; usedAt: number | null }>();
  const sessions = new Map<number, { session: FlowModule.Session; version: string }>();
  const storage = new Set<string>();
  const storageLog: string[] = [];
  const exams: ExamCreateModule.SaveExamInput[] = [];
  const sent: Sent[] = [];
  const logs: { event: string; counts?: Record<string, number | string> }[] = [];
  let seq = 0;

  const store: BotModule.BotStore = {
    async getLinkByChat(chatId) {
      const t = links.get(chatId);
      return t ? { teacherId: t } : null;
    },
    async getTeacher(id) {
      const t = teachers.get(id);
      return t ? { ...t } : null;
    },
    async consumeLinkCode(hash, now) {
      const c = codes.get(hash);
      if (!c || c.usedAt !== null || c.expiresAt <= now) return null;
      c.usedAt = now;
      return { teacherId: c.teacherId };
    },
    async linkChat(teacherId, chatId) {
      for (const [k, v] of links) if (k === chatId || v === teacherId) links.delete(k);
      links.set(chatId, teacherId);
      return true;
    },
    async unlinkChat(chatId) {
      links.delete(chatId);
    },
    async getSession(chatId) {
      const s = sessions.get(chatId);
      return s ? structuredClone(s) : null;
    },
    async saveSession(chatId, session, expected) {
      const cur = sessions.get(chatId);
      if ((cur?.version ?? null) !== expected) return null;
      const version = `v${++seq}`;
      sessions.set(chatId, { session: structuredClone(session), version });
      return version;
    },
    async deleteSession(chatId) {
      sessions.delete(chatId);
    },
    async uploadPdf(path) {
      storage.add(path);
      storageLog.push(`up:${path}`);
      return true;
    },
    async removePdf(path) {
      storage.delete(path);
      storageLog.push(`rm:${path}`);
    },
    async createExam(input) {
      // Validate exactly like the real save path.
      if (input.status === 'published' && ec.validateDraftModels(input.examType, input.models).length > 0) return { ok: false, error: 'invalid' };
      exams.push(structuredClone(input));
      return { ok: true, examId: `exam-${exams.length}` };
    },
  };

  const defaultExtract: BotModule.ExtractOutcome = {
    type: 'pdf_result',
    ok: true,
    title: 'Algebra Quiz',
    questions: [
      { text: 'Q1', options: ['a', 'b', 'c', 'd'], correct: 0 },
      { text: 'Q2', options: ['a', 'b'], correct: 1 },
    ],
    tooManyOptions: 0,
    dropped: 0,
  };

  const deps: BotModule.BotDeps = {
    store,
    telegram: {
      async sendMessage(chatId, text, buttons) {
        sent.push({ chatId, text, buttons });
      },
      async answerCallback() {},
      async clearButtons() {},
      async downloadFile() {
        return new Uint8Array(Buffer.from('%PDF-1.7\n<< /Type /Pages /Count 2 >>\n%%EOF', 'latin1'));
      },
    },
    linkLimiter: { limit: async () => ({ allowed: true }) },
    pdfDailyLimiter: { limit: async () => ({ allowed: opts.pdfAllowed ?? true }) },
    extract: async () => structuredClone(opts.extract ?? defaultExtract),
    limits: cfg.DEFAULT_LIMITS,
    baseUrl: 'https://examly.test',
    now: () => clock,
    log: (event, counts) => logs.push({ event, counts }),
  };

  let updateId = 1;
  const from = { id: 1, language_code: 'en' };
  const chat = { id: CHAT, type: 'private' };
  const text = (t: string, lang = 'en') => bot.processUpdate({ update_id: updateId++, message: { message_id: updateId, chat, from: { ...from, language_code: lang }, text: t } }, deps);
  const press = (data: string) =>
    bot.processUpdate({ update_id: updateId++, callback_query: { id: `cb${updateId}`, from, data, message: { message_id: 1, chat } } }, deps);
  const sendPdf = (doc: Partial<{ mime_type: string; file_name: string; file_size: number }> = {}) =>
    bot.processUpdate(
      { update_id: updateId++, message: { message_id: updateId, chat, from, document: { file_id: 'F1', file_name: 'quiz.pdf', mime_type: 'application/pdf', file_size: 2000, ...doc } } },
      deps
    );
  const issueCode = (expiresIn = cfg.LINK_CODE_TTL_MS) => {
    const code = sec.generateLinkCode();
    codes.set(sec.hashLinkCode(code), { teacherId: TEACHER, expiresAt: clock + expiresIn, usedAt: null });
    return code;
  };
  const last = () => sent[sent.length - 1];
  const state = () => sessions.get(CHAT)?.session.state;

  return {
    deps, store, teachers, links, codes, sessions, storage, storageLog, exams, sent, logs,
    text, press, sendPdf, issueCode, last, state,
    tick: (ms: number) => { clock += ms; },
    link: () => links.set(CHAT, TEACHER),
  };
}

// ── Webhook gate ────────────────────────────────────────────────────────────

const SECRET = 'test_secret_value_123456';
function hook(env: Record<string, string | undefined>, over: Partial<WebhookModule.WebhookDeps> = {}) {
  const seen = new Set<number>();
  const processed: TgUpdate[] = [];
  const tasks: (() => Promise<void>)[] = [];
  const deps: WebhookDeps = {
    env,
    markUpdateSeen: async (id) => (seen.has(id) ? 'duplicate' : (seen.add(id), 'new')),
    chatLimiter: { limit: async () => ({ allowed: true }) },
    background: (task) => tasks.push(task),
    process: async (u) => {
      processed.push(u);
    },
    log: () => undefined,
    ...over,
  };
  return { deps, processed, tasks };
}
type WebhookDeps = WebhookModule.WebhookDeps;
const req = (body: unknown, secret?: string) =>
  new Request('https://examly.test/api/telegram/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(secret ? { [wh.SECRET_HEADER]: secret } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const ON = { TELEGRAM_BOT_ENABLED: 'true', TELEGRAM_WEBHOOK_SECRET: SECRET };
const upd = (id: number) => ({ update_id: id, message: { message_id: 1, chat: { id: CHAT, type: 'private' }, text: '/help' } });

test('webhook: 404 when the flag is off (even with the right secret)', async () => {
  const h = hook({ TELEGRAM_WEBHOOK_SECRET: SECRET });
  const res = await wh.handleWebhook(req(upd(1), SECRET), h.deps);
  assert.equal(res.status, 404);
  assert.equal(h.tasks.length, 0);
});

test('webhook: 401 for a missing or wrong secret, and when no secret is configured', async () => {
  for (const [env, secret] of [
    [ON, undefined],
    [ON, 'wrong_secret_value_12345'],
    [{ TELEGRAM_BOT_ENABLED: 'true' }, SECRET],
  ] as const) {
    const h = hook(env);
    const res = await wh.handleWebhook(req(upd(1), secret), h.deps);
    assert.equal(res.status, 401);
    assert.equal(h.tasks.length, 0);
  }
});

test('webhook: 200 fast, work deferred to the background; retries of the same update_id run once', async () => {
  const h = hook(ON);
  const r1 = await wh.handleWebhook(req(upd(7), SECRET), h.deps);
  assert.equal(r1.status, 200);
  assert.equal(h.processed.length, 0, 'nothing processed before the response');
  assert.equal(h.tasks.length, 1);
  await h.tasks[0]();
  assert.equal(h.processed.length, 1);
  const r2 = await wh.handleWebhook(req(upd(7), SECRET), h.deps);
  assert.equal(r2.status, 200);
  assert.equal(h.tasks.length, 1, 'duplicate update_id not scheduled again');
});

test('webhook: garbage bodies, rate-limited chats and dedupe errors are acknowledged but not processed', async () => {
  const h = hook(ON);
  assert.equal((await wh.handleWebhook(req('{not json', SECRET), h.deps)).status, 200);
  assert.equal((await wh.handleWebhook(req({ hello: 1 }, SECRET), h.deps)).status, 200);
  const limited = hook(ON, { chatLimiter: { limit: async () => ({ allowed: false }) } });
  assert.equal((await wh.handleWebhook(req(upd(9), SECRET), limited.deps)).status, 200);
  const broken = hook(ON, { markUpdateSeen: async () => 'error' });
  assert.equal((await wh.handleWebhook(req(upd(10), SECRET), broken.deps)).status, 200);
  assert.equal(h.tasks.length + limited.tasks.length + broken.tasks.length, 0);
});

test('webhook: a crash while processing is contained (logged by error name only)', async () => {
  const events: string[] = [];
  const h = hook(ON, { process: async () => { throw new TypeError('secret detail'); }, log: (e) => events.push(e) });
  await wh.handleWebhook(req(upd(11), SECRET), h.deps);
  await h.tasks[0]();
  assert.deepEqual(events, ['process_error:TypeError']);
});

// ── Linking ─────────────────────────────────────────────────────────────────

test('link: unlinked chat only gets "how to link", nothing else happens', async () => {
  const w = world();
  await w.sendPdf();
  assert.match(w.last().text, /not connected/);
  assert.match(w.last().text, /\/start/);
  assert.equal(w.storageLog.length, 0);
  assert.equal(w.sessions.size, 0);
});

test('link: /start <code> links once; expired, reused and wrong codes are refused', async () => {
  const w = world();
  const code = w.issueCode();
  await w.text(`/start ${code.toLowerCase()}`);
  assert.equal(w.links.get(CHAT), TEACHER);
  assert.match(w.last().text, /Connected to Mona/);

  w.links.clear();
  await w.text(`/start ${code}`);
  assert.match(w.last().text, /invalid or expired/);
  assert.equal(w.links.size, 0);

  const old = w.issueCode(1000);
  w.tick(2000);
  await w.text(`/start ${old}`);
  assert.match(w.last().text, /invalid or expired/);
  await w.text('/start NOTACODE');
  assert.match(w.last().text, /invalid or expired/);
  assert.equal(w.links.size, 0);
});

test('link: non-Pro teachers cannot link and linked non-Pro chats get the upgrade message only', async () => {
  const w = world({ plan: 'free' });
  await w.text(`/start ${w.issueCode()}`);
  assert.match(w.last().text, /Pro plan/);
  assert.equal(w.links.size, 0);
  w.link();
  await w.sendPdf();
  assert.match(w.last().text, /Pro plan/);
  assert.equal(w.storageLog.length, 0);
});

test('link: /unlink disconnects and clears the session', async () => {
  const w = world();
  w.link();
  await w.sendPdf();
  assert.equal(w.state(), 'review');
  await w.text('/unlink');
  assert.equal(w.links.size, 0);
  assert.equal(w.sessions.size, 0);
  assert.match(w.last().text, /disconnected/);
});

test('link: Arabic language_code gets Arabic replies', async () => {
  const w = world();
  await w.text('/help', 'ar');
  assert.match(w.last().text, /اختبار/);
});

// ── PDF with answers marked -> Publish now ──────────────────────────────────

test('flow: PDF with answers -> summary -> 30 min -> publish now -> published exam + links; PDF deleted', async () => {
  const w = world();
  w.link();
  await w.sendPdf();
  assert.ok(w.sent.some((s) => /Reading your PDF/.test(s.text)));
  assert.match(w.last().text, /found 2 multiple-choice questions/);
  assert.match(w.last().text, /Correct answer detected: 2 of 2/);
  assert.deepEqual(w.last().buttons?.[0].map((b) => b.data), ['ok', 'cancel']);
  assert.equal(w.storage.size, 0, 'PDF removed from storage after parsing');
  assert.equal(w.storageLog.length, 2);

  await w.press('ok');
  assert.match(w.last().text, /How long/);
  await w.press('d:30');
  assert.match(w.last().text, /All answers are set/, 'no missing answers -> straight to publish choice');
  await w.press('pub');

  assert.equal(w.exams.length, 1);
  const e = w.exams[0];
  assert.equal(e.status, 'published');
  assert.equal(e.examType, 'mcq');
  assert.equal(e.title, 'Algebra Quiz');
  assert.equal(e.teacherId, TEACHER);
  assert.equal(e.startTime, new Date(T0).toISOString());
  assert.equal(e.models[0].questions[0].timeLimit, 600, '30 min / 2 questions = 900 s, capped at 600');
  assert.equal(e.models[0].questions[1].correctOptionIndex, 1);
  const fin = w.last().text;
  assert.match(fin, /Exam created: Algebra Quiz/);
  assert.match(fin, /Published/);
  assert.match(fin, /https:\/\/examly\.test\/exam\/exam-1/);
  assert.match(fin, /Exam code: exam-1/);
  assert.match(fin, /https:\/\/examly\.test\/dashboard\/exams\/exam-1/);
  assert.equal(w.state(), 'idle');
  // Logs carry counts only.
  const parsed = w.logs.find((l) => l.event === 'pdf_parsed');
  assert.deepEqual(parsed?.counts, { pages: 2, questions: 2, withAnswer: 2, tooManyOptions: 0, dropped: 0 });
  assert.doesNotMatch(JSON.stringify(w.logs), /Q1|Algebra|Mona|5551234/);
});

// ── PDF without answers ─────────────────────────────────────────────────────

const noAnswers = (n: number): BotModule.ExtractOutcome => ({
  type: 'pdf_result',
  ok: true,
  title: null,
  questions: Array.from({ length: n }, (_, i): DraftQuestion => ({ text: `Q${i + 1}`, options: ['w', 'x', 'y', 'z'], correct: null })),
  tooManyOptions: 1,
  dropped: 0,
});

test('flow: PDF without answers -> title asked -> each answer asked (A-D, skip) -> draft when any skipped', async () => {
  const w = world({ extract: noAnswers(3) });
  w.link();
  await w.sendPdf();
  assert.match(w.last().text, /Correct answer detected: 0 of 3/);
  assert.match(w.last().text, /more than 4 options/);
  await w.press('ok');
  assert.match(w.last().text, /exam title/);
  await w.text('Physics week 4');
  await w.press('d:other');
  await w.text('500');
  assert.match(w.last().text, /between 1 and 300/);
  await w.text('12');
  assert.ok(w.sent.some((s) => /3 questions have no detected answer/.test(s.text)));
  assert.match(w.last().text, /Question 1 of 3/);
  assert.deepEqual(w.last().buttons?.[0].map((b) => b.text), ['A', 'B', 'C', 'D']);
  await w.press('a:0:2');
  assert.match(w.last().text, /Question 2 of 3/);
  await w.press('a:0:1'); // stale button of question 1
  assert.match(w.last().text, /no longer active/);
  await w.press('a:1:s');
  assert.match(w.last().text, /Question 3 of 3/);
  await w.press('a:2:3');
  assert.match(w.last().text, /1 question still needs a correct answer/);
  await w.press('pub');
  const e = w.exams[0];
  assert.equal(e.status, 'draft', 'never published with a missing answer');
  assert.equal(e.title, 'Physics week 4');
  assert.deepEqual(e.models[0].questions.map((q) => q.correctOptionIndex), [2, null, 3]);
  assert.equal(e.models[0].questions[0].timeLimit, 240);
  assert.match(w.last().text, /Draft: 1 question needs a correct answer/);
});

test('flow: "Set all remaining later" -> draft; answers are never guessed', async () => {
  const w = world({ extract: noAnswers(2) });
  w.link();
  await w.sendPdf();
  await w.press('ok');
  await w.text('T');
  await w.press('d:10');
  await w.press('a:later');
  await w.press('pub');
  assert.equal(w.exams[0].status, 'draft');
  assert.deepEqual(w.exams[0].models[0].questions.map((q) => q.correctOptionIndex), [null, null]);
});

// ── Schedule ────────────────────────────────────────────────────────────────

test('flow: schedule -> parse -> confirm -> published with future start_time', async () => {
  const w = world();
  w.link();
  await w.sendPdf();
  await w.press('ok');
  await w.press('d:20');
  await w.press('sch');
  assert.match(w.last().text, /Cairo time/);
  await w.text('2026-11-27 09:00');
  assert.match(w.last().text, /in the past/);
  await w.text('tomorrow 6pm');
  assert.match(w.last().text, /18:00/);
  assert.deepEqual(w.last().buttons?.[0].map((b) => b.data), ['schok', 'schno']);
  await w.press('schno');
  await w.text('2026-12-01 18:30');
  await w.press('schok');
  const e = w.exams[0];
  assert.equal(e.status, 'published');
  assert.equal(e.startTime, '2026-12-01T16:30:00.000Z', 'students cannot join before start_time (checkJoinWindow)');
  assert.match(w.last().text, /Scheduled: students can join from/);
});

test('flow: a confirmed time that passed before Confirm is asked again', async () => {
  const w = world();
  w.link();
  await w.sendPdf();
  await w.press('ok');
  await w.press('d:20');
  await w.press('sch');
  await w.text('today 12:05');
  w.tick(10 * 60 * 1000);
  await w.press('schok');
  assert.equal(w.exams.length, 0);
  assert.match(w.last().text, /in the past/);
  assert.equal(w.state(), 'schedule_input');
});

// ── Cancel / limits / plan lapse / concurrency ──────────────────────────────

test('cancel: /cancel and the Cancel button reset the session; nothing is created', async () => {
  const w = world();
  w.link();
  await w.sendPdf();
  await w.press('cancel');
  assert.equal(w.state(), 'idle');
  assert.match(w.last().text, /Cancelled/);
  await w.sendPdf();
  await w.press('ok');
  await w.text('/cancel');
  assert.equal(w.state(), 'idle');
  await w.press('d:30');
  assert.match(w.last().text, /no longer active/);
  assert.equal(w.exams.length, 0);
});

test('limits: non-PDF and oversize files refused before download; daily PDF limit', async () => {
  const w = world();
  w.link();
  await w.sendPdf({ mime_type: 'image/jpeg', file_name: 'x.jpg' });
  assert.match(w.last().text, /send a PDF/);
  await w.sendPdf({ file_size: 11 * 1024 * 1024 });
  assert.match(w.last().text, /too large/);
  assert.equal(w.storageLog.length, 0);

  const capped = world({ pdfAllowed: false });
  capped.link();
  await capped.sendPdf();
  assert.match(capped.last().text, /today's limit of 5 PDFs/);
  assert.equal(capped.storageLog.length, 0);
  assert.equal(capped.state(), 'idle');
});

test('plan lapse: Pro removed mid-conversation -> no exam is created', async () => {
  const w = world();
  w.link();
  await w.sendPdf();
  await w.press('ok');
  await w.press('d:30');
  w.teachers.get(TEACHER)!.plan = 'free';
  await w.press('pub');
  assert.equal(w.exams.length, 0);
  assert.match(w.last().text, /Pro plan/);
});

test('plan lapse: plan changes between the button press and the save -> no exam', async () => {
  const w = world();
  w.link();
  await w.sendPdf();
  await w.press('ok');
  await w.press('d:30');
  const realGet = w.store.getTeacher;
  let calls = 0;
  w.store.getTeacher = async (id) => {
    const t = await realGet(id);
    return ++calls >= 2 && t ? { ...t, plan: 'basic' } : t;
  };
  await w.press('pub');
  assert.equal(w.exams.length, 0);
  assert.match(w.last().text, /Pro plan/);
  assert.equal(w.state(), 'idle');
});

test('concurrency: a stale session write (double tap) creates only one exam', async () => {
  const w = world();
  w.link();
  await w.sendPdf();
  await w.press('ok');
  await w.press('d:30');
  await Promise.all([w.press('pub'), w.press('pub')]);
  assert.equal(w.exams.length, 1);
});

test('failures: unreadable PDF / AI failure -> friendly message, back to idle, file still deleted', async () => {
  const w = world({ extract: { type: 'pdf_result', ok: false, reason: 'read_failed' } });
  w.link();
  await w.sendPdf();
  assert.match(w.last().text, /could not read questions/);
  assert.equal(w.state(), 'idle');
  assert.equal(w.storage.size, 0);
  const none = world({ extract: { type: 'pdf_result', ok: true, title: null, questions: [], tooManyOptions: 0, dropped: 0 } });
  none.link();
  await none.sendPdf();
  assert.match(none.last().text, /did not find any multiple-choice/);
});

test('busy: a second PDF while one is in progress is refused', async () => {
  const w = world();
  w.link();
  await w.sendPdf();
  await w.sendPdf();
  assert.match(w.last().text, /already have an exam in progress/);
});

test('group chats are ignored', async () => {
  const w = world();
  w.link();
  await bot.processUpdate({ update_id: 99, message: { message_id: 1, chat: { id: CHAT, type: 'group' }, text: 'hello' } }, w.deps);
  assert.equal(w.sent.length, 0);
});

// ── Pure flow details ───────────────────────────────────────────────────────

test('flow: sessions expire after 24 h; stuck processing after 10 min', () => {
  const s = { state: 'review' as const, draft: { title: 'x', questions: [] }, updatedAt: T0 };
  assert.equal(flow.normalizeSession(s, T0 + cfg.SESSION_TTL_MS - 1).state, 'review');
  assert.equal(flow.normalizeSession(s, T0 + cfg.SESSION_TTL_MS + 1).state, 'idle');
  const p = { state: 'processing' as const, draft: null, updatedAt: T0 };
  assert.equal(flow.normalizeSession(p, T0 + cfg.PROCESSING_STALE_MS + 1).state, 'idle');
  assert.equal(flow.normalizeSession({ state: 'bogus' as never, draft: null, updatedAt: T0 }, T0).state, 'idle');
});

test('flow: seconds per question split and clamp; minutes parsing', () => {
  assert.equal(flow.secondsPerQuestion(10, 20), 30);
  assert.equal(flow.secondsPerQuestion(10, 60), 30, 'floor of 30 s');
  assert.equal(flow.secondsPerQuestion(60, 2), 600, 'cap of 600 s');
  assert.equal(flow.secondsPerQuestion(45, 30), 90);
  assert.equal(flow.parseMinutes('45'), 45);
  assert.equal(flow.parseMinutes('٤٥ دقيقة'), 45);
  assert.equal(flow.parseMinutes('20 min'), 20);
  for (const bad of ['0', '301', '1.5', 'abc', '']) assert.equal(flow.parseMinutes(bad), null, bad);
});

test('bot: parseCommand handles @botname and arguments', () => {
  assert.deepEqual(bot.parseCommand('/start ABCD2345'), { name: 'start', arg: 'ABCD2345' });
  assert.deepEqual(bot.parseCommand('/HELP@ExamlyBot'), { name: 'help', arg: '' });
  assert.equal(bot.parseCommand('hello /start'), null);
  assert.equal(bot.isProTeacher({ id: 'x', name: null, plan: 'Pro', status: 'active' }), true);
  assert.equal(bot.isProTeacher({ id: 'x', name: null, plan: 'pro', status: 'suspended' }), false);
  assert.equal(bot.isProTeacher({ id: 'x', name: null, plan: 'basic', status: 'active' }), false);
  assert.equal(bot.isProTeacher(null), false);
});
