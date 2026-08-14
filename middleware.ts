import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip middleware entirely for static assets, Next.js internal files, HMR, and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/assets') ||
    pathname === '/favicon.ico' ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 2. Preserve existing /admin route authentication logic
  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) {
      return NextResponse.next();
    }

    const adminSession = request.cookies.get('examly_admin_session')?.value;

    if (!adminSession) {
      const loginUrl = new URL('/admin/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    try {
      const payloadText = Buffer.from(adminSession, 'base64').toString('utf8');
      const session = JSON.parse(payloadText);

      if (session?.role !== 'admin' || !session?.uid) {
        const loginUrl = new URL('/admin/login', request.url);
        return NextResponse.redirect(loginUrl);
      }
    } catch {
      const loginUrl = new URL('/admin/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
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


