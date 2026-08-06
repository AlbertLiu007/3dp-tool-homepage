import { NextRequest, NextResponse } from 'next/server';
import { authorizeGiftRequest, giftApiError } from '@/lib/gift-api';
import { isLocalGiftDevelopmentSession } from '@/lib/gift-db';
import { listPublishedGiftModels } from '@/lib/gift-library-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { session } = await authorizeGiftRequest(request);
    if (isLocalGiftDevelopmentSession(session)) {
      return NextResponse.json({ models: [], categories: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json(await listPublishedGiftModels(session), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftApiError(error, 'Unable to load gift catalog.');
  }
}
