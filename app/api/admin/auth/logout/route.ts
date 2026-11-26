import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, adminSessionCookieOptions } from '@/lib/adminSession';

export const dynamic = 'force-dynamic';

/**
 * Always succeeds and always clears the cookie, whether or not the current cookie is valid.
 * Deliberately never reads or verifies the session (middleware also exempts this path).
 */
export async function POST() {
  const response = NextResponse.json({ success: true });
  // Clear the cookie with the same attributes it was set with
  response.cookies.set(ADMIN_SESSION_COOKIE, '', adminSessionCookieOptions(0));
  return response;
}
