import { NextResponse } from 'next/server';
import { getGiftSession } from '@/lib/gift-auth';
import { getGiftEmployeeAccess, GiftAccessError } from '@/lib/gift-db';
import { createGiftOpsCsrfToken, GIFT_OPS_CSRF_COOKIE, giftOpsCsrfCookieOptions } from '@/lib/gift-ops-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = getGiftSession();

  if (!session) {
    return NextResponse.json(
      { authenticated: false },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const employee = await getGiftEmployeeAccess(session);
    if (!employee || employee.employmentStatus !== 'active') {
      return NextResponse.json({ authenticated: false }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }
    const csrfToken = ['operator', 'admin'].includes(employee.role) && employee.approvalStatus === 'approved'
      ? createGiftOpsCsrfToken()
      : undefined;
    const response = NextResponse.json(
      { authenticated: true, user: employee, ...(csrfToken ? { csrfToken } : {}) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
    if (csrfToken) response.cookies.set(GIFT_OPS_CSRF_COOKIE, csrfToken, giftOpsCsrfCookieOptions());
    return response;
  } catch (error) {
    const configuration = error instanceof GiftAccessError && error.code === 'configuration';
    console.error('[gift-auth] Unable to load employee access.', error);
    return NextResponse.json(
      { authenticated: false, error: configuration ? 'configuration' : 'internal' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
