/**
 * Processes one Telegram update (runs in the background, after the webhook answered 200).
 * All I/O is injected (BotDeps), so the whole flow is unit-tested with fakes
 * (tests/unit/telegramBot.test.ts). Wiring to Supabase / Telegram / the AI provider is
 * in lib/telegram/services.ts.
 *
 * Gatekeeping, in order: private chat only -> /help and /start <code> always answered ->
 * unlinked chats get "how to link" and nothing else -> linked teachers must be Pro
 * (checked on every update and again right before an exam is created).
 * Logs counts only: never PDF content, chat text, names or chat ids.
 */
import { randomUUID } from 'node:crypto';
import type { SaveExamInput, SaveExamResult } from '../examCreate.ts';
import type { TelegramApi, TgUpdate } from './api.ts';
import type { TelegramLimits } from './config.ts';
import { buildExamFromDraft, finalInfo } from './examFromDraft.ts';
import { idleSession, step, type Effect, type FlowEvent, type Reply, type Session } from './flow.ts';
import { helpText, langFrom, t, type Lang } from './i18n.ts';
import { checkPdfBytes } from './pdf.ts';
import { hashLinkCode, normalizeLinkCode } from './security.ts';

export interface TeacherRow {
  id: string;
  name: string | null;
  plan: string | null;
  status: string | null;
}

export interface StoredSession {
  session: Session;
  /** Opaque version used for compare-and-set (the row's updated_at as stored). */
  version: string;
}

export interface BotStore {
  getLinkByChat(chatId: number): Promise<{ teacherId: string } | null>;
  getTeacher(teacherId: string): Promise<TeacherRow | null>;
  /** Marks an unused, unexpired code as used and returns its teacher (atomic). */
  consumeLinkCode(codeHash: string, now: number): Promise<{ teacherId: string } | null>;
  /** Links the chat to the teacher, replacing any previous link of either. */
  linkChat(teacherId: string, chatId: number): Promise<boolean>;
  unlinkChat(chatId: number): Promise<void>;
  getSession(chatId: number): Promise<StoredSession | null>;
  /** Writes the session if the stored version still equals `expected` (null = no row yet). Returns the new version, or null on conflict/error. */
  saveSession(chatId: number, session: Session, expected: string | null): Promise<string | null>;
  deleteSession(chatId: number): Promise<void>;
  uploadPdf(path: string, bytes: Uint8Array): Promise<boolean>;
  removePdf(path: string): Promise<void>;
  createExam(input: SaveExamInput): Promise<SaveExamResult>;
}

export interface LimiterLike {
  limit(key: string): Promise<{ allowed: boolean }>;
}

export type ExtractOutcome = Extract<FlowEvent, { type: 'pdf_result' }>;

export interface BotDeps {
  store: BotStore;
  telegram: TelegramApi;
  /** /start <code> attempts per chat. */
  linkLimiter: LimiterLike;
  /** PDFs per teacher per day. */
  pdfDailyLimiter: LimiterLike;
  /** Sends the PDF to the AI provider and validates the result (lib/telegram/extract.ts). */
  extract(bytes: Uint8Array): Promise<ExtractOutcome>;
  limits: TelegramLimits;
  baseUrl: string;
  now(): number;
  log(event: string, counts?: Record<string, number | string>): void;
}

export function isProTeacher(t: TeacherRow | null): boolean {
  return Boolean(t && String(t.plan || '').toLowerCase() === 'pro' && t.status !== 'suspended');
}

export function parseCommand(text: string): { name: string; arg: string } | null {
  const m = /^\/([A-Za-z_]+)(?:@[A-Za-z0-9_]+)?(?:\s+([\s\S]*))?$/.exec(text.trim());
  return m ? { name: m[1].toLowerCase(), arg: (m[2] || '').trim() } : null;
}

const urls = (base: string) => ({
  settings: `${base}/dashboard/settings`,
  billing: `${base}/dashboard/billing`,
});

