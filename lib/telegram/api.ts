/**
 * Minimal Telegram Bot API client (fetch only). The token is read from
 * TELEGRAM_BOT_TOKEN by the caller and only ever placed in the request URL; it is
 * never logged (errors log the method name and HTTP status only).
 */
import type { Button } from './flow.ts';

export interface TgUser {
  id: number;
  language_code?: string;
  first_name?: string;
}
export interface TgChat {
  id: number;
  type: string;
}
export interface TgDocument {
  file_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}
export interface TgMessage {
  message_id: number;
  chat: TgChat;
  from?: TgUser;
  text?: string;
  document?: TgDocument;
  photo?: unknown[];
}
export interface TgCallbackQuery {
  id: string;
  from: TgUser;
  message?: TgMessage;
  data?: string;
}
export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
}

export interface TelegramApi {
  sendMessage(chatId: number, text: string, buttons?: Button[][]): Promise<void>;
  answerCallback(callbackId: string): Promise<void>;
  /** Removes the inline keyboard of a message whose button was pressed. */
  clearButtons(chatId: number, messageId: number): Promise<void>;
  /** File bytes, 'too_large' when over maxBytes, or null on any failure. */
  downloadFile(fileId: string, maxBytes: number): Promise<Uint8Array | 'too_large' | null>;
}

const API = 'https://api.telegram.org';
const MAX_TEXT = 4000; // Telegram's limit is 4096

export function createTelegramApi(token: string, fetchImpl: typeof fetch = fetch): TelegramApi {
  async function call(method: string, body: Record<string, unknown>): Promise<unknown> {
    try {
      const res = await fetchImpl(`${API}/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; result?: unknown } | null;
      if (!res.ok || !json?.ok) {
        console.warn(`[telegram] ${method} failed (HTTP ${res.status})`);
        return null;
      }
      return json.result;
    } catch (err) {
      console.warn(`[telegram] ${method} failed (${err instanceof Error ? err.name : 'UnknownError'})`);
      return null;
    }
  }

  return {
    async sendMessage(chatId, text, buttons) {
      await call('sendMessage', {
        chat_id: chatId,
        text: text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text,
        link_preview_options: { is_disabled: true },
        ...(buttons ? { reply_markup: { inline_keyboard: buttons.map((row) => row.map((b) => ({ text: b.text, callback_data: b.data }))) } } : {}),
      });
    },
    async answerCallback(callbackId) {
      await call('answerCallbackQuery', { callback_query_id: callbackId });
    },
    async clearButtons(chatId, messageId) {
      await call('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } });
    },
    async downloadFile(fileId, maxBytes) {
      const file = (await call('getFile', { file_id: fileId })) as { file_path?: string; file_size?: number } | null;
      if (!file?.file_path) return null;
      if (typeof file.file_size === 'number' && file.file_size > maxBytes) return 'too_large';
      try {
        const res = await fetchImpl(`${API}/file/bot${token}/${file.file_path}`, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) {
          console.warn(`[telegram] file download failed (HTTP ${res.status})`);
          return null;
        }
        const len = Number(res.headers.get('content-length') || 0);
        if (len > maxBytes) return 'too_large';
        const buf = new Uint8Array(await res.arrayBuffer());
        return buf.length > maxBytes ? 'too_large' : buf;
      } catch (err) {
        console.warn(`[telegram] file download failed (${err instanceof Error ? err.name : 'UnknownError'})`);
        return null;
      }
    },
  };
}
