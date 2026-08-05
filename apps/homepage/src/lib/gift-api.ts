import { NextRequest, NextResponse } from 'next/server';
import { getGiftSession } from '@/lib/gift-auth';
import { GiftAccessError, requireGiftEmployeeAccess } from '@/lib/gift-db';

export function enforceGiftMutationOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')?.replace(/\/+$/, '');
  const configured = process.env.UNIONAM_PUBLIC_ORIGIN?.trim().replace(/\/+$/, '') || (process.env.NODE_ENV === 'production' ? 'https://unionam.com' : 'http://localhost:3000');
  if (!origin || origin !== configured) throw new GiftAccessError('The request origin is not allowed.', 403, 'forbidden');
}

export async function authorizeGiftRequest(request?: NextRequest, mutation = false) {
  const session = getGiftSession();
  if (!session) throw new GiftAccessError('Authentication required.', 401, 'authentication');
  if (request && mutation) enforceGiftMutationOrigin(request);
  const employee = await requireGiftEmployeeAccess(session);
  return { session, employee };
}

export function giftApiError(error: unknown, context: string) {
  if (error instanceof GiftAccessError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
  }
  console.error(`[gift-api] ${context}`, error);
  return NextResponse.json({ error: 'internal', message: 'Unexpected gift service error.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
}
