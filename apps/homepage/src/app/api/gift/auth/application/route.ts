import { NextRequest, NextResponse } from 'next/server';
import { getGiftSession } from '@/lib/gift-auth';
import { GiftAccessError, submitGiftEmployeeApplication } from '@/lib/gift-db';
import { queueGiftEmployeeApplicationNotification } from '@/lib/gift-wecom-notifications';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const session = getGiftSession();
  if (!session) return NextResponse.json({ error: 'authentication' }, { status: 401 });
  try {
    const origin = request.headers.get('origin');
    const allowedOrigin = process.env.UNIONAM_PUBLIC_ORIGIN?.trim() || (process.env.NODE_ENV === 'production' ? 'https://unionam.com' : 'http://localhost:3000');
    if (!origin || origin.replace(/\/+$/, '') !== allowedOrigin.replace(/\/+$/, '')) {
      throw new GiftAccessError('The request origin is not allowed.', 403, 'forbidden');
    }
    const body = await request.json() as { reason?: unknown };
    const employee = await submitGiftEmployeeApplication(session, typeof body.reason === 'string' ? body.reason : '');
    if (employee) await queueGiftEmployeeApplicationNotification(employee.id);
    return NextResponse.json({ employee }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof GiftAccessError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    console.error('[gift-auth] Unable to submit AI access application.', error);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
