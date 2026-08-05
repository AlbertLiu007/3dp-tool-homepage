import { NextRequest, NextResponse } from 'next/server';
import { getGiftOpsDashboard } from '@/lib/gift-ops-db';
import { authorizeGiftOpsRequest, giftOpsErrorResponse } from '@/lib/gift-ops-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await authorizeGiftOpsRequest(request);
    return NextResponse.json({ dashboard: await getGiftOpsDashboard() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftOpsErrorResponse(error, 'Unable to load dashboard.');
  }
}
