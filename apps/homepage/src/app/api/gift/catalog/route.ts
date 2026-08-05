import { NextRequest, NextResponse } from 'next/server';
import { authorizeGiftRequest, giftApiError } from '@/lib/gift-api';
import { listPublishedGiftModels } from '@/lib/gift-library-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { session } = await authorizeGiftRequest(request);
    return NextResponse.json(await listPublishedGiftModels(session), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftApiError(error, 'Unable to load gift catalog.');
  }
}
