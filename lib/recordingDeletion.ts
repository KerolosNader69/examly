import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  RECORDINGS_BUCKET,
  questionResultsWithoutRecordings,
  sessionRecordingFolder,
  sessionRecordingPaths,
  type RecordingDeletedReason,
} from '@/lib/recordingRetention';

/**
 * Server-only: deletes one session's recording FILES through the Storage API (never by
 * deleting storage.objects rows), then marks the row: recording_deleted_at/_reason set,
 * recording_url and every per-answer recordingPath cleared. Transcript and scores stay.
 *
 * Idempotent: removing missing objects succeeds, and the row update only applies while
 * recording_deleted_at is still NULL. On any Storage error nothing is marked, so the next
 * run retries. dryRun counts the files and changes nothing.
 */
export interface SessionForDeletion {
  id: string;
  recording_url: unknown;
  question_results: unknown;
}

export type DeletionOutcome = { ok: true; files: number; marked: boolean } | { ok: false; files: number };

export async function deleteSessionRecordings(
  row: SessionForDeletion,
  reason: RecordingDeletedReason,
  { dryRun }: { dryRun: boolean }
): Promise<DeletionOutcome> {
  const bucket = supabaseAdmin.storage.from(RECORDINGS_BUCKET);
  const listed = await bucket.list(sessionRecordingFolder(row.id), { limit: 1000 });
  if (listed.error) return { ok: false, files: 0 };
  const names = (listed.data ?? []).map((f: { name?: string }) => f.name ?? '');
  const paths = sessionRecordingPaths(row, names);
  if (dryRun) return { ok: true, files: paths.length, marked: false };

  if (paths.length > 0) {
    const removed = await bucket.remove(paths);
    if (removed.error) return { ok: false, files: paths.length };
  }

  const { data, error } = await supabaseAdmin
    .from('student_sessions')
    .update({
      recording_deleted_at: new Date().toISOString(),
      recording_deleted_reason: reason,
      recording_url: null,
      question_results: questionResultsWithoutRecordings(row.question_results),
    })
    .eq('id', row.id)
    .is('recording_deleted_at', null)
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, files: paths.length };
  return { ok: true, files: paths.length, marked: Boolean(data) };
}
