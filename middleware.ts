import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from '@/lib/adminSession';

/**
 * Extracts teacher subdomain from host header.
 * Generic detection: ahmed.lvh.me -> "ahmed", teacher.examly.site -> "teacher"
 * Ignores: IP addresses, localhost, bare root domains (lvh.me, examly.site), "www", and Vercel preview domains (*.vercel.app)
 */
function extractSubdomain(hostname: string): string | null {
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
  ) {
    return null;
  }

  // Skip Vercel preview / deployment URLs (e.g. *.vercel.app)
  if (hostname.endsWith('.vercel.app')) {
    return null;
  }

  const parts = hostname.split('.');
  // Root domains (e.g. lvh.me, examly.site) have <= 2 parts
  if (parts.length <= 2) {
    return null;
  }

  const subdomain = parts[0];
  if (subdomain === 'www') {
    return null;
  }

  return subdomain;
}

/** /api/admin/* endpoints reachable without a valid admin session. Keep this list minimal. */
const PUBLIC_ADMIN_API_PATHS = new Set([
  '/api/admin/auth/login',
  '/api/admin/auth/login/',
  '/api/admin/auth/logout',
  '/api/admin/auth/logout/',
]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 0. Admin API guard (defense in depth): every /api/admin/* route except login and logout
  //    requires a valid signed admin session here, even if an individual route forgets its own
  //    check. Logout is exempt so it can always clear an expired/invalid cookie.
  //    Runs before the static/API skip below so no path shape can bypass it.
  if (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) {
    if (PUBLIC_ADMIN_API_PATHS.has(pathname)) {
      return NextResponse.next();
    }

    const session = await verifyAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }
    return NextResponse.next();
  }

  // 1. Admin page guard (also before the static skip, so e.g. /admin/x.y can't bypass it)
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) {
      return NextResponse.next();
    }

    const session = await verifyAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);

    if (!session) {
      const loginUrl = new URL('/admin/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 2. Skip middleware for static assets, Next.js internal files, HMR, and (non-admin) API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/assets') ||
    pathname === '/favicon.ico' ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 3. Extract host & detect subdomain for public pages
  const host = request.headers.get('host') || '';
  const hostname = host.split(':')[0].toLowerCase();
  const subdomain = extractSubdomain(hostname);

  if (subdomain) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-subdomain', subdomain);
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets).*)'],
};


