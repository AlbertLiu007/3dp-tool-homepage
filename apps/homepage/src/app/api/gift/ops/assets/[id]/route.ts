import { NextRequest, NextResponse } from 'next/server';
import { getGiftOpsAssetUrl, type GiftImageVariant } from '@/lib/gift-oss';
import { authorizeGiftOpsRequest, giftOpsErrorResponse } from '@/lib/gift-ops-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    await authorizeGiftOpsRequest(request);
    const requestedVariant = request.nextUrl.searchParams.get('variant');
    const variant: GiftImageVariant = ['thumb', 'card', 'large', 'original'].includes(requestedVariant || '')
      ? requestedVariant as GiftImageVariant
      : 'card';
    const response = NextResponse.redirect(await getGiftOpsAssetUrl(Number(context.params.id), 'inline', variant), 307);
    response.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=3600');
    return response;
  } catch (error) {
    return giftOpsErrorResponse(error, 'Unable to open model asset.');
  }
}
