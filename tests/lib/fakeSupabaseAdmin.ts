/**
 * In-memory stand-in for lib/supabase-admin.ts used by route tests.
 *
 * It behaves like PostgREST against the LIVE schema (tests/fixtures/live-schema.json):
 * a select/insert/update that names a column the live table doesn't have fails with
 * the same PGRST204-style error the real database returns, and nothing is written.
 *
 * Supports what the student/teacher/cron routes use: from().select().eq/neq/gt/gte/lt/lte/is/not
 * ...order().limit().maybeSingle()/single(), select('*', { count, head }), insert([...]).select(),
 * update(payload).eq()...select(), one level of embedded selects via <rel>_id (e.g. exams(teacher_id)),
 * storage.from().upload()/list()/remove()/createSignedUploadUrl(), and auth.getUser(token).
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- test double for loosely typed PostgREST rows */
import { readFileSync } from 'node:fs';
import { parseSelect } from './supabaseColumnScan.ts';

type Row = Record<string, any>;
const live = JSON.parse(readFileSync(new URL('../fixtures/live-schema.json', import.meta.url), 'utf8')) as {
  tables: Record<string, string[]>;
};

export const fakeDb: {
  tables: Record<string, Row[]>;
  uploads: string[];
  /** Objects in the fake bucket (full paths). */
  objects: string[];
  removed: string[];
  /** Set to make storage list/remove fail. */
  failStorage: boolean;
  /** access token -> user id, for auth.getUser. */
  users: Record<string, string>;
} = { tables: {}, uploads: [], objects: [], removed: [], failStorage: false, users: {} };

export function resetFakeDb(tables: Record<string, Row[]>, extra: { objects?: string[]; users?: Record<string, string> } = {}) {
  fakeDb.tables = structuredClone(tables);
  fakeDb.uploads = [];
  fakeDb.objects = [...(extra.objects ?? [])];
  fakeDb.removed = [];
  fakeDb.failStorage = false;
  fakeDb.users = { ...(extra.users ?? {}) };
}

const missing = (table: string, column: string) => ({
  data: null,
  error: { code: 'PGRST204', message: `Could not find the '${column}' column of '${table}' in the schema cache`, details: null, hint: null },
});

type Filter = { column: string; test: (v: unknown) => boolean };

class Query implements PromiseLike<{ data: any; error: any; count?: number | null }> {
  private op: 'select' | 'update' | 'insert' = 'select';
  private payload: Row | null = null;
  private inserts: Row[] = [];
  private cols = '*';
  private countOnly = false;
  private filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private max: number | null = null;
  private mode: 'many' | 'maybe' | 'single' = 'many';
  private table: string;
  constructor(table: string) { this.table = table; }

  select(cols = '*', opts?: { count?: string; head?: boolean }) {
    this.cols = cols;
    if (this.op === 'select') this.countOnly = Boolean(opts?.head);
    return this;
  }
  update(payload: Row) { this.op = 'update'; this.payload = payload; return this; }
  insert(rows: Row[] | Row) { this.op = 'insert'; this.inserts = Array.isArray(rows) ? rows : [rows]; return this; }
  private f(column: string, test: (v: unknown) => boolean) { this.filters.push({ column, test }); return this; }
  eq(c: string, v: unknown) { return this.f(c, (x) => x === v); }
  neq(c: string, v: unknown) { return this.f(c, (x) => x !== v); }
  gt(c: string, v: any) { return this.f(c, (x: any) => x != null && x > v); }
  gte(c: string, v: any) { return this.f(c, (x: any) => x != null && x >= v); }
  lt(c: string, v: any) { return this.f(c, (x: any) => x != null && x < v); }
  lte(c: string, v: any) { return this.f(c, (x: any) => x != null && x <= v); }
  is(c: string, v: unknown) { return this.f(c, (x) => (v === null ? x == null : x === v)); }
  not(c: string, op: string, v: unknown) {
    if (op !== 'is') throw new Error(`fake not(${op}) unsupported`);
    return this.f(c, (x) => (v === null ? x != null : x !== v));
  }
  order(column: string, opts?: { ascending?: boolean }) { this.orderBy = { column, ascending: opts?.ascending !== false }; return this; }
  limit(n: number) { this.max = n; return this; }
  maybeSingle() { this.mode = 'maybe'; return this.exec(); }
  single() { this.mode = 'single'; return this.exec(); }
  then<A, B>(ok?: ((v: any) => A | PromiseLike<A>) | null, err?: ((e: any) => B | PromiseLike<B>) | null) {
    return this.exec().then(ok, err);
  }

