/**
 * Schema contract: every table/column/function the code uses with the Supabase client
 * must exist in the LIVE database (tests/fixtures/live-schema.json).
 * Run with: npm run test:unit
 *
 * Background: the live DB drifted from 001_initial_schema.sql (no ai_score_breakdown,
 * flagged_reason; tab_switch_count only from 006), and /api/exam/submit returned 500
 * on every submit because PostgREST rejects an update naming an unknown column.
 *
 * When this fails: either the code is wrong, or you added a migration. In the latter
 * case add the column to the fixture in the SAME change as the migration, and run the
 * migration before deploying.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type * as ScanModule from '../lib/supabaseColumnScan';

const scan: typeof ScanModule = await import(new URL('../lib/supabaseColumnScan.ts', import.meta.url).href);
const root = fileURLToPath(new URL('../../', import.meta.url));
const live = JSON.parse(readFileSync(new URL('../fixtures/live-schema.json', import.meta.url), 'utf8')) as {
  tables: Record<string, string[]>;
  functions: string[];
  removed_columns: Record<string, string[] | string>;
};
const SOURCE_DIRS = ['app', 'lib', 'components', 'middleware.ts'];
const result = scan.scanDirs(root, SOURCE_DIRS);

// Storage buckets go through `.storage.from()`, which the scanner skips.
// Payloads built outside the call (not resolvable statically) must be listed here
// with the reason they are known to be safe; a NEW unresolved site fails the test.
const KNOWN_UNRESOLVED = new Set([
  // rows come from buildQuestionRows()/an inline map with literal keys
  // exam_model_id, question_text, model_answer_text, order_index, time_limit_seconds.
  'lib/examCreate.ts|questions|insert(rows)',
]);

test('scanner finds the Supabase usage (sanity: it is not silently matching nothing)', () => {
  assert.ok(result.tables.length >= 50, `only ${result.tables.length} .from() calls found`);
  assert.ok(result.columns.length >= 200, `only ${result.columns.length} column uses found`);
  const tables = new Set(result.tables.map((t) => t.table));
  for (const t of ['exams', 'student_sessions', 'questions', 'teachers', 'audit_logs']) assert.ok(tables.has(t), t);
});

test('every table used exists in the live schema', () => {
  const bad = result.tables.filter((t) => !live.tables[t.table]).map((t) => `${t.file}:${t.line} ${t.table}`);
  assert.deepEqual(bad, []);
});

test('every column used with the Supabase client exists in the live schema', () => {
  const bad = result.columns
    .filter((c) => !live.tables[c.table]?.includes(c.column))
    .map((c) => `${c.file}:${c.line} ${c.table}.${c.column} (${c.kind})`);
  assert.deepEqual(bad, [], `Columns not in tests/fixtures/live-schema.json:\n  ${bad.join('\n  ')}`);
});

test('every RPC exists', () => {
  const bad = result.rpcs.filter((r) => !live.functions.includes(r.fn)).map((r) => `${r.file}:${r.line} ${r.fn}`);
  assert.deepEqual(bad, []);
});

test('no new statically unresolvable query payloads', () => {
  const bad = result.unresolved
    .map((u) => `${u.file}|${u.table}|${u.what}`)
    .filter((k) => !KNOWN_UNRESOLVED.has(k));
  assert.deepEqual(bad, [], 'Add a literal payload, or review the site and list it in KNOWN_UNRESOLVED');
});

test('columns that do not exist live are not referenced anywhere (incl. row property reads)', () => {
  const removed = Object.entries(live.removed_columns).flatMap(([table, cols]) =>
    Array.isArray(cols) ? cols.map((c) => ({ table, column: c })) : []
  );
  assert.ok(removed.length > 0);
  const hits: string[] = [];
  const walk = (p: string) => {
    if (statSync(p).isDirectory()) {
      for (const e of readdirSync(p)) if (e !== 'node_modules' && !e.startsWith('.')) walk(`${p}/${e}`);
      return;
    }
    if (!/\.(ts|tsx)$/.test(p)) return;
    const src = scan.stripComments(readFileSync(p, 'utf8'));
    src.split('\n').forEach((line, i) => {
      for (const r of removed) if (new RegExp(`\\b${r.column}\\b`).test(line)) hits.push(`${p.slice(root.length)}:${i + 1} ${r.table}.${r.column}`);
    });
  };
  for (const d of SOURCE_DIRS) {
    try { walk(`${root}${d}`); } catch { /* missing */ }
  }
  assert.deepEqual(hits, []);
});

test('scanner unit: select parsing handles embeds, aliases, casts and json paths', () => {
  assert.deepEqual(
    scan.parseSelect('student_sessions', '*, exams(id, title), alias:ai_score, transcript::text, question_results->x, rel:exam_models!inner(label)'),
    [
      { table: 'exams', column: 'id' },
      { table: 'exams', column: 'title' },
      { table: 'student_sessions', column: 'ai_score' },
      { table: 'student_sessions', column: 'transcript' },
      { table: 'student_sessions', column: 'question_results' },
      { table: 'exam_models', column: 'label' },
    ]
  );
});

test('scanner unit: detects drifted columns in update payloads, filters and variables', () => {
  const r: ScanModule.ScanResult = { columns: [], rpcs: [], tables: [], unresolved: [] };
  scan.scanSource(
    'x.ts',
    `const p: Record<string, unknown> = { status: 'completed', ai_score_breakdown: {} };
     if (n) p.tab_switch_count = n;
     await db.from('student_sessions').update(p).eq('id', id).eq('status', 'in_progress').select('id');
     let q = db.from('teachers').select('*'); q = q.eq('plan', 'pro').order('created_at');
     // await db.from('exams').update({ commented_out: 1 });`,
    r
  );
  const got = r.columns.map((c) => `${c.table}.${c.column}:${c.kind}`);
  for (const want of [
    'student_sessions.status:update',
    'student_sessions.ai_score_breakdown:update',
    'student_sessions.tab_switch_count:update',
    'student_sessions.id:filter:eq',
    'teachers.plan:filter:eq',
    'teachers.created_at:filter:order',
  ]) assert.ok(got.includes(want), `${want} not in ${got.join(', ')}`);
  assert.ok(!got.some((g) => g.includes('commented_out')));
});

