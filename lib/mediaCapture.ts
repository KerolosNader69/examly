/**
 * Pure helpers for recording answers in the browser (no DOM access here, so they are
 * unit-testable: tests/unit/mediaCapture.test.ts). Used by PreparingStage/ExamRoomStage
 * and, for the shared size limits, by /api/exam/transcribe.
 *
 * Design:
 *  - Transcription gets an AUDIO-ONLY recording at a low bitrate, sent as base64 JSON.
 *    32 kbps Opus is ~4 KB/s: 200 s ≈ 0.8 MB (≈1.07 MB base64), far below Vercel's
 *    ~4.5 MB request-body limit.
 *  - The full recording (video for video exams) never goes through a function body:
 *    the browser uploads it straight to Supabase Storage with a signed upload URL,
 *    one file per question (concatenated MediaRecorder blobs are not a valid file).
 */

/** Requested bitrates (browsers treat them as hints). */
export const AUDIO_BITS_PER_SECOND = 32_000;
export const VIDEO_BITS_PER_SECOND = 1_000_000;

/** Decoded audio accepted by /api/exam/transcribe; base64 + JSON stays < 4.5 MB. */
export const MAX_TRANSCRIBE_AUDIO_BYTES = 3 * 1024 * 1024;

/** Seconds of slack on top of a question's time limit (stop/upload latency). */
export const ANSWER_DURATION_GRACE_SECONDS = 20;

/** How many times a student may (re)submit one question for transcription (server limit). */
export const MAX_TRANSCRIBE_ATTEMPTS = 3;

const AUDIO_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus'];
const VIDEO_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
];

/**
 * First supported container: Chrome/Edge/Firefox -> webm/opus, Safari/iOS -> mp4/aac.
 * undefined = let the browser choose (then read `recorder.mimeType` for the real type).
 */
export function pickRecorderMimeType(isTypeSupported: ((t: string) => boolean) | undefined, kind: 'audio' | 'video'): string | undefined {
  if (typeof isTypeSupported !== 'function') return undefined;
  for (const c of kind === 'video' ? VIDEO_CANDIDATES : AUDIO_CANDIDATES) {
    try {
      if (isTypeSupported(c)) return c;
    } catch {
      // some browsers throw on unknown codecs strings
    }
  }
  return undefined;
}

/** 'audio/webm;codecs=opus' -> 'audio/webm' (what we send as Content-Type). */
export function baseMimeType(mime: string | undefined | null, fallback = 'audio/webm'): string {
  const m = (mime || '').split(';')[0].trim().toLowerCase();
  return /^(audio|video)\/[a-z0-9.+-]+$/.test(m) ? m : fallback;
}

export function extensionForMime(mime: string): string {
  const m = baseMimeType(mime);
  if (m.endsWith('/mp4')) return 'mp4';
  if (m.endsWith('/ogg')) return 'ogg';
  if (m.includes('wav')) return 'wav';
  return 'webm';
}

// ─── Microphone / camera errors ─────────────────────────────────────────────

export type MediaErrorCode = 'denied' | 'no_device' | 'in_use' | 'insecure' | 'unsupported' | 'disconnected' | 'unknown';

export function describeMediaError(err: unknown, needVideo = false): { code: MediaErrorCode; message: string } {
  const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : '';
  const dev = needVideo ? 'camera and microphone' : 'microphone';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return { code: 'denied', message: `Access to your ${dev} was blocked. Click the camera/lock icon in the address bar, allow access, then press Try again.` };
    case 'SecurityError':
      return { code: 'insecure', message: 'Recording is blocked on this page. Open the exam link over https in a normal browser window.' };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return { code: 'no_device', message: `No ${dev} was found. Plug one in (or enable it in your system settings), then press Try again.` };
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return { code: 'in_use', message: `Your ${dev} is being used by another app (for example Zoom or Teams). Close it, then press Try again.` };
    case 'NotSupportedError':
    case 'TypeError':
      return { code: 'unsupported', message: 'This browser cannot record audio here. Use the latest Chrome, Edge, Firefox or Safari.' };
    case 'Disconnected':
      return { code: 'disconnected', message: `Your ${dev} was disconnected. Reconnect it and press Try again to record this answer.` };
    default:
      return { code: 'unknown', message: `We could not start your ${dev}. Check it is connected and allowed, then press Try again.` };
  }
}

