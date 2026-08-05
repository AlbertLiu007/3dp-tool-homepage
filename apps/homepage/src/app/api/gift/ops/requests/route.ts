import { NextRequest, NextResponse } from 'next/server';
import { listGiftOpsPrintRequests } from '@/lib/gift-ops-db';
import { authorizeGiftOpsRequest, giftOpsErrorResponse } from '@/lib/gift-ops-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await authorizeGiftOpsRequest(request);
    const requests = await listGiftOpsPrintRequests(request.nextUrl.searchParams.get('status') || undefined);
    return NextResponse.json({ requests }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftOpsErrorResponse(error, 'Unable to load print requests.');
  }
}
