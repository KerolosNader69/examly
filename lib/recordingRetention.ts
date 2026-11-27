/**
 * Pure helpers for deleting a session's recording files (retention cron and the
 * teacher's "Delete recording now"). Client-safe; the Storage/DB calls live in
 * lib/recordingDeletion.ts. Tests: tests/unit/privacy.test.ts.
 */
import { recordingPathFromStored } from './examPublic.ts';
import { RESULT_SUMMARY_KEY } from './sessionSummary.ts';
import { RECORDING_RETENTION_DAYS } from './consent.ts';

export const RECORDINGS_BUCKET = 'exam-recordings';
/** Sessions handled per cron run (each needs a Storage list + remove + row update). */
export const RETENTION_BATCH_SIZE = 25;

export type RecordingDeletedReason = 'retention' | 'teacher';

/**
 * Dry run unless RECORDING_RETENTION_DRY_RUN is exactly "false": a missing or mistyped
 * value never deletes anything.
 */
export function isRetentionDryRun(env: Record<string, string | undefined>): boolean {
  return env.RECORDING_RETENTION_DRY_RUN !== 'false';
}

/** Sessions that started before this instant are past retention. */
export function retentionCutoffIso(now: number, days = RECORDING_RETENTION_DAYS): string {
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
}

const FILE_NAME_RE = /^[0-9a-f-]{36}-\d+\.(webm|mp4|ogg|wav)$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function sessionRecordingFolder(sessionId: string): string {
  if (!UUID_RE.test(sessionId)) throw new Error('invalid session id');
  return `recordings/${sessionId}`;
}

/**
 * Every recording object of a session: the legacy combined file (recording_url), each
 * answer's stored recordingPath, and every file found in the session's folder (re-recorded
 * attempts leave earlier uploads there that question_results no longer points to).
 * Paths outside this session's own prefix are never returned.
 */
export function sessionRecordingPaths(
  row: { id: string; recording_url?: unknown; question_results?: unknown },
  folderFileNames: readonly string[] = []
): string[] {
  const folder = sessionRecordingFolder(row.id);
  const out = new Set<string>();
  const legacy = recordingPathFromStored(row.recording_url);
  if (legacy && (legacy.startsWith(`${folder}/`) || legacy.startsWith(`recordings/${row.id}-`))) out.add(legacy);
  const qr = row.question_results;
  if (qr && typeof qr === 'object' && !Array.isArray(qr)) {
    for (const [key, entry] of Object.entries(qr as Record<string, unknown>)) {
      if (key === RESULT_SUMMARY_KEY || !entry || typeof entry !== 'object') continue;
      const p = (entry as { recordingPath?: unknown }).recordingPath;
      if (typeof p === 'string' && p.startsWith(`${folder}/`) && FILE_NAME_RE.test(p.slice(folder.length + 1))) out.add(p);
    }
  }
  for (const name of folderFileNames) if (FILE_NAME_RE.test(name)) out.add(`${folder}/${name}`);
  return [...out];
}

/**
 * question_results with every pointer to a recording removed (recordingPath,
 * recordingMimeType) and the summary's per-question hasRecording set to false.
 * Transcripts, scores and feedback are kept.
 */
export function questionResultsWithoutRecordings(qr: unknown): Record<string, unknown> {
  if (!qr || typeof qr !== 'object' || Array.isArray(qr)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(qr as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      out[key] = entry;
      continue;
    }
    if (key === RESULT_SUMMARY_KEY) {
      const summary = { ...(entry as Record<string, unknown>) };
      if (Array.isArray(summary.questions)) {
        summary.questions = summary.questions.map((q) => (q && typeof q === 'object' ? { ...q, hasRecording: false } : q));
      }
      out[key] = summary;
      continue;
    }
    const { recordingPath: _p, recordingMimeType: _m, ...rest } = entry as Record<string, unknown>;
    void _p;
    void _m;
    out[key] = rest;
  }
  return out;
}

/** Teacher-facing text for a deleted recording. */
export function recordingDeletedLabel(reason: unknown, deletedAt?: unknown): string {
  const when = typeof deletedAt === 'string' && Number.isFinite(Date.parse(deletedAt)) ? ` on ${new Date(deletedAt).toLocaleDateString()}` : '';
  return reason === 'teacher'
    ? `Recording deleted by the teacher${when}.`
    : `Recording deleted after ${RECORDING_RETENTION_DAYS} days${when}.`;
}
