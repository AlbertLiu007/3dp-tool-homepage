import { NextRequest, NextResponse } from 'next/server';
import { authorizeGiftRequest, giftApiError } from '@/lib/gift-api';
import { getActiveGiftQuoteSettings } from '@/lib/gift-pricing-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await authorizeGiftRequest(request);
    return NextResponse.json({ settings: await getActiveGiftQuoteSettings() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftApiError(error, 'Unable to load gift quote settings.');
  }
}
