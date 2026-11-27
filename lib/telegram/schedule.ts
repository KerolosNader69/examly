/**
 * Start-time parsing for "Schedule" in the bot. All times are Africa/Cairo wall-clock
 * time (Egypt observes DST since 2023, so offsets come from the runtime's tz database,
 * never a hard-coded +02:00). Pure; unit-tested in tests/unit/telegramSchedule.test.ts.
 *
 * Accepted (English or Arabic, Western or Arabic-Indic digits):
 *   2026-12-01 18:30      2026/12/01 6:30pm      01/12/2026 18:30 (day/month/year)
 *   tomorrow 6pm          today at 18:30         6pm tomorrow       غدا 6 مساء
 *   18:30 / 6pm           (today, or tomorrow if that time already passed today)
 */

export const EXAM_TIME_ZONE = 'Africa/Cairo';
const MIN_LEAD_MS = 60 * 1000;
const MAX_AHEAD_MS = 366 * 24 * 60 * 60 * 1000;

interface Wall { y: number; mo: number; d: number; h: number; mi: number }

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EXAM_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function cairoWall(utcMs: number): Wall {
  const p: Record<string, number> = {};
  for (const part of partsFormatter.formatToParts(new Date(utcMs))) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  return { y: p.year, mo: p.month, d: p.day, h: p.hour === 24 ? 0 : p.hour, mi: p.minute };
}

function offsetMs(utcMs: number): number {
  const w = cairoWall(utcMs);
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi) - Math.floor(utcMs / 60000) * 60000;
}

/** UTC instant of a Cairo wall-clock time; null for an impossible date (e.g. 31 Feb). */
export function cairoToUtc(w: Wall): number | null {
  if (![w.y, w.mo, w.d, w.h, w.mi].every(Number.isInteger)) return null;
  if (w.mo < 1 || w.mo > 12 || w.d < 1 || w.d > 31 || w.h < 0 || w.h > 23 || w.mi < 0 || w.mi > 59) return null;
  const naive = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi);
  const check = new Date(naive);
  if (check.getUTCMonth() !== w.mo - 1 || check.getUTCDate() !== w.d) return null;
  let guess = naive - offsetMs(naive);
  guess = naive - offsetMs(guess);
  return guess;
}

function addDays(w: Wall, days: number): Wall {
  const t = new Date(Date.UTC(w.y, w.mo - 1, w.d + days));
  return { ...w, y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

const ARABIC_DIGITS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

export function normalizeScheduleText(raw: string): string {
  let s = raw.normalize('NFKC').replace(/[٠-٩۰-۹]/g, (c) => ARABIC_DIGITS[c] ?? c).toLowerCase();
  s = s.replace(/[ً-ْ]/g, ''); // Arabic diacritics (e.g. غداً -> غدا)
  s = s.replace(/،/g, ',').replace(/٫|:/g, ':');
  const words: [RegExp, string][] = [
    [/(^|\s)(غدا|بكرة|بكره|الغد)(?=\s|$)/g, '$1tomorrow'],
    [/(^|\s)(اليوم|النهارده|النهاردة)(?=\s|$)/g, '$1today'],
    [/(^|\s)(مساء|مساءا|بالليل|م)(?=\s|$)/g, '$1pm'],
    [/(^|\s)(صباحا|صباح|الصبح|ص)(?=\s|$)/g, '$1am'],
    [/(^|\s)(الساعة|الساعه|في|at)(?=\s|$)/g, '$1'],
  ];
  for (const [re, rep] of words) s = s.replace(re, rep);
  return s.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
}

/** "18:30", "6pm", "6:30 pm", "18" -> {h, mi}. */
export function parseTimeOfDay(s: string): { h: number; mi: number } | null {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/.exec(s.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const mi = m[2] === undefined ? 0 : Number(m[2]);
  const ap = m[3]?.replace(/\./g, '');
  if (mi > 59) return null;
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (ap === 'am') h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
  } else if (h > 23) {
    return null;
  }
  return { h, mi };
}

export type ScheduleParse =
  | { ok: true; at: number }
  | { ok: false; reason: 'unrecognized' | 'past' | 'too_far' };

export function parseScheduleInput(raw: string, nowMs: number): ScheduleParse {
  const s = normalizeScheduleText(raw);
  const today = cairoWall(nowMs);
  let wall: Wall | null = null;
  let rollIfPast = false;

  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:t|\s)\s*(.+)$/.exec(s);
  if (m) {
    const t = parseTimeOfDay(m[4]);
    if (t) wall = { y: +m[1], mo: +m[2], d: +m[3], ...t };
  }
  if (!wall && (m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\s+(.+)$/.exec(s))) {
    const t = parseTimeOfDay(m[4]);
    if (t) wall = { y: +m[3], mo: +m[2], d: +m[1], ...t };
  }
  if (!wall && (m = /^(today|tomorrow)\s+(.+)$/.exec(s) ?? /^(.+?)\s+(today|tomorrow)$/.exec(s))) {
    const dayWord = m[1] === 'today' || m[1] === 'tomorrow' ? m[1] : m[2];
    const t = parseTimeOfDay(dayWord === m[1] ? m[2] : m[1]);
    if (t) wall = { ...addDays(today, dayWord === 'tomorrow' ? 1 : 0), ...t };
  }
  if (!wall) {
    const t = parseTimeOfDay(s);
    if (t) {
      wall = { ...today, ...t };
      rollIfPast = true;
    }
  }
  if (!wall) return { ok: false, reason: 'unrecognized' };

  let at = cairoToUtc(wall);
  if (at === null) return { ok: false, reason: 'unrecognized' };
  if (rollIfPast && at <= nowMs + MIN_LEAD_MS) {
    at = cairoToUtc({ ...addDays(wall, 1), h: wall.h, mi: wall.mi });
    if (at === null) return { ok: false, reason: 'unrecognized' };
  }
  if (at <= nowMs + MIN_LEAD_MS) return { ok: false, reason: 'past' };
  if (at > nowMs + MAX_AHEAD_MS) return { ok: false, reason: 'too_far' };
  return { ok: true, at };
}

/** e.g. "Tue, 1 Dec 2026, 18:30" / Arabic equivalent, in Cairo time. */
export function formatCairo(utcMs: number, lang: 'en' | 'ar'): string {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    timeZone: EXAM_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(utcMs));
}
