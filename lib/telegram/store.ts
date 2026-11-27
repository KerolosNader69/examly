/**
 * Supabase (service role) implementation of the bot's storage. Tables from
 * supabase/migrations/008_telegram_bot.sql; all are service-role only.
 * Payloads are written inline so tests/unit/schemaContract.test.ts can check every column.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { saveExam, type ExamDb } from '../examCreate.ts';
import type { BotStore, StoredSession, TeacherRow } from './bot.ts';
import { STATES, type Draft, type Session, type State } from './flow.ts';

export const TELEGRAM_PDF_BUCKET = 'telegram-pdfs';

const logDbError = (op: string, error: { code?: string } | null) => {
  if (error) console.warn(`[telegram] db ${op} failed (${error.code || 'error'})`);
};

export function createBotStore(db: SupabaseClient): BotStore & {
  createLinkCode(teacherId: string, codeHash: string, expiresAt: number): Promise<boolean>;
  getLinkByTeacher(teacherId: string): Promise<{ linkedAt: string } | null>;
  unlinkTeacher(teacherId: string): Promise<boolean>;
  markUpdateSeen(updateId: number): Promise<'new' | 'duplicate' | 'error'>;
} {
  return {
    async getLinkByChat(chatId) {
      const { data, error } = await db.from('telegram_links').select('teacher_id').eq('chat_id', chatId).maybeSingle();
      logDbError('link.get', error);
      return data?.teacher_id ? { teacherId: data.teacher_id as string } : null;
    },

    async getLinkByTeacher(teacherId) {
      const { data, error } = await db.from('telegram_links').select('linked_at').eq('teacher_id', teacherId).maybeSingle();
      logDbError('link.byTeacher', error);
      return data ? { linkedAt: String(data.linked_at) } : null;
    },

    async getTeacher(teacherId) {
      const { data, error } = await db.from('teachers').select('id, name, plan, status').eq('id', teacherId).maybeSingle();
      logDbError('teacher.get', error);
      return (data as TeacherRow | null) ?? null;
    },

    async createLinkCode(teacherId, codeHash, expiresAt) {
      // One live code per teacher: drop older unused ones first.
      await db.from('telegram_link_codes').delete().eq('teacher_id', teacherId).is('used_at', null);
      const { error } = await db
        .from('telegram_link_codes')
        .insert([{ code_hash: codeHash, teacher_id: teacherId, expires_at: new Date(expiresAt).toISOString() }]);
      logDbError('code.insert', error);
      return !error;
    },

    async consumeLinkCode(codeHash, now) {
      const nowIso = new Date(now).toISOString();
      const { data, error } = await db
        .from('telegram_link_codes')
        .update({ used_at: nowIso })
        .eq('code_hash', codeHash)
        .is('used_at', null)
        .gt('expires_at', nowIso)
        .select('teacher_id')
        .maybeSingle();
      logDbError('code.consume', error);
      return data?.teacher_id ? { teacherId: data.teacher_id as string } : null;
    },

    async linkChat(teacherId, chatId) {
      await db.from('telegram_links').delete().eq('chat_id', chatId);
      await db.from('telegram_links').delete().eq('teacher_id', teacherId);
      const { error } = await db
        .from('telegram_links')
        .insert([{ teacher_id: teacherId, chat_id: chatId, linked_at: new Date().toISOString() }]);
      logDbError('link.insert', error);
      return !error;
    },

    async unlinkChat(chatId) {
      const { error } = await db.from('telegram_links').delete().eq('chat_id', chatId);
      logDbError('link.delete', error);
    },

    async unlinkTeacher(teacherId) {
      const { data: link } = await db.from('telegram_links').select('chat_id').eq('teacher_id', teacherId).maybeSingle();
      const { error } = await db.from('telegram_links').delete().eq('teacher_id', teacherId);
      logDbError('link.deleteByTeacher', error);
      if (link?.chat_id !== undefined && link?.chat_id !== null) {
        await db.from('telegram_sessions').delete().eq('chat_id', link.chat_id);
      }
      return !error;
    },

    async getSession(chatId): Promise<StoredSession | null> {
      const { data, error } = await db.from('telegram_sessions').select('state, draft_json, updated_at').eq('chat_id', chatId).maybeSingle();
      logDbError('session.get', error);
      if (!data) return null;
      const state = (STATES as readonly string[]).includes(String(data.state)) ? (data.state as State) : 'idle';
      const updatedAt = Date.parse(String(data.updated_at));
      const session: Session = {
        state,
        draft: data.draft_json && typeof data.draft_json === 'object' ? (data.draft_json as Draft) : null,
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
      };
      return { session, version: String(data.updated_at) };
    },

    async saveSession(chatId, session, expected) {
      const iso = new Date(session.updatedAt).toISOString();
      if (expected === null) {
        const { error } = await db
          .from('telegram_sessions')
          .insert([{ chat_id: chatId, state: session.state, draft_json: session.draft, updated_at: iso }]);
        if (error && error.code !== '23505') logDbError('session.insert', error);
        return error ? null : iso;
      }
      const { data, error } = await db
        .from('telegram_sessions')
        .update({ state: session.state, draft_json: session.draft, updated_at: iso })
        .eq('chat_id', chatId)
        .eq('updated_at', expected)
        .select('chat_id');
      logDbError('session.update', error);
      return !error && Array.isArray(data) && data.length === 1 ? iso : null;
    },

    async deleteSession(chatId) {
      const { error } = await db.from('telegram_sessions').delete().eq('chat_id', chatId);
      logDbError('session.delete', error);
    },

    async markUpdateSeen(updateId) {
      const { error } = await db.from('telegram_updates').insert([{ update_id: updateId }]);
      if (!error) return 'new';
      if (error.code === '23505') return 'duplicate';
      logDbError('update.insert', error);
      return 'error';
    },

    async uploadPdf(path, bytes) {
      const { error } = await db.storage.from(TELEGRAM_PDF_BUCKET).upload(path, bytes, { contentType: 'application/pdf', upsert: false });
      if (error) console.warn(`[telegram] storage upload failed (${error.name || 'error'})`);
      return !error;
    },

    async removePdf(path) {
      const { error } = await db.storage.from(TELEGRAM_PDF_BUCKET).remove([path]);
      if (error) console.warn(`[telegram] storage remove failed (${error.name || 'error'})`);
    },

    createExam(input) {
      return saveExam(db as unknown as ExamDb, input);
    },
  };
}
