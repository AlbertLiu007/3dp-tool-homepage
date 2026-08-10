import { NextRequest, NextResponse } from 'next/server';
import { authorizeGiftRequest, giftApiError } from '@/lib/gift-api';
import { canAccessGiftAsset } from '@/lib/gift-library-db';
import { GiftAccessError } from '@/lib/gift-db';
import { getGiftAssetUrl, type GiftImageVariant } from '@/lib/gift-oss';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    const { employee } = await authorizeGiftRequest(request);
    const assetId = Number(context.params.id);
    if (!Number.isInteger(assetId) || !(await canAccessGiftAsset(employee, assetId))) throw new GiftAccessError('Asset was not found.', 404, 'not_found');
    const download = request.nextUrl.searchParams.get('download') === '1';
    const requestedVariant = request.nextUrl.searchParams.get('variant');
    const variant: GiftImageVariant = ['thumb', 'card', 'large', 'original'].includes(requestedVariant || '')
      ? requestedVariant as GiftImageVariant
      : 'card';
    const response = NextResponse.redirect(await getGiftAssetUrl(assetId, download ? 'attachment' : 'inline', variant), 307);
    response.headers.set('Cache-Control', download ? 'private, no-store' : 'private, max-age=300, stale-while-revalidate=3600');
    return response;
  } catch (error) {
    return giftApiError(error, 'Unable to open gift asset.');
  }
}
