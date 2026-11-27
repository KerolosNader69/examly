/**
 * Live captions + panel helpers for the full-screen video exam room
 * (components/student/ExamRoomStage.tsx, components/student/useLiveCaptions.ts).
 *
 * Captions are DISPLAY ONLY: produced by the browser's own speech recognition, never
 * sent to our server, never stored, never graded. The graded transcript is still made
 * server-side from the recorded audio after the answer (/api/exam/transcribe).
 *
 * Pure and client-safe. Tests: tests/unit/liveCaptions.test.ts.
 */

export type PanelLang = 'en' | 'ar';

/** Panel language + direction for an exam language ('ar*' -> Arabic RTL, everything else English LTR). */
export function panelLocale(examLanguage: unknown): { lang: PanelLang; dir: 'rtl' | 'ltr' } {
  const ar = typeof examLanguage === 'string' && examLanguage.trim().toLowerCase().startsWith('ar');
  return ar ? { lang: 'ar', dir: 'rtl' } : { lang: 'en', dir: 'ltr' };
}

/** Default regional variant for a bare language code (exams.language values, lib/examLanguage.ts). */
const DEFAULT_REGION: Record<string, string> = {
  ar: 'ar-EG',
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
  de: 'de-DE',
};

/**
 * BCP-47 tag for the browser's speech recognition, or null = no captions.
 * 'ar' -> 'ar-EG', 'en' -> 'en-US'; a regional code the exam already has ('ar-SA',
 * 'en-GB') is kept; anything we don't know is null (captions off, rather than guessing).
 */
export function captionLangFor(examLanguage: unknown): string | null {
  if (typeof examLanguage !== 'string') return DEFAULT_REGION.en;
  const raw = examLanguage.trim();
  if (!raw) return DEFAULT_REGION.en; // older exams have no language: same default as the rest of the app
  const m = /^([a-z]{2})(?:-([a-z]{2}))?$/i.exec(raw);
  if (!m) return null;
  const base = m[1].toLowerCase();
  if (!DEFAULT_REGION[base]) return null;
  return m[2] ? `${base}-${m[2].toUpperCase()}` : DEFAULT_REGION[base];
}

/** Max characters of caption text kept on screen. */
export const CAPTION_MAX_CHARS = 600;

/** Keeps the last `max` characters, cut at a word boundary when one is close. */
export function capCaption(text: string, max: number = CAPTION_MAX_CHARS): string {
  if (text.length <= max) return text;
  const tail = text.slice(text.length - max);
  const space = tail.search(/\s/);
  // Drop the partial first word only if that doesn't throw away too much.
  return space >= 0 && space < 40 ? tail.slice(space + 1) : tail;
}

/** Appends a newly finalised phrase to the final caption text (one space between, capped). */
export function appendCaption(prev: string, phrase: string, max: number = CAPTION_MAX_CHARS): string {
  const p = phrase.replace(/\s+/g, ' ').trim();
  if (!p) return prev;
  return capCaption(prev ? `${prev} ${p}` : p, max);
}

/** Minimal shape of SpeechRecognitionEvent.results (array-like of array-like). */
export interface ResultListLike {
  length: number;
  [index: number]: { isFinal: boolean; length: number; [index: number]: { transcript: string } };
}

/** Splits one onresult event (from resultIndex) into newly-final text and the current interim text. */
export function splitResults(results: ResultListLike, resultIndex: number): { final: string; interim: string } {
  let final = '';
  let interim = '';
  for (let i = Math.max(0, resultIndex); i < results.length; i++) {
    const r = results[i];
    const t = r && r.length > 0 ? r[0]?.transcript || '' : '';
    if (r?.isFinal) final += `${t} `;
    else interim += `${t} `;
  }
  return { final: final.replace(/\s+/g, ' ').trim(), interim: interim.replace(/\s+/g, ' ').trim() };
}

export type SpeechErrorAction = 'ignore' | 'backoff' | 'disable';

/**
 * What to do with a SpeechRecognition error code. All are swallowed quietly:
 *  - 'ignore'  : normal (silence, our own abort) -> restart as usual;
 *  - 'backoff' : transient (network) -> restart, counted as a failure;
 *  - 'disable' : permission / no mic / unsupported language -> captions off for this exam.
 */
export function classifySpeechError(code: unknown): SpeechErrorAction {
  switch (code) {
    case 'no-speech':
    case 'aborted':
      return 'ignore';
    case 'not-allowed':
    case 'service-not-allowed':
    case 'audio-capture':
    case 'language-not-supported':
    case 'bad-grammar':
      return 'disable';
    default:
      return 'backoff'; // 'network' and anything unknown
  }
}

/** Restart policy state (per question). */
export interface RestartState {
  /** Consecutive sessions that ended quickly (< HEALTHY_SESSION_MS) or with an error. */
  fastFails: number;
  /** Restarts so far for this question (hard cap). */
  total: number;
}

export const HEALTHY_SESSION_MS = 3000;
export const MAX_FAST_FAILS = 6;
export const MAX_RESTARTS_PER_QUESTION = 120;
const BASE_DELAY_MS = 250;
const MAX_DELAY_MS = 8000;

