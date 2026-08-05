import { NextRequest, NextResponse } from 'next/server';
import { listGiftOpsAudit } from '@/lib/gift-ops-db';
import { authorizeGiftOpsRequest, giftOpsErrorResponse } from '@/lib/gift-ops-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await authorizeGiftOpsRequest(request);
    const audit = await listGiftOpsAudit(request.nextUrl.searchParams.get('search') || undefined);
    return NextResponse.json({ audit }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftOpsErrorResponse(error, 'Unable to load audit history.');
  }
}
