import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/serverAuth';
import { provisionTeacherRow } from '@/lib/provisionTeacher';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/provision-teacher
 *
 * Creates the caller's own teacher row if it doesn't exist yet.
 * - Requires `Authorization: Bearer <access_token>` (verified by Supabase Auth).
 * - The row id and email come from the verified user, never from the body.
 *   If the body names a different userId, the request is rejected.
 * - plan/status in the body are ignored; new rows are always 'free' / 'active'.
 * Body (optional): { name?: string, subdomain?: string }
 */
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { userId?: unknown; name?: unknown; subdomain?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // Empty or invalid body is fine: defaults come from the auth user
  }

  if (body.userId !== undefined && body.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { teacher, alreadyExisted } = await provisionTeacherRow(user, {
      name: body.name,
      subdomain: body.subdomain,
    });
    return NextResponse.json({ success: true, teacher, alreadyExisted });
  } catch (err) {
    console.error('[Provision Teacher API] Failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to create teacher profile.' }, { status: 500 });
  }
}
