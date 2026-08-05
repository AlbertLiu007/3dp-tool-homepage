import { NextRequest, NextResponse } from 'next/server';
import { authorizeGiftRequest, giftApiError } from '@/lib/gift-api';
import { createGiftPrintRequest, listMyGiftPrintRequests } from '@/lib/gift-library-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { session } = await authorizeGiftRequest(request);
    return NextResponse.json({ requests: await listMyGiftPrintRequests(session) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftApiError(error, 'Unable to load employee print requests.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session } = await authorizeGiftRequest(request, true);
    const result = await createGiftPrintRequest(session, await request.json() as Record<string, unknown>);
    return NextResponse.json(result, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftApiError(error, 'Unable to create print request.');
  }
}
