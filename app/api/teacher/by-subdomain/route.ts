import { NextRequest, NextResponse } from 'next/server';
import { getTeacherBySubdomain } from '@/lib/getTeacherBySubdomain';

/**
 * GET /api/teacher/by-subdomain?subdomain=ahmed
 * Returns teacher branding or 404 response.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let subdomain = searchParams.get('subdomain');

  // Fallback to x-subdomain request header if param not passed explicitly
  if (!subdomain) {
    subdomain = request.headers.get('x-subdomain');
  }

  if (!subdomain) {
    return NextResponse.json({ found: false, error: 'No subdomain provided' }, { status: 400 });
  }

  const teacher = await getTeacherBySubdomain(subdomain);

  if (!teacher) {
    return NextResponse.json(
      { found: false, subdomain, error: "This teacher page doesn't exist" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    found: true,
    subdomain,
    teacher: {
      id: teacher.id,
      name: teacher.name,
      subdomain: teacher.subdomain,
      logo_url: teacher.logo_url,
      brand_color: teacher.brand_color,
    },
  });
}