/**
 * Next restart after a recognition session ended (Chrome ends sessions after silence).
 * A healthy (long) session restarts quickly; quick or failed sessions back off
 * exponentially and stop after MAX_FAST_FAILS in a row, or MAX_RESTARTS_PER_QUESTION in
 * total, so it can never spin. delayMs null = stop for this question.
 */
export function nextRestart(state: RestartState, sessionMs: number, failed: boolean): { state: RestartState; delayMs: number | null } {
  const total = state.total + 1;
  const healthy = !failed && sessionMs >= HEALTHY_SESSION_MS;
  const fastFails = healthy ? 0 : state.fastFails + 1;
  const next = { fastFails, total };
  if (total > MAX_RESTARTS_PER_QUESTION || fastFails > MAX_FAST_FAILS) return { state: next, delayMs: null };
  const delayMs = healthy ? BASE_DELAY_MS : Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** fastFails);
  return { state: next, delayMs };
}

/**
 * Whether to offer captions on this device. Needs the API; disabled on phones/tablets
 * (Android, iOS, iPadOS), where speech recognition can take the microphone away from the
 * exam recording.
 */
export function captionsAllowedOnDevice(env: { hasApi: boolean; userAgent: string; platform?: string; maxTouchPoints?: number }): boolean {
  if (!env.hasApi) return false;
  const ua = env.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return false;
  // iPadOS reports itself as a Mac; a touch "Mac" is an iPad.
  if (/Macintosh|MacIntel/i.test(`${ua} ${env.platform || ''}`) && (env.maxTouchPoints || 0) > 1) return false;
  return true;
}

// ─── Contrast (WCAG 2.x) ─────────────────────────────────────────────────────

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: readonly number[]): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** rgb of `fg` at `alpha` over `bg`. */
export function blend(fg: readonly number[], alpha: number, bg: readonly number[]): number[] {
  return fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));
}

export function contrastRatio(a: readonly number[], b: readonly number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Panel background: black at this opacity (Tailwind bg-black/70) over the camera frame. */
export const PANEL_BG_ALPHA = 0.7;

// ─── Text ───────────────────────────────────────────────────────────────────

export interface PanelText {
  questionOf: (n: number, total: number) => string;
  remaining: string;
  rec: string;
  recording: string;
  notRecording: string;
  instruction: string;
  micHearing: string;
  micQuiet: string;
  micOff: string;
  captionsTitle: string;
  captionsOn: string;
  captionsOff: string;
  captionsListening: string;
  captionsNote: string;
  captionsUnsupported: string;
  captionsUnavailable: string;
  next: string;
  submit: string;
  startingCamera: string;
}

export function panelText(lang: PanelLang): PanelText {
  if (lang === 'ar') {
    return {
      questionOf: (n, total) => `السؤال ${n} من ${total}`,
      remaining: 'متبقٍ',
      rec: 'تسجيل',
      recording: 'جارٍ التسجيل',
      notRecording: 'لا يتم التسجيل',
      instruction: 'تحدّث بوضوح وأنت تنظر إلى الكاميرا. يُسجَّل الصوت والفيديو.',
      micHearing: 'نسمعك بوضوح · واصل الكلام',
      micQuiet: 'الميكروفون يعمل · تحدّث بصوت أوضح (صوتك منخفض)',
      micOff: 'الميكروفون لا يسجّل.',
      captionsTitle: 'النص المباشر',
      captionsOn: 'تشغيل',
      captionsOff: 'إيقاف',
      captionsListening: 'ابدأ الكلام وسيظهر ما تقوله هنا…',
      captionsNote: 'معاينة مباشرة فقط. يُنشأ النص النهائي لإجابتك بعد أن تنتهي.',
      captionsUnsupported: 'النص المباشر غير متاح في هذا المتصفح.',
      captionsUnavailable: 'النص المباشر غير متاح حاليًا.',
      next: 'السؤال التالي',
      submit: 'تسليم الاختبار',
      startingCamera: 'جارٍ تشغيل الكاميرا…',
    };
  }
  return {
    questionOf: (n, total) => `Question ${n} of ${total}`,
    remaining: 'remaining',
    rec: 'REC',
    recording: 'Recording',
    notRecording: 'Not recording',
    instruction: 'Speak clearly facing your camera. Video & audio are recorded.',
    micHearing: 'We can hear you · Keep speaking clearly',
    micQuiet: 'Microphone is active · Speak clearly (we can barely hear you)',
    micOff: 'Microphone is not recording.',
    captionsTitle: 'Live captions',
    captionsOn: 'On',
    captionsOff: 'Off',
    captionsListening: 'Start speaking and your words will appear here…',
    captionsNote: 'Live preview. Your final transcript is generated after you finish.',
    captionsUnsupported: 'Live captions are not available in this browser.',
    captionsUnavailable: 'Live captions are not available right now.',
    next: 'Next Question',
    submit: 'Submit Exam',
    startingCamera: 'Starting your camera…',
  };
}
