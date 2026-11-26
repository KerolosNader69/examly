/**
 * In-memory stand-in for lib/supabase-admin.ts used by route tests.
 *
 * It behaves like PostgREST against the LIVE schema (tests/fixtures/live-schema.json):
 * a select/insert/update that names a column the live table doesn't have fails with
 * the same PGRST204-style error the real database returns, and nothing is written.
 *
 * Supports what the student routes use: from().select().eq()...maybeSingle()/single(),
 * update(payload).eq()...select(), and storage.from().upload()/remove().
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- test double for loosely typed PostgREST rows */
import { readFileSync } from 'node:fs';
import { parseSelect } from './supabaseColumnScan.ts';

type Row = Record<string, any>;
const live = JSON.parse(readFileSync(new URL('../fixtures/live-schema.json', import.meta.url), 'utf8')) as {
  tables: Record<string, string[]>;
};

export const fakeDb: { tables: Record<string, Row[]>; uploads: string[] } = { tables: {}, uploads: [] };

export function resetFakeDb(tables: Record<string, Row[]>) {
  fakeDb.tables = structuredClone(tables);
  fakeDb.uploads = [];
}

const missing = (table: string, column: string) => ({
  data: null,
  error: { code: 'PGRST204', message: `Could not find the '${column}' column of '${table}' in the schema cache`, details: null, hint: null },
});

class Query implements PromiseLike<{ data: any; error: any; count?: number | null }> {
  private op: 'select' | 'update' = 'select';
  private payload: Row | null = null;
  private cols = '*';
  private filters: [string, unknown][] = [];
  private mode: 'many' | 'maybe' | 'single' = 'many';
  private table: string;
  constructor(table: string) { this.table = table; }

  select(cols = '*') { this.cols = cols; return this; }
  update(payload: Row) { this.op = 'update'; this.payload = payload; return this; }
  eq(column: string, value: unknown) { this.filters.push([column, value]); return this; }
  maybeSingle() { this.mode = 'maybe'; return this.exec(); }
  single() { this.mode = 'single'; return this.exec(); }
  then<A, B>(ok?: ((v: any) => A | PromiseLike<A>) | null, err?: ((e: any) => B | PromiseLike<B>) | null) {
    return this.exec().then(ok, err);
  }

  private async exec() {
    const known = live.tables[this.table];
    if (!known) return { data: null, error: { code: '42P01', message: `relation "public.${this.table}" does not exist` } };
    for (const f of this.filters) if (!known.includes(f[0])) return missing(this.table, f[0]);
    for (const c of parseSelect(this.table, this.cols)) {
      const cols = live.tables[c.table];
      if (!cols || !cols.includes(c.column)) return missing(c.table, c.column);
    }
    if (this.payload) for (const k of Object.keys(this.payload)) if (!known.includes(k)) return missing(this.table, k);

    const rows = (fakeDb.tables[this.table] ??= []);
    const matched = rows.filter((r) => this.filters.every(([c, v]) => r[c] === v));
    if (this.op === 'update') for (const r of matched) Object.assign(r, structuredClone(this.payload));
    const out = structuredClone(matched);
    if (this.mode === 'many') return { data: out, error: null };
    if (this.mode === 'single' && out.length !== 1) return { data: null, error: { code: 'PGRST116', message: 'not exactly one row' } };
    return { data: out[0] ?? null, error: null };
  }
}

export const supabaseAdmin = {
  from: (table: string) => new Query(table),
  rpc: async () => ({ data: null, error: { message: 'rpc not mocked' } }),
  storage: {
    from: () => ({
      upload: async (path: string) => { fakeDb.uploads.push(path); return { data: { path }, error: null }; },
      remove: async () => ({ data: null, error: null }),
    }),
  },
};

export function isSupabaseAdminConfigured() { return true; }