// ─── Levels ─────────────────────────────────────────────────────────────────

/** RMS level 0..1 from AnalyserNode.getByteTimeDomainData() (128 = silence). */
export function rmsLevel(samples: ArrayLike<number>): number {
  if (!samples || samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = (samples[i] - 128) / 128;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / samples.length));
}

/** RMS thresholds: below SILENT = nothing audible, below QUIET = barely audible. */
export const SILENT_RMS = 0.01;
export const QUIET_RMS = 0.03;
export const MIN_ANSWER_SECONDS = 2;

export type LevelVerdict = 'ok' | 'quiet' | 'silent' | 'too_short';

/** Verdict for one recording from its peak RMS and duration. */
export function assessRecording(peakRms: number, durationSeconds: number): LevelVerdict {
  if (!(durationSeconds >= MIN_ANSWER_SECONDS)) return 'too_short';
  if (!(peakRms >= SILENT_RMS)) return 'silent';
  if (peakRms < QUIET_RMS) return 'quiet';
  return 'ok';
}

// ─── Sizes ──────────────────────────────────────────────────────────────────

export function estimateRecordingBytes(bitsPerSecond: number, seconds: number): number {
  return Math.ceil((bitsPerSecond / 8) * seconds);
}

export function base64Length(bytes: number): number {
  return 4 * Math.ceil(bytes / 3);
}

// ─── Network ────────────────────────────────────────────────────────────────

export type TranscribeOutcome =
  | { kind: 'ok'; transcript: string }
  | { kind: 'no_speech' }
  | { kind: 'pending_review' }
  | { kind: 'already_answered' }
  | { kind: 'rate_limited' }
  | { kind: 'too_large'; message: string }
  | { kind: 'retryable' }
  | { kind: 'fatal'; message: string };

/** Minimum transcript length treated as speech (same rule as /api/exam/evaluate). */
export const MIN_TRANSCRIPT_CHARS = 3;

/** Maps a /api/exam/transcribe response to what the student UI should do. */
export function classifyTranscribeResponse(status: number, body: unknown): TranscribeOutcome {
  const b = (body && typeof body === 'object' ? body : {}) as { success?: unknown; transcript?: unknown; status?: unknown; error?: unknown };
  const err = typeof b.error === 'string' ? b.error : 'Something went wrong.';
  if (status >= 500 || status === 0) return { kind: 'retryable' };
  if (status === 429) return { kind: 'rate_limited' };
  if (status === 413) return { kind: 'too_large', message: err };
  if (status === 409) return /already been answered/i.test(err) ? { kind: 'already_answered' } : { kind: 'fatal', message: err };
  if (status >= 400) return { kind: 'fatal', message: err };
  if (b.status === 'pending_review') return { kind: 'pending_review' };
  const t = typeof b.transcript === 'string' ? b.transcript.trim() : '';
  if (b.success === true && t.length >= MIN_TRANSCRIPT_CHARS) return { kind: 'ok', transcript: t };
  if (b.success === true) return { kind: 'no_speech' };
  return { kind: 'pending_review' };
}

/**
 * Retries `fn` on thrown network errors or when `shouldRetry(result)` is true, waiting
 * delaysMs[i] between attempts. Returns the last result, or rethrows the last error.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { delaysMs = [1000, 3000], shouldRetry = () => false, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)) }: {
    delaysMs?: number[];
    shouldRetry?: (r: T) => boolean;
    sleep?: (ms: number) => Promise<unknown>;
  } = {}
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    try {
      const r = await fn();
      if (!shouldRetry(r) || attempt === delaysMs.length) return r;
    } catch (err) {
      lastErr = err;
      if (attempt === delaysMs.length) throw err;
    }
    await sleep(delaysMs[attempt]);
  }
  throw lastErr;
}

/** Storage object path for one answer's recording; also used to validate stored paths. */
export function recordingObjectPath(sessionId: string, questionId: string, mime: string, now = Date.now()): string {
  return `recordings/${sessionId}/${questionId}-${now}.${extensionForMime(mime)}`;
}

export function isRecordingPathFor(path: unknown, sessionId: string, questionId: string): path is string {
  if (typeof path !== 'string') return false;
  const prefix = `recordings/${sessionId}/${questionId}-`;
  return path.startsWith(prefix) && /^\d+\.(webm|mp4|ogg|wav)$/.test(path.slice(prefix.length));
}
