/** Minimal `next/server` for route tests: NextResponse.json -> a standard Response. */
export class NextResponse extends Response {
  static json(body: unknown, init: ResponseInit = {}) {
    const headers = new Headers(init.headers);
    headers.set('content-type', 'application/json');
    return new Response(JSON.stringify(body), { ...init, headers });
  }
}
