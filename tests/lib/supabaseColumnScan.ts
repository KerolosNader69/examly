/**
 * Best-effort static scan of Supabase query-builder usage (no dependencies).
 *
 * Finds every `.from('<table>')` chain (not `storage.from(...)`) plus `.rpc('<fn>')`
 * and reports the columns each chain touches:
 *   select('a, b, alias:c, rel(x, y), rel2!fk(*)')    -> columns + embedded tables
 *   insert/update/upsert({ ... }) / ([{ ... }])        -> top-level object keys
 *   insert/update/upsert(ident)                        -> keys of `const ident = {...}`
 *                                                         and `ident.key = ...` in the file
 *   eq/neq/gt/gte/lt/lte/like/ilike/is/in/contains/containedBy/order/not/filter/textSearch
 *                                                      -> first string argument
 *   or('a.eq.1,b.ilike.x') / or(ident = ilikeAnyFilter([...]))
 *                                                      -> column part of each condition
 * Also follows `let q = db.from(...)...; q = q.eq('col', ...)` in the same file.
 *
 * Anything it can't resolve (a payload built elsewhere, a non-literal argument) is
 * returned in `unresolved` so the test can surface it instead of silently passing.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export interface ColumnUse {
  file: string;
  line: number;
  table: string;
  column: string;
  kind: string; // select | insert | update | upsert | filter:<method> | or | order
}
export interface RpcUse { file: string; line: number; fn: string }
export interface Unresolved { file: string; line: number; table: string; what: string }
export interface ScanResult { columns: ColumnUse[]; rpcs: RpcUse[]; tables: { file: string; line: number; table: string }[]; unresolved: Unresolved[] }

const FILTER_METHODS = new Set([
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'likeAllOf', 'likeAnyOf', 'ilikeAllOf', 'ilikeAnyOf',
  'is', 'in', 'contains', 'containedBy', 'overlaps', 'rangeGt', 'rangeGte', 'rangeLt', 'rangeLte', 'rangeAdjacent',
  'order', 'not', 'filter', 'textSearch',
]);
const WRITE_METHODS = new Set(['insert', 'update', 'upsert']);

/** Replace comments with spaces (keeps offsets/line numbers), leave strings intact. */
export function stripComments(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') { out += ' '; i++; }
    } else if (c === '/' && n === '*') {
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; }
      out += '  '; i += 2;
    } else if (c === "'" || c === '"' || c === '`') {
      const q = c; out += c; i++;
      while (i < src.length && src[i] !== q) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] ?? ''); i += 2; continue; }
        out += src[i]; i++;
      }
      out += src[i] ?? ''; i++;
    } else { out += c; i++; }
  }
  return out;
}

/** Index just past the matching close bracket for the opener at `start`. */
function matchBracket(s: string, start: number): number {
  const open = s[start];
  const close = open === '(' ? ')' : open === '[' ? ']' : '}';
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(s, i); continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return i + 1; }
  }
  return s.length;
}
function skipString(s: string, i: number): number {
  const q = s[i];
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === q) return j;
  }
  return s.length;
}

/** End of the expression that starts at `start`: `;`, or `,`/closing bracket at depth 0. */
function chainEnd(s: string, start: number): number {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(s, i); continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') { if (depth === 0) return i; depth--; }
    else if (depth === 0 && (c === ';' || c === ',')) return i;
  }
  return s.length;
}

const lineAt = (s: string, idx: number) => s.slice(0, idx).split('\n').length;