export async function processUpdate(update: TgUpdate, deps: BotDeps): Promise<void> {
  const msg = update.message;
  const cb = update.callback_query;
  const chat = msg?.chat ?? cb?.message?.chat;
  if (!chat || typeof chat.id !== 'number') return;
  const chatId = chat.id;
  const lang = langFrom((msg?.from ?? cb?.from)?.language_code);
  const m = t(lang);
  const u = urls(deps.baseUrl);
  const send = (r: Reply) => deps.telegram.sendMessage(chatId, r.text, r.buttons);

  if (cb) await deps.telegram.answerCallback(cb.id);
  if (chat.type !== 'private') {
    if (msg?.text?.startsWith('/')) await send({ text: m.groupChat });
    return;
  }

  const cmd = typeof msg?.text === 'string' ? parseCommand(msg.text) : null;
  if (cmd?.name === 'help') return send({ text: helpText(deps.limits) });
  if (cmd?.name === 'start' && cmd.arg) return handleLink(chatId, cmd.arg, lang, deps);

  const link = await deps.store.getLinkByChat(chatId);
  if (cmd?.name === 'start') return send({ text: link ? m.welcomeLinked : m.welcome(u.settings) });
  if (!link) return send({ text: m.notLinked(u.settings) });

  if (cmd?.name === 'unlink') {
    await deps.store.unlinkChat(chatId);
    await deps.store.deleteSession(chatId);
    deps.log('unlinked');
    return send({ text: m.unlinked });
  }

  const teacher = await deps.store.getTeacher(link.teacherId);
  if (!isProTeacher(teacher)) return send({ text: m.notPro(u.billing) });

  let event: FlowEvent;
  if (cmd?.name === 'cancel') event = { type: 'cancel' };
  else if (cmd?.name === 'newexam') event = { type: 'newexam' };
  else if (cmd) return send({ text: helpText(deps.limits) });
  else if (msg?.document) {
    const d = msg.document;
    event = { type: 'document', fileId: d.file_id, fileName: d.file_name, mimeType: d.mime_type, fileSize: d.file_size };
  } else if (typeof msg?.text === 'string') event = { type: 'text', text: msg.text };
  else if (cb?.data) {
    if (cb.message) await deps.telegram.clearButtons(chatId, cb.message.message_id);
    event = { type: 'button', data: cb.data };
  } else if (msg) return send({ text: msg.photo ? m.notPdf : m.sendPdf });
  else return;

  await runFlow(chatId, teacher!, event, lang, deps);
}

async function handleLink(chatId: number, rawCode: string, lang: Lang, deps: BotDeps): Promise<void> {
  const m = t(lang);
  const send = (text: string) => deps.telegram.sendMessage(chatId, text);
  const rl = await deps.linkLimiter.limit(`chat:${chatId}`);
  if (!rl.allowed) return send(m.linkTooMany);
  const code = normalizeLinkCode(rawCode);
  const claimed = code ? await deps.store.consumeLinkCode(hashLinkCode(code), deps.now()) : null;
  if (!claimed) {
    deps.log('link_failed');
    return send(m.linkBadCode);
  }
  const teacher = await deps.store.getTeacher(claimed.teacherId);
  if (!isProTeacher(teacher)) return send(m.notPro(urls(deps.baseUrl).billing));
  if (!(await deps.store.linkChat(teacher!.id, chatId))) return send(m.createFailed);
  await deps.store.deleteSession(chatId);
  deps.log('linked');
  return send(m.linked(teacher!.name?.trim() || null));
}

/** Monotonic clock per write so compare-and-set versions never repeat. */
function clock(deps: BotDeps, after: number): number {
  return Math.max(deps.now(), after + 1);
}

