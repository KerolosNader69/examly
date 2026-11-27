import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isCronAuthorized } from '@/lib/cronAuth';
import { deleteSessionRecordings } from '@/lib/recordingDeletion';
import { RETENTION_BATCH_SIZE, isRetentionDryRun, retentionCutoffIso } from '@/lib/recordingRetention';
import { RECORDING_RETENTION_DAYS } from '@/lib/consent';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const noStore = { 'Cache-Control': 'no-store' };

/**
 * GET /api/cron/recording-retention   (Vercel Cron, daily; see vercel.json)
 *
 * Deletes the recording FILES of sessions that started more than RECORDING_RETENTION_DAYS
 * ago, via the Storage API, and marks each row (lib/recordingDeletion.ts).
 *
 * Scope: only sessions with recorded consent (consent_at set, i.e. joined through the
 * consent notice). Sessions from before the notice existed are never touched by this job.
 *
 * Safety:
 *  - Requires `Authorization: Bearer <CRON_SECRET>` (fails closed without CRON_SECRET).
 *  - Dry run unless RECORDING_RETENTION_DRY_RUN=false: counts what it WOULD delete.
 *  - Idempotent: already-marked rows are skipped; a failed Storage call marks nothing.
 *  - Logs counts only (no names, ids, paths or transcripts).
 *  - At most RETENTION_BATCH_SIZE sessions per run; the rest are picked up next day.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore });
  }

  const dryRun = isRetentionDryRun(process.env);
  const cutoff = retentionCutoffIso(Date.now());

  const { data: rows, error } = await supabaseAdmin
    .from('student_sessions')
    .select('id, recording_url, question_results')
    .is('recording_deleted_at', null)
    .not('consent_at', 'is', null)
    .lt('started_at', cutoff)
    .order('started_at', { ascending: true })
    .limit(RETENTION_BATCH_SIZE);

  if (error) {
    console.error('[recording-retention] query failed:', error.code ?? 'unknown');
    return NextResponse.json({ error: 'Query failed' }, { status: 500, headers: noStore });
  }

  let sessions = 0;
  let files = 0;
  let failed = 0;
  for (const row of rows ?? []) {
    const outcome = await deleteSessionRecordings(row, 'retention', { dryRun });
    if (!outcome.ok) {
      failed += 1;
      continue;
    }
    sessions += 1;
    files += outcome.files;
  }

  const summary = {
    dryRun,
    retentionDays: RECORDING_RETENTION_DAYS,
    eligibleSessions: rows?.length ?? 0,
    [dryRun ? 'wouldDeleteSessions' : 'deletedSessions']: sessions,
    [dryRun ? 'wouldDeleteFiles' : 'deletedFiles']: files,
    failedSessions: failed,
    moreRemaining: (rows?.length ?? 0) === RETENTION_BATCH_SIZE,
  };
  console.info('[recording-retention]', JSON.stringify(summary));
  return NextResponse.json(summary, { headers: noStore });
}
