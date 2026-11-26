/**
 * Module hooks so Node's test runner can import Next route handlers directly:
 *   '@/lib/supabase-admin' -> tests/lib/fakeSupabaseAdmin.ts (live-schema-checking fake)
 *   'next/server'          -> tests/lib/fakeNextServer.ts
 *   '@/<path>'             -> <project>/<path>.ts(x)
 * Import this module before importing a route.
 */
import * as nodeModule from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const mocks: Record<string, string> = {
  '@/lib/supabase-admin': new URL('./fakeSupabaseAdmin.ts', import.meta.url).href,
  'next/server': new URL('./fakeNextServer.ts', import.meta.url).href,
};

type ResolveResult = { url: string; shortCircuit?: boolean };
type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => ResolveResult) => ResolveResult;
// module.registerHooks (Node >= 22.15) is not in @types/node 20 yet.
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { resolve: Resolve }) => void };

registerHooks({
  resolve(specifier, context, next) {
    if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true };
    if (specifier.startsWith('@/')) {
      for (const ext of ['.ts', '.tsx', '/index.ts']) {
        const url = new URL(specifier.slice(2) + ext, root);
        if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
      }
    }
    return next(specifier, context);
  },
});