async function runFlow(chatId: number, teacher: TeacherRow, event: FlowEvent, lang: Lang, deps: BotDeps): Promise<void> {
  const send = (rs: Reply[]) => rs.reduce((p, r) => p.then(() => deps.telegram.sendMessage(chatId, r.text, r.buttons)), Promise.resolve());
  const stored = await deps.store.getSession(chatId);
  const prev = stored?.session ?? idleSession(0);
  const now = clock(deps, prev.updatedAt);
  let result = step(prev, event, { lang, now, limits: deps.limits });

  if (result.effect?.type === 'parse_pdf') {
    const rl = await deps.pdfDailyLimiter.limit(`teacher:${teacher.id}`);
    if (!rl.allowed) result = step(result.session, { type: 'pdf_result', ok: false, reason: 'daily_limit' }, { lang, now, limits: deps.limits });
  }

  // Save BEFORE acting: if a concurrent update (double tap, retry) already moved the
  // session on, this write fails and this update does nothing.
  const version = await deps.store.saveSession(chatId, result.session, stored?.version ?? null);
  if (version === null) {
    deps.log('session_conflict');
    return;
  }
  await send(result.replies);
  if (!result.effect) return;

  const follow = await runEffect(result.effect, result.session, teacher, lang, deps);

  // Re-read: the teacher may have sent /cancel while the effect ran.
  const current = await deps.store.getSession(chatId);
  if (!current) return;
  const next = step(current.session, follow, { lang, now: clock(deps, current.session.updatedAt), limits: deps.limits });
  if (next.replies.length === 0) return;
  if ((await deps.store.saveSession(chatId, next.session, current.version)) === null) return;
  await send(next.replies);
}

async function runEffect(effect: Effect, session: Session, teacher: TeacherRow, lang: Lang, deps: BotDeps): Promise<FlowEvent> {
  const m = t(lang);
  if (effect.type === 'parse_pdf') {
    const bytes = await deps.telegram.downloadFile(effect.fileId, deps.limits.maxPdfBytes);
    if (bytes === 'too_large') return { type: 'pdf_result', ok: false, reason: 'too_large' };
    if (!bytes) return { type: 'pdf_result', ok: false, reason: 'read_failed' };
    const check = checkPdfBytes(bytes, deps.limits);
    if (!check.ok) return { type: 'pdf_result', ok: false, reason: check.reason };

    const path = `${teacher.id}/${randomUUID()}.pdf`;
    if (!(await deps.store.uploadPdf(path, bytes))) return { type: 'pdf_result', ok: false, reason: 'read_failed' };
    try {
      const out = await deps.extract(bytes);
      if (out.ok) {
        deps.log('pdf_parsed', {
          pages: check.pages,
          questions: out.questions.length,
          withAnswer: out.questions.filter((q) => q.correct !== null).length,
          tooManyOptions: out.tooManyOptions,
          dropped: out.dropped,
        });
      } else {
        deps.log('pdf_failed', { reason: out.reason });
      }
      return out;
    } catch {
      deps.log('pdf_failed', { reason: 'exception' });
      return { type: 'pdf_result', ok: false, reason: 'read_failed' };
    } finally {
      await deps.store.removePdf(path);
    }
  }

  // create_exam: the plan may have lapsed since the conversation started.
  const fresh = await deps.store.getTeacher(teacher.id);
  if (!isProTeacher(fresh)) return { type: 'exam_result', text: m.notPro(urls(deps.baseUrl).billing) };
  if (!session.draft || session.draft.questions.length === 0) return { type: 'exam_result', text: m.createFailed };

  const now = deps.now();
  const fallbackTitle = lang === 'ar' ? `اختبار ${new Date(now).toISOString().slice(0, 10)}` : `Exam ${new Date(now).toISOString().slice(0, 10)}`;
  const built = buildExamFromDraft(session.draft, teacher.id, effect.scheduledAt, now, fallbackTitle);
  const saved = await deps.store.createExam(built.input).catch(() => ({ ok: false as const, error: 'exception' }));
  if (!saved.ok) {
    deps.log('exam_failed');
    return { type: 'exam_result', text: m.createFailed };
  }
  deps.log('exam_created', { questions: built.input.models[0].questions.length, status: built.kind, missing: built.missing });
  return { type: 'exam_result', text: m.final(finalInfo(built, saved.examId, deps.baseUrl, effect.scheduledAt, lang)) };
}
