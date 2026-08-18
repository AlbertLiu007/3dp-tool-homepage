import { NextRequest, NextResponse } from 'next/server';
import { authorizeGiftOpsRequest, giftOpsErrorResponse } from '@/lib/gift-ops-auth';
import { getActiveGiftQuoteSettings, listGiftQuoteSettings, updateGiftQuoteSettings } from '@/lib/gift-pricing-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await authorizeGiftOpsRequest(request);
    return NextResponse.json({ settings: await listGiftQuoteSettings() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftOpsErrorResponse(error, 'Unable to load gift quote settings.');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { employee, requestIp } = await authorizeGiftOpsRequest(request, { admin: true, mutation: true });
    const result = await updateGiftQuoteSettings(employee, await request.json() as Record<string, unknown>, requestIp);
    return NextResponse.json({ settings: result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftOpsErrorResponse(error, 'Unable to update gift quote settings.');
  }
}