  /**
   * One level of embedding: `rel(cols)` is one-to-many when rel's rows carry
   * `<this table without trailing s>_id` (exam_models -> questions), else many-to-one
   * through `<rel without trailing s>_id` on this row (student_sessions -> exams).
   */
  private project(row: Row): Row {
    const out: Row = { ...row };
    const back = `${this.table.replace(/s$/, '')}_id`;
    for (const m of this.cols.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
      const rel = m[1];
      const relRows = fakeDb.tables[rel] ?? [];
      if (relRows.some((r) => back in r)) {
        out[rel] = relRows.filter((r) => r[back] === row.id).map((r) => structuredClone(r));
        continue;
      }
      const target = relRows.find((r) => r.id === row[`${rel.replace(/s$/, '')}_id`]);
      out[rel] = target ? structuredClone(target) : null;
    }
    return out;
  }

  private async exec() {
    const known = live.tables[this.table];
    if (!known) return { data: null, error: { code: '42P01', message: `relation "public.${this.table}" does not exist` } };
    for (const f of this.filters) if (!known.includes(f.column)) return missing(this.table, f.column);
    if (this.orderBy && !known.includes(this.orderBy.column)) return missing(this.table, this.orderBy.column);
    for (const c of parseSelect(this.table, this.cols)) {
      const cols = live.tables[c.table];
      if (!cols || !cols.includes(c.column)) return missing(c.table, c.column);
    }
    if (this.payload) for (const k of Object.keys(this.payload)) if (!known.includes(k)) return missing(this.table, k);
    for (const r of this.inserts) for (const k of Object.keys(r)) if (!known.includes(k)) return missing(this.table, k);

    const rows = (fakeDb.tables[this.table] ??= []);
    let matched: Row[];
    if (this.op === 'insert') {
      matched = this.inserts.map((r, i) => ({
        id: r.id ?? `00000000-0000-4000-8000-${String(rows.length + i + 1).padStart(12, '0')}`,
        ...structuredClone(r),
      }));
      rows.push(...matched);
    } else {
      matched = rows.filter((r) => this.filters.every((f) => f.test(r[f.column])));
      if (this.op === 'update') for (const r of matched) Object.assign(r, structuredClone(this.payload));
    }
    if (this.countOnly) return { data: null, error: null, count: matched.length };
    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      matched = [...matched].sort((a, b) => (a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0) * (ascending ? 1 : -1));
    }
    if (this.max !== null) matched = matched.slice(0, this.max);
    const out = matched.map((r) => this.project(structuredClone(r)));
    if (this.mode === 'many') return { data: out, error: null, count: out.length };
    if (this.mode === 'single' && out.length !== 1) return { data: null, error: { code: 'PGRST116', message: 'not exactly one row' } };
    return { data: out[0] ?? null, error: null };
  }
}

const storageError = { data: null, error: { message: 'storage unavailable' } };

export const supabaseAdmin = {
  from: (table: string) => new Query(table),
  rpc: async () => ({ data: null, error: { message: 'rpc not mocked' } }),
  auth: {
    getUser: async (token: string) => {
      const id = fakeDb.users[token];
      return id ? { data: { user: { id } }, error: null } : { data: { user: null }, error: { message: 'invalid token' } };
    },
  },
  storage: {
    from: () => ({
      upload: async (path: string) => {
        fakeDb.uploads.push(path);
        fakeDb.objects.push(path);
        return { data: { path }, error: null };
      },
      createSignedUploadUrl: async (path: string) => ({ data: { path, token: 'signed-upload-token' }, error: null }),
      list: async (prefix: string) => {
        if (fakeDb.failStorage) return storageError;
        const names = fakeDb.objects
          .filter((p) => p.startsWith(`${prefix}/`) && !p.slice(prefix.length + 1).includes('/'))
          .map((p) => ({ name: p.slice(prefix.length + 1) }));
        return { data: names, error: null };
      },
      remove: async (paths: string[]) => {
        if (fakeDb.failStorage) return storageError;
        fakeDb.removed.push(...paths);
        fakeDb.objects = fakeDb.objects.filter((p) => !paths.includes(p));
        return { data: paths.map((name) => ({ name })), error: null };
      },
    }),
  },
};

export function isSupabaseAdminConfigured() { return true; }