/** First argument as a plain string literal (no `${}`), else null. */
function stringArg(args: string): string | null {
  const m = args.match(/^\s*(['"`])((?:\\[\s\S]|(?!\1)[^\\])*)\1\s*(,|$)/);
  if (!m) return null;
  if (m[1] === '`' && m[2].includes('${')) return null;
  return m[2];
}

/** Split on top-level commas (ignoring nested parens). */
function splitTop(s: string): string[] {
  const parts: string[] = [];
  let depth = 0; let cur = '';
  for (const c of s) {
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += c;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** PostgREST select string -> [table, column][] (embedded relations recurse). */
export function parseSelect(table: string, sel: string): { table: string; column: string }[] {
  const out: { table: string; column: string }[] = [];
  for (let part of splitTop(sel.replace(/\s+/g, ' '))) {
    part = part.replace(/^\.\.\./, '');
    const paren = part.indexOf('(');
    if (paren !== -1 && part.endsWith(')')) {
      // alias:relation!hint!inner(...)  or count()
      const head = part.slice(0, paren).trim();
      const inner = part.slice(paren + 1, -1);
      const rel = head.includes(':') ? head.split(':')[1] : head;
      const relTable = rel.split('!')[0].trim();
      if (['count', 'sum', 'avg', 'min', 'max'].includes(relTable) && inner.trim() === '') continue;
      out.push(...parseSelect(relTable, inner));
      continue;
    }
    let col = part.includes(':') && !part.includes('::') ? part.split(':')[1] : part;
    col = col.split('::')[0].split('->')[0].split('.')[0].trim();
    if (col === '*' || col === '' || col === 'count') continue;
    out.push({ table, column: col });
  }
  return out;
}

/** Top-level keys of an object literal source `{ ... }`. */
function objectKeys(obj: string): string[] | null {
  const body = obj.trim();
  if (!body.startsWith('{')) return null;
  const inner = body.slice(1, matchBracket(body, 0) - 1);
  const keys: string[] = [];
  let depth = 0; let token = ''; let expectKey = true;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === "'" || c === '"' || c === '`') {
      const j = skipString(inner, i);
      if (depth === 0 && expectKey) token += inner.slice(i + 1, j);
      i = j; continue;
    }
    if (c === '(' || c === '[' || c === '{') { depth++; continue; }
    if (c === ')' || c === ']' || c === '}') { depth--; continue; }
    if (depth !== 0) continue;
    if (c === ':' && expectKey) { keys.push(token.trim()); token = ''; expectKey = false; continue; }
    if (c === ',') {
      if (expectKey && /^[A-Za-z_$][\w$]*$/.test(token.trim())) keys.push(token.trim()); // shorthand
      if (expectKey && token.trim().startsWith('...')) return null; // spread: unknown keys
      token = ''; expectKey = true; continue;
    }
    if (expectKey) token += c;
  }
  if (expectKey && /^[A-Za-z_$][\w$]*$/.test(token.trim())) keys.push(token.trim());
  if (expectKey && token.trim().startsWith('...')) return null;
  return keys;
}

/** Keys written by insert/update/upsert(<args>). null => could not resolve. */
function payloadKeys(args: string, file: string): string[] | null {
  const a = args.trim();
  const first = a.slice(0, chainEnd(a, 0)).trim();
  if (first.startsWith('{')) return objectKeys(first);
  if (first.startsWith('[')) {
    const inner = first.slice(1, -1);
    const keys: string[] = [];
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === '{') {
        const end = matchBracket(inner, i);
        const k = objectKeys(inner.slice(i, end));
        if (!k) return null;
        keys.push(...k);
        i = end;
      }
    }
    return keys;
  }
  const ident = first.match(/^[A-Za-z_$][\w$]*$/)?.[0];
  if (!ident) return null;
  const keys = new Set<string>();
  let resolved = false;
  const decl = new RegExp(`(?:const|let|var)\\s+${ident}\\s*(?::[^=]+)?=\\s*\\{`);
  const dm = decl.exec(file);
  if (dm) {
    const start = dm.index + dm[0].length - 1;
    const k = objectKeys(file.slice(start, matchBracket(file, start)));
    if (k) { k.forEach((x) => keys.add(x)); resolved = true; }
  }
  for (const m of file.matchAll(new RegExp(`\\b${ident}(?:\\.([A-Za-z_]\\w*)|\\[(['"])(\\w+)\\2\\])\\s*=[^=]`, 'g'))) {
    keys.add(m[1] ?? m[3]);
  }
  return resolved ? [...keys] : null;
}

function orColumns(filter: string): string[] {
  // `a.eq.1,and(b.gt.2,c.lt.3)` -> a, b, c
  return filter
    .split(/[(),]/)
    .map((p) => p.trim())
    .filter((p) => /^[a-z_][a-z0-9_]*(->>?\w+)*\./.test(p) && !/^(and|or|not)$/.test(p))
    .map((p) => p.split('.')[0].split('->')[0]);
}

/** Analyse one `.from('t')` chain body (text after `.from('t')`). */
function analyseChain(
  chain: string, offset: number, table: string, relFile: string, src: string, res: ScanResult,
) {
  const callRe = /\.\s*([A-Za-z]+)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(chain))) {
    const method = m[1];
    const open = m.index + m[0].length - 1;
    const close = matchBracket(chain, open);
    const args = chain.slice(open + 1, close - 1);
    const line = lineAt(src, offset + m.index);
    const push = (column: string, kind: string, t = table) => res.columns.push({ file: relFile, line, table: t, column, kind });
    if (method === 'select') {
      const s = args.trim() === '' ? '*' : stringArg(args);
      if (s === null) res.unresolved.push({ file: relFile, line, table, what: `select(${args.trim().slice(0, 40)})` });
      else parseSelect(table, s).forEach((c) => push(c.column, 'select', c.table));
    } else if (WRITE_METHODS.has(method)) {
      const keys = payloadKeys(args, src);
      if (!keys) res.unresolved.push({ file: relFile, line, table, what: `${method}(${args.trim().slice(0, 40)})` });
      else keys.forEach((k) => push(k, method));
    } else if (method === 'or') {
      const s = stringArg(args);
      if (s !== null) orColumns(s).forEach((c) => push(c, 'or'));
      else {
        const ident = args.trim().match(/^[A-Za-z_$][\w$]*$/)?.[0];
        const built = ident && new RegExp(`${ident}\\s*=\\s*ilikeAnyFilter\\(\\s*\\[([^\\]]*)\\]`).exec(src);
        if (built) built[1].match(/['"`](\w+)['"`]/g)?.forEach((q) => push(q.slice(1, -1), 'or'));
        else res.unresolved.push({ file: relFile, line, table, what: `or(${args.trim().slice(0, 40)})` });
      }
    } else if (FILTER_METHODS.has(method)) {
      const s = stringArg(args);
      if (s === null) { res.unresolved.push({ file: relFile, line, table, what: `${method}(${args.trim().slice(0, 40)})` }); }
      else {
        // `rel.col` targets an embedded table; `{ foreignTable: 'rel' }` / referencedTable too.
        const ref = args.match(/(?:foreignTable|referencedTable)\s*:\s*['"`](\w+)['"`]/)?.[1];
        const [a, b] = s.split('->')[0].split('.');
        if (b && !ref) push(b, `filter:${method}`, a);
        else push(a, `filter:${method}`, ref ?? table);
      }
    }
    callRe.lastIndex = close;
  }
}

export function scanSource(relFile: string, raw: string, res: ScanResult) {
  const src = stripComments(raw);
  const fromRe = /\.\s*from\s*\(\s*(['"`])([\w-]+)\1\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = fromRe.exec(src))) {
    const before = src.slice(Math.max(0, m.index - 40), m.index);
    if (/storage\s*$/.test(before) || /\.storage\s*\)?\s*$/.test(before)) continue;
    const table = m[2];
    res.tables.push({ file: relFile, line: lineAt(src, m.index), table });
    const bodyStart = m.index + m[0].length;
    const end = chainEnd(src, bodyStart);
    analyseChain(src.slice(bodyStart, end), bodyStart, table, relFile, src, res);
    // `let q = db.from('t')...;` followed by `q = q.eq(...)` statements.
    const decl = /(?:let|var|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?[\w$.]*\s*$/.exec(src.slice(Math.max(0, m.index - 120), m.index));
    if (decl) {
      const v = decl[1];
      for (const r of src.matchAll(new RegExp(`\\b${v}\\s*=\\s*${v}(?=\\s*\\.)`, 'g'))) {
        const s = r.index! + r[0].length;
        analyseChain(src.slice(s, chainEnd(src, s)), s, table, relFile, src, res);
      }
    }
  }
  for (const r of src.matchAll(/\.\s*rpc\s*\(\s*(['"`])(\w+)\1/g)) {
    res.rpcs.push({ file: relFile, line: lineAt(src, r.index!), fn: r[2] });
  }
}

export function scanDirs(root: string, dirs: string[]): ScanResult {
  const res: ScanResult = { columns: [], rpcs: [], tables: [], unresolved: [] };
  const walk = (p: string) => {
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const e of readdirSync(p)) if (e !== 'node_modules' && !e.startsWith('.')) walk(join(p, e));
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(p) && !/\.d\.ts$/.test(p)) {
      scanSource(relative(root, p).replace(/\\/g, '/'), readFileSync(p, 'utf8'), res);
    }
  };
  for (const d of dirs) {
    try { walk(join(root, d)); } catch { /* missing dir */ }
  }
  return res;
}
