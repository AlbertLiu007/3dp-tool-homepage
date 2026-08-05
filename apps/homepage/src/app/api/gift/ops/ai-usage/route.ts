import { NextRequest, NextResponse } from 'next/server';
import { listGiftOpsAiUsage } from '@/lib/gift-ops-db';
import { authorizeGiftOpsRequest, giftOpsErrorResponse } from '@/lib/gift-ops-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await authorizeGiftOpsRequest(request);
    const usage = await listGiftOpsAiUsage({
      status: request.nextUrl.searchParams.get('status') || undefined,
      type: request.nextUrl.searchParams.get('type') || undefined,
      search: request.nextUrl.searchParams.get('search') || undefined,
    });
    return NextResponse.json({ usage }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftOpsErrorResponse(error, 'Unable to load AI usage.');
  }
}
